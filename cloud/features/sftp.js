const { PassThrough } = require('stream');
const Client = require('ssh2-sftp-client');
const fs = require('fs');
const unzipper = require('unzipper');
const Parse = require('parse/node'); // Assume Parse is initialized
const path = require('path');
const Agenda = Parse.Object.extend('Agenda');
const AgendaBkp = Parse.Object.extend('Agenda_BKP');
const Ur = Parse.Object.extend('UR');
const Config = Parse.Object.extend('Config');
const Cliente = Parse.Object.extend('Cliente');

// Securely access credentials from environment variables
const { SFTP_HOST, SFTP_USERNAME, SFTP_PASSWORD, SFTP_PRIVATE_KEY, SFTP_HOST_HOMOL, SFTP_USERNAME_HOMOL, SFTP_PASSWORD_HOMOL, SFTP_PRIVATE_KEY_HOMOL } = process.env;

const certData = Buffer.from(SFTP_PRIVATE_KEY, 'base64').toString('utf-8');
const certDataHomol = Buffer.from(SFTP_PRIVATE_KEY_HOMOL, 'base64').toString('utf-8');

const sftpConfig = {
    host: SFTP_HOST,
    port: 9039,
    username: SFTP_USERNAME,
    password: SFTP_PASSWORD,
    privateKey: certData,
    // Add a readyTimeout to handle slow server responses
    readyTimeout: 20000, // in milliseconds
};
const sftpConfigHomol = {
    host: SFTP_HOST_HOMOL,
    port: 9039,
    username: SFTP_USERNAME_HOMOL,
    password: SFTP_PASSWORD_HOMOL,
    privateKey: certDataHomol,
    passphrase: 'P@ysales123',
    // Add a readyTimeout to handle slow server responses
    readyTimeout: 200000, // in milliseconds
};

async function salvarDadosNoBack4App(dadosJson, fileName, zipFilePath) {
    const agenda = new Agenda();
    const zipFileName = path.basename(zipFilePath);

    const sftp1 = new Client();
    await sftp1.connect(sftpConfig);


    // console.log('Processing JSON data with salvarDadosNoBack4App: ' + fileName);
    // console.log('zipFilePath:' + zipFilePath);
    // console.log('zipFileName:' + zipFileName);

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
    agenda.set('cpfCnpjOriginador', clientCNPJ);
    agenda.set('ciaCNPJs', clientCNPJ + '-' + myCNPJ);
    agenda.set('dataReferencia', dadosJson['dadosControle'].dataReferencia);
    agenda.set('anuencia', dadosJson['anuencia']);
    agenda.set('idAgenda', idAgenda);

    await agenda.save(null, { useMasterKey: true });

    // Attach the original zip file to the newly saved agenda

    // const zipBuffer = await fsp.readFile(zipFilePath);
    // const zipBase64 = zipBuffer.toString('base64');
    // const zipFile = new Parse.File(fileName, { base64: zipBase64 });
    // agenda.set('zipFile', zipFile);  // Assuming you'll store the file under 'zipFile'
    // await agenda.save(null, { useMasterKey: true });
    // Fetch the ZIP file as a buffer
    try {
        console.log(`Fetching zip file from SFTP: ${zipFilePath}`);
        const zipBuffer = await sftp1.get(zipFilePath);
        // Check the buffer is not empty

        if (!zipBuffer || zipBuffer.length === 0) {
            throw new Error('Zip buffer is empty. Check the file path and permissions.');
        }
        // Create a Parse.File object
        const zipBase64 = zipBuffer.toString('base64');
        const zipFile = new Parse.File(zipFileName, { base64: zipBase64 });

        // Attach the file to the Agenda object
        agenda.set('zipFile', zipFile);

        // Save the object to Parse Server with the attached file
        await agenda.save(null, { useMasterKey: true });
        console.log(`Agenda with id ${idAgenda} saved, including zip file.`);
    } catch (error) {
        console.error('Error fetching or setting the zip file:', error);
    }

    await sftp1.end();

    let valorLivreTotal = 0;
    let count = 0;
    let arranjos = [];
    let cnpjCredenciadoras = [];
    //Configura datas de Inicio e Fim
    const queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'Dias_UR');
    const config = await queryConfig.first({ useMasterKey: true });
    let diasUR = 0;
    if (config) diasUR = parseInt(config.get('valor'));

    const dtIni = new Date();
    dtIni.setDate(dtIni.getDate() + diasUR);

    let dtFim = new Date();

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
            objetoUr.set('liquidacoes', ur.liquidacoes);
            objetoUr.set('agenda', agenda);
            await objetoUr.save(null, { useMasterKey: true });
            valorLivreTotal += ur.valores.valorLivreTotal;
            count++;
            if (ur.valores.valorLivreTotal > 0) {
                if (!arranjos.includes(ur.arranjo)) {
                    arranjos.push(ur.arranjo);
                }
                if (!cnpjCredenciadoras.includes(ur.cnpjCredenciadora)) {
                    cnpjCredenciadoras.push(ur.cnpjCredenciadora);
                }
            }
            if (new Date(ur.dataPrevistaLiquidacao) > new Date(dtFim)) {
                dtFim = ur.dataPrevistaLiquidacao;
            }
        } catch (error) {
            console.error('Erro ao salvar no Back4App:', error);
            throw error; // Rejeita a promise para que o erro seja tratado
        }
    }
    // console.log('valorLivreTotal:' + valorLivreTotal);
    // console.log('arranjos:' + arranjos);
    // console.log('cnpjCredenciadoras:' + cnpjCredenciadoras);
    // console.log('dtFim:' + dtFim);

    agenda.set('valorLivreTotal', valorLivreTotal);
    agenda.set('arranjos', arranjos);
    agenda.set('cnpjCredenciadoras', cnpjCredenciadoras);
    agenda.set('dtIni', dtIni.toISOString().split('T')[0]);
    agenda.set('dtFim', dtFim);
    agenda.set('count', count);
    await agenda.save(null, { useMasterKey: true });
    //Salvar o ponteiro da agenda no cliente
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('cnpj', clientCNPJ);
    const cliente = await queryCliente.first({ useMasterKey: true });
    if (cliente) {
        cliente.set('agenda', agenda);
        await cliente.save(null, { useMasterKey: true });
    }


}

// Function for streaming and processing files
async function processFileFromSftp(sftp, remoteFilePath) {
    const regex = /^(\d+)_(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json\.zip\.\w+$/;
    const zipFileName = path.basename(remoteFilePath);
    const match = regex.exec(zipFileName);

    if (!match) return;

    const clientCNPJ = match[6];
    const ourCNPJ = match[5]; // Your specific CNPJ format
    const date = match[3];

    //Vamos verificar se existe um cliente com o cnpj
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('cnpj', clientCNPJ);
    const cliente = await queryCliente.first({ useMasterKey: true });
    if (!cliente) {
        console.log(`Cliente com cnpj ${clientCNPJ} não encontrado`);
        return;
    }

    try {
        console.log(`Starting stream processing of: ${remoteFilePath}`);

        await backupAndCleanupAgenda(`${clientCNPJ}-${ourCNPJ}`);

        // Create a PassThrough stream as a destination
        const passThrough = new PassThrough();
        passThrough.on('error', (err) => console.error('PassThrough Error:', err));

        try {
            await sftp.get(remoteFilePath, passThrough);
        } catch (e) {
            console.error('Error retrieving file from SFTP. Ensure paths and permissions are correct:', e);
            return; // Early return if retrieval fails
        }

        passThrough
            .pipe(unzipper.Parse())
            .on('entry', function (entry) {
                const fileName = entry.path;
                const type = entry.type; // 'Directory' or 'File'

                if (fileName.endsWith('.json') && type === 'File') {
                    const chunks = [];
                    entry.on('data', (chunk) => chunks.push(chunk));

                    entry.on('end', async () => {
                        try {
                            const content = Buffer.concat(chunks).toString('utf8');
                            const jsonData = JSON.parse(content);
                            console.log(`Parsed JSON: ${jsonData}`); // Handle the JSON data
                            await salvarDadosNoBack4App(jsonData, fileName, remoteFilePath);
                        } catch (err) {
                            console.error('Error parsing JSON:', err);
                        }
                    });
                } else {
                    // Ensure any unwanted data is flushed
                    entry.autodrain();
                }
            })
            .on('error', (err) => console.error('Unzip error:', err));


    } catch (error) {
        console.error('Error processing file:', error);
    }
}

// Function for backup and cleanup on Parse
async function backupAndCleanupAgenda(ciaCNPJ) {
    const agendaQuery = new Parse.Query('Agenda');
    agendaQuery.equalTo('ciaCNPJs', ciaCNPJ);

    try {
        const agendas = await agendaQuery.find({ useMasterKey: true });
        if (agendas.length === 0) {
            console.log(`No agendas found for ciaCNPJs: ${ciaCNPJ}`);
            return;
        }
        for (const agenda of agendas) {
            const agendaBkp = new AgendaBkp();
            agendaBkp.set('idAgenda', agenda.get('idAgenda'));
            agendaBkp.set('cpfCnpjOriginador', agenda.get('cpfCnpjOriginador'));
            agendaBkp.set('ciaCNPJs', agenda.get('ciaCNPJs'));
            agendaBkp.set('dataCriacao', agenda.get('dataCriacao'));
            agendaBkp.set('dataReferencia', agenda.get('dataReferencia'));
            agendaBkp.set('dataHoraRecepcao', agenda.get('dataHoraRecepcao'));
            agendaBkp.set('anuencia', agenda.get('anuencia'));
            agendaBkp.set('valorLivreTotal', agenda.get('valorLivreTotal'));
            agendaBkp.set('arranjos', agenda.get('arranjos'));
            agendaBkp.set('cnpjCredenciadoras', agenda.get('cnpjCredenciadoras'));
            agendaBkp.set('dtIni', agenda.get('dtIni'));
            agendaBkp.set('dtFim', agenda.get('dtFim'));

            if (agenda.has('zipFile')) agendaBkp.set('zipFile', agenda.get('zipFile'));
            await agendaBkp.save(null, { useMasterKey: true });
            await deleteAllRelatedURRecords(agenda);
            await agenda.destroy({ useMasterKey: true });
            console.log(`Agenda record for CNPJ backed up and removed: ${agendaBkp.get('idAgenda')}`);
        }
    } catch (error) {
        console.error('Error during backup and cleanup:', error);
    }
}

// Function for deleting related UR records
async function deleteAllRelatedURRecords(agenda) {
    const urQuery = new Parse.Query('UR');
    urQuery.equalTo('agenda', agenda);
    let hasMoreRecords = true;
    const deleteBatchSize = 1000;

    while (hasMoreRecords) {
        const urRecords = await urQuery.limit(deleteBatchSize).find({ useMasterKey: true });
        if (urRecords.length > 0) {
            await Parse.Object.destroyAll(urRecords, { useMasterKey: true });
            console.log(`Deleted ${urRecords.length} UR records.`);
        }
        hasMoreRecords = urRecords.length === deleteBatchSize;
    }
}


Parse.Cloud.job('v1-process-sftp-prod', async (req) => {
    const sftpDir = "/ArqsBatch";
    const listaProcessados = await processSFTPFile(sftpDir);
    return listaProcessados;
});

async function processSFTPFile(sftpDir) {

    const sftp = new Client();
    const todayDate = getTodayDateFormatted();
    const processedFiles = [];

    try {
        await sftp.connect(sftpConfig);
        const fileList = await sftp.list(sftpDir);

        for (const file of fileList) {
            console.log(`Evaluating file: ${file.name}`);
            if (!file.name.includes('AGENDA-BATCH')) continue;
            const regex = /^(\d+)_(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json\.zip\.\w+$/;
            const match = regex.exec(file.name);

            if (match && match[3] === todayDate) {
                console.log(`Processing file for today: ${file.name}`);
                await processFileFromSftp(sftp, `${sftpDir}/${file.name}`);
                processedFiles.push(file.name);
            }
        }
    } catch (err) {
        console.error('Error in SFTP operation:', err);
    } finally {
        await sftp.end();
        console.log('SFTP connection closed');
        return processedFiles;
    }
}

// Main Cloud Function to interface with SFTP and process files
Parse.Cloud.define('v1-sftp-process-all', async (req) => {

    const sftpDir = req.params.nomeDir;
    const listaProcessados = await processSFTPFile(sftpDir);
    return listaProcessados;

    // const sftp = new Client();
    // const todayDate = getTodayDateFormatted();
    // const processedFiles = [];

    // try {
    //     await sftp.connect(sftpConfig);
    //     const fileList = await sftp.list(req.params.nomeDir);


    //     for (const file of fileList) {
    //         console.log(`Evaluating file: ${file.name}`);
    //         if (!file.name.includes('AGENDA-BATCH')) continue;
    //         const regex = /^(\d+)_(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json\.zip\.\w+$/;
    //         const match = regex.exec(file.name);

    //         if (match && match[3] === todayDate) {
    //             console.log(`Processing file for today: ${file.name}`);
    //             await processFileFromSftp(sftp, `${req.params.nomeDir}/${file.name}`);
    //             processedFiles.push(file.name);
    //         }
    //     }
    // } catch (err) {
    //     console.error('Error in SFTP operation:', err);
    // } finally {
    //     await sftp.end();
    //     console.log('SFTP connection closed');
    //     return processedFiles;
    // }
}, {
    fields: {
        nomeDir: { required: true },
    },
});


Parse.Cloud.define('v1-sftp-process-homolog', async (req) => {
    const sftp = new Client();
    const todayDate = getTodayDateFormatted();
    const processedFiles = [];
    // console.log(`Today's date: ${todayDate}`);
    console.log(`Processing files in directory: ${req.params.nomeDir}`);
    // console.log(`SFTP configuration: ${JSON.stringify(sftpConfig)}`);

    try {
        await sftp.connect(sftpConfigHomol);
        const fileList = await sftp.list(req.params.nomeDir);


        for (const file of fileList) {
            console.log(`Evaluating file: ${file.name}`);
            if (!file.name.includes('AGENDA-BATCH')) continue;
            const regex = /^(\d+)_(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json\.zip\.\w+$/;
            const match = regex.exec(file.name);

            if (match && match[3] === todayDate) {
                console.log(`Processing file for today: ${file.name}`);
                await processFileFromSftp(sftp, `${req.params.nomeDir}/${file.name}`);
                processedFiles.push(file.name);
            }
        }
    } catch (err) {
        console.error('Error in SFTP operation:', err);
    } finally {
        await sftp.end();
        console.log('SFTP connection closed');
        return processedFiles;
    }
}, {
    fields: {
        nomeDir: { required: true },
    },
});


function obterNomeArquivo(caminho) {
    const indiceUltimaBarra = caminho.lastIndexOf('/'); // Ou '\\' se for Windows
    if (indiceUltimaBarra === -1) {
        return caminho; // Sem barra, o caminho é o nome do arquivo
    }
    return caminho.substring(indiceUltimaBarra + 1);
}


// Helper function to format dates
function getTodayDateFormatted() {
    const now = new Date();
    return now.toISOString().slice(2, 10).replace(/-/g, ''); // Formats date to yymmdd
}

Parse.Cloud.job('v1-sftp-get-agenda', async (req) => {
    const sftp = new Client();
    const todayDate = getTodayDateFormatted();
    const processedFiles = [];
    const nomeDir = "/ArqsBatch";
    // console.log(`Today's date: ${todayDate}`);
    // console.log(`Processing files in directory: ${req.params.nomeDir}`);
    // console.log(`SFTP configuration: ${JSON.stringify(sftpConfig)}`);

    try {
        await sftp.connect(sftpConfig);
        const fileList = await sftp.list(nomeDir);


        for (const file of fileList) {
            console.log(`Evaluating file: ${file.name}`);
            if (!file.name.includes('AGENDA-BATCH')) continue;
            const regex = /^(\d+)_(\w+)_(\d{6})_(SP_AGENDA-BATCH)-(\d{14})-(\d{14})\.json\.zip\.\w+$/;
            const match = regex.exec(file.name);

            if (match && match[3] === todayDate) {
                console.log(`Processing file for today: ${file.name}`);
                await processFileFromSftp(sftp, `${nomeDir}/${file.name}`);
                processedFiles.push(file.name);
            }
        }
    } catch (err) {
        console.error('Error in SFTP operation:', err);
    } finally {
        await sftp.end();
        console.log('SFTP connection closed');
        return processedFiles;
    }
});



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

Parse.Cloud.define('v1-sftp-list-all', async (req) => {

    const sftp = new Client();
    // await sftp.connect(sftpConfig);
    await sftp.connect(sftpConfigHomol);

    try {
        const files = await sftp.list(req.params.nomeDir);
        await sftp.end();
        return files.map((r) => formatListSftp(r));
    } catch (error) {
        await sftp.end();
        console.log(error);
    }
}, {
    fields: {
        nomeDir: {
            required: true
        }
    }
});

function formatListSftp(u) {
    return {
        nome: u.name,
        // dtMod: new Date(u.modifyTime),
        tamanho: u.size
    }
}

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