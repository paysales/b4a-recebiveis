const Client = require('ssh2-sftp-client');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const unzipper = require('unzipper');
const Agenda = Parse.Object.extend('Agenda');
const AgendaBkp = Parse.Object.extend('Agenda_BKP');
const Ur = Parse.Object.extend('UR');

const certData = Buffer.from(process.env.SFTP_PRIVATE_KEY, 'base64').toString('utf-8');

const config = {
    host: 'static-sfs-us-east-1.docevent.io',
    port: 22,
    username: 'oq9yv4b0/back4app',
    password: 'Teste@1234'
}

const configB3 = {
    host: 'conecta-balcao.b3.com.br',
    port: 9039,
    privateKey: certData,
    username: 'ctpsi_paysales',
    password: 'Teste@1234'
}

let sftp = new Client();
const s3Bucket = 'your-s3-bucket-name';
const s3KeyPrefix = 'your/s3/key/prefix';
// const s3 = new AWS.S3({
//     region: 'us-east-1',
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
// });

Parse.Cloud.define('v1-sftp-list-all', async (req) => {
    try {
        await sftp.connect(configB3);
        const files = await sftp.list(req.params.nomeDir);
        await sftp.end();
        return files.map((r) => formatListSftp(r));
    } catch (error) {
        console.log(error);
    }
    await sftp.end();
}, {
    fields: {
        nomeDir: {
            required: true
        }
    }
});

async function uploadToS3FromStream(s3Bucket, s3KeyPrefix, fileName, jsonData) {
    const params = {
        Bucket: s3Bucket,
        Key: `${s3KeyPrefix}/${fileName}`,
        Body: jsonData,
        ContentType: 'application/json'
    };

    await s3.upload(params).promise();
    console.log(`Uploaded ${fileName} to S3`);
}

function getTodayDateFormatted() {
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2); // Get last two digits of the year
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed
    const day = now.getDate().toString().padStart(2, '0');

    return year + month + day;
}

async function backupAndCleanupAgenda(ciaCNPJ) {
    const agendaQuery = new Parse.Query('Agenda');

    agendaQuery.equalTo('ciaCNPJs', ciaCNPJ);

    try {
        const agendas = await agendaQuery.find({ useMasterKey: true });
        console.log(`Found ${agendas.length} agendas for ${ciaCNPJ}`);

        for (const agenda of agendas) {
            // Backup the agenda
            const agendaBkp = new Parse.Object('Agenda_BKP');

            // Copy data to backup
            agendaBkp.set('idAgenda', agenda.get('idAgenda'));
            agendaBkp.set('ciaCNPJs', agenda.get('ciaCNPJs'));
            agendaBkp.set('dataHoraRecepcao', agenda.get('dataHoraRecepcao'));
            agendaBkp.set('dataCriacao', agenda.get('dataCriacao'));
            agendaBkp.set('dataReferencia', agenda.get('dataReferencia'));
            agendaBkp.set('anuencia', agenda.get('anuencia'));

            if (agenda.has('zipFile')) {
                agendaBkp.set('zipFile', agenda.get('zipFile'));
            }

            await agendaBkp.save(null, { useMasterKey: true });
            console.log(`Agenda backed up with ID: ${agenda.get('idAgenda')}`);

            // Delete related UR records
            await deleteAllRelatedURRecords(agenda);

            // Remove original Agenda record
            await agenda.destroy({ useMasterKey: true });
            console.log(`Original agenda record deleted`);
        }
    } catch (error) {
        console.error('Error backing up agendas:', error);
    }
}

async function deleteAllRelatedURRecords(agenda) {
    let hasMoreRecords = true;
    const deleteBatchSize = 1000; // Increase batch size as needed

    while (hasMoreRecords) {
        const urQuery = new Parse.Query(Ur);
        urQuery.equalTo('agenda', agenda);
        urQuery.limit(deleteBatchSize);

        try {
            const urResults = await urQuery.find({ useMasterKey: true });
            if (urResults.length > 0) {
                await Parse.Object.destroyAll(urResults, { useMasterKey: true });
                console.log(`Deleted ${urResults.length} UR records.`);
            }
            hasMoreRecords = urResults.length === deleteBatchSize; // Check if there could be more records
        } catch (error) {
            console.error('Error deleting UR records:', error);
            break;
        }
    }
}

async function backupAndDeleteAgenda(existingAgenda) {
    // Create a backup in Agenda_BKP
    const agendaBkp = new AgendaBkp();

    // Copy fields from existing Agenda to Agenda_BKP
    agendaBkp.set('idAgenda', existingAgenda.get('idAgenda'));
    agendaBkp.set('ciaCNPJs', existingAgenda.get('ciaCNPJs'));
    agendaBkp.set('dataCriacao', existingAgenda.get('dataCriacao'));
    agendaBkp.set('dataHoraRecepcao', existingAgenda.get('dataHoraRecepcao'));
    agendaBkp.set('dataReferencia', existingAgenda.get('dataReferencia'));
    agendaBkp.set('anuencia', existingAgenda.get('anuencia'));

    // If there's a file, make sure to handle it
    if (existingAgenda.has('zipFile')) {
        agendaBkp.set('zipFile', existingAgenda.get('zipFile'));
    }

    // Save backup and then delete the original
    await agendaBkp.save(null, { useMasterKey: true });
    console.log('Existing agenda moved to Agenda_BKP.');

    // Delete related UR records
    await deleteAllRelatedURRecords(existingAgenda);
    // Delete the original agenda record
    await existingAgenda.destroy({ useMasterKey: true });
    // console.log('Original agenda record deleted after backup.');
}

async function salvarDadosNoBack4App(dadosJson, fileName, zipFilePath) {
    const agenda = new Agenda();

    // console.log('Processing JSON data with salvarDadosNoBack4App: ' + fileName);

    const regex = /^(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json$/;
    const match = regex.exec(fileName);

    if (!match) {
        throw new Error(`Filename ${fileName} does not match expected pattern.`);
    }

    const date = match[2];
    const clientCNPJ = match[5];
    const myCNPJ = match[4];
    const idAgenda = `${clientCNPJ}-${myCNPJ}-${date}`;

    // const queryAgenda = new Parse.Query(Agenda);
    // queryAgenda.equalTo('idAgenda', idAgenda);
    // let existingAgenda = await queryAgenda.first({ useMasterKey: true });

    // if (existingAgenda) {
    //     // Move existing agenda to backup class
    //     // console.log(`Existing agenda found for ${idAgenda}. Moving to Agenda_BKP.`);
    //     await backupAndDeleteAgenda(existingAgenda);
    // }

    if (dadosJson['dadosControle'].dataHoraRecepcao == '') {
        agenda.set('dataHoraRecepcao', new Date());
    } else {
        agenda.set('dataHoraRecepcao', new Date(dadosJson['dadosControle'].dataHoraRecepcao));
    }
    agenda.set('dataCriacao', dadosJson['dadosControle'].dataCriacao);
    agenda.set('ciaCNPJs', clientCNPJ + '-' + myCNPJ);
    agenda.set('dataReferencia', dadosJson['dadosControle'].dataReferencia);
    agenda.set('anuencia', dadosJson['anuencia']);
    agenda.set('idAgenda', idAgenda);

    await agenda.save(null, { useMasterKey: true });

    // Attach the original zip file to the newly saved agenda
    const zipBuffer = await fsp.readFile(zipFilePath);
    const zipBase64 = zipBuffer.toString('base64');
    const zipFile = new Parse.File(fileName, { base64: zipBase64 });
    agenda.set('zipFile', zipFile);  // Assuming you'll store the file under 'zipFile'
    await agenda.save(null, { useMasterKey: true });

    for (const ur of dadosJson['unidadesRecebiveis']) {
        try {
            const objetoUr = new Ur();
            objetoUr.set('cpfCnpjOriginador', ur.cpfCnpjOriginador.replace(/\D/g, ''));
            objetoUr.set('arranjo', ur.arranjo);
            objetoUr.set('cnpjCredenciadora', ur.cnpjCredenciadora.replace(/\D/g, ''));
            objetoUr.set('cnpjRegistradora', ur.cnpjRegistradora.replace(/\D/g, ''));
            objetoUr.set('dataPrevistaLiquidacao', ur.dataPrevistaLiquidacao);
            objetoUr.set('numPrevistaLiquidacao', parseInt(ur.dataPrevistaLiquidacao.replace(/\D/g, '')));
            objetoUr.set('valorConstituidoTotal', ur.valores.valorConstituidoTotal);
            objetoUr.set('valorConstituidoPreContratado', ur.valores.valorConstituidoPreContratado);
            objetoUr.set('valorComprometidoTotal', ur.valores.valorComprometidoTotal);
            objetoUr.set('valorTotalLiquidadoDia', ur.valores.valorTotalLiquidadoDia);
            objetoUr.set('valorLivreTotal', ur.valores.valorLivreTotal);
            objetoUr.set('agenda', agenda);
            await objetoUr.save(null, { useMasterKey: true }); // Salva no Back4App
        } catch (error) {
            console.error('Erro ao salvar no Back4App:', error);
            throw error; // Rejeita a promise para que o erro seja tratado
        }
    }
}

async function downloadAndProcessFile(sftp, remoteFilePath) {
    const zipFileName = path.basename(remoteFilePath);
    const localZipFilePath = path.join(__dirname, zipFileName);

    try {
        console.log(`Starting download of ${remoteFilePath} to ${localZipFilePath}`);
        await sftp.fastGet(remoteFilePath, localZipFilePath);
        // console.log(`Downloaded ${remoteFilePath} to ${localZipFilePath}`);
        // Open the downloaded zip file
        const directory = await unzipper.Open.file(localZipFilePath);
        // console.log(`Unzipped ${localZipFilePath} to directory: ${directory}`);
        for (const file of directory.files) {
            // console.log(`Processing file: ${file.path}`);
            if (file.path.endsWith('.json')) {
                const localJsonFilePath = path.join(__dirname, file.path);
                // console.log(`Extracting ${file.path} to ${localJsonFilePath}`);
                // Extract JSON file to local path
                await new Promise((resolve, reject) => {
                    file.stream()
                        .pipe(fs.createWriteStream(localJsonFilePath))
                        .on('finish', resolve)
                        .on('error', reject);
                });
                // console.log(`Extracted ${file.path} to ${localJsonFilePath}`);
                // console.log(`Enviando JSON file path: ${file.path}`);
                // Read and process the JSON file
                const jsonContent = await fsp.readFile(localJsonFilePath, 'utf8');
                await salvarDadosNoBack4App(JSON.parse(jsonContent), file.path, localZipFilePath);
                // Remove the extracted JSON file
                await fsp.unlink(localJsonFilePath);
                // console.log(`Deleted local JSON file ${localJsonFilePath}`);
            }
        }
        // Remove the zip file after processing
        await fsp.unlink(localZipFilePath);
        // console.log(`Deleted local zip file ${localZipFilePath}`);
        // Delete the zip file from the SFTP server
        // await sftp.delete(remoteFilePath);
        // console.log(`Deleted ${remoteFilePath} from SFTP`);
    } catch (err) {
        console.error(`Error processing file ${remoteFilePath}:`, err);
    }
}

Parse.Cloud.define('v1-sftp-process-all', async (req) => {
    const sftp = new Client();

    const configB3 = {
        host: 'conecta-balcao.b3.com.br',
        port: 9039,
        privateKey: certData,
        username: 'ctpsi_paysales',
        password: 'Teste@1234'
    }
    let listaProcessados = [];
    const todayDate = getTodayDateFormatted();

    try {
        await sftp.connect(configB3);

        const fileList = await sftp.list(req.params.nomeDir);

        for (const file of fileList) {
            if (!file.name.includes('AGENDA-BATCH')) continue;

            const regex = /^(\d+)_(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json\.zip\.\w+$/;
            const match = regex.exec(file.name);
            if (match) {
                const fileDate = match[3];
                if (fileDate == todayDate) {
                    const ciaCNPJs = match[6] + '-' + match[5];
                    console.log(`Processing file: ${file.name} for ${ciaCNPJs}`);
                    await backupAndCleanupAgenda(ciaCNPJs);
                    const remoteFilePath = `${req.params.nomeDir}/${file.name}`;
                    await downloadAndProcessFile(sftp, remoteFilePath);
                    listaProcessados.push(file.name);
                }
            }
        }

    } catch (err) {
        console.error('Error in SFTP operation:', err);
    } finally {
        await sftp.end();
        console.log('SFTP connection closed');
        return listaProcessados;
    }
}, {
    fields: {
        nomeDir: {
            required: true
        }
    }
});


// async function processZipStream(sftp, remoteFilePath, s3Bucket, s3KeyPrefix) {


Parse.Cloud.define('v1-sftp-get-json', async (req) => {
    const nomeArquivo = req.params.nomeArquivo;
    try {
        const dadosJson = await lerArquivoJsonFtp(nomeArquivo);
        await salvarDadosNoBack4App(dadosJson[0]);
        console.log(`Arquivo ${nomeArquivo} processado com sucesso.`);
        // return dadosJson;
    } catch (error) {
        console.error('Erro ao processar arquivo ${nomeArquivo}:', error);
    }
}, {
    fields: {
        nomeArquivo: {
            required: true
        }
    }
});


async function lerArquivoJsonFtp(nomeArquivo) {
    const ftpConfig = {
        host: 'static-sfs-us-east-1.docevent.io',
        port: 22,
        username: 'oq9yv4b0/back4app',
        password: 'Teste@1234'
    };

    try {
        await sftp.connect(ftpConfig);
        const caminhoArquivoRemoto = `/${nomeArquivo}`; // Ajuste o caminho
        const buffer = await sftp.get(caminhoArquivoRemoto); // Obtém o arquivo como Buffer

        const conteudoString = buffer.toString('utf-8'); // Converte o Buffer para String
        const dadosJson = JSON.parse(conteudoString); // Converte a String para JSON

        await sftp.end();
        return dadosJson;
    } catch (err) {
        console.error('Erro ao ler arquivo FTP:', err);
        await sftp.end();
        throw err; // Rejeita a promise para que o erro seja tratado
    }
}

function formatListSftp(u) {
    return {
        nome: u.name,
        // dtMod: new Date(u.modifyTime),
        tamanho: u.size
    }
}