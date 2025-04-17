var Efi = require('efi');

var options = {
    sandbox: true,
    client_id: '123',
    client_secret: '123',
    pix_cert: __dirname + '/keys/pix_cert.pem',
}

var efi = new Efi(options);

Date.prototype.addSeconds = function (seconds) {
    this.setTime(this.getTime() + seconds * 1000);
    return this;
}

async function createCharge(dueSeconds, cpf, fullname, amount, body) {
    let body = {
        "calendario": {
            "dueDate": dueSeconds
        },
        "devedor": {
            "cpf": cpf.replace(/\D/g, ''),
            "nome": fullname
        },
        "valor": {
            "original": amount.toFixed(2)
        },
        "chave": "15589b1a-856a-40a5-8a20-ddc3659c188c", //aleatorio
        "inforAdicionais": [
            {
                "nome": "Pagamento em",
                "valor": "NOME DO NOSSO ESTABELECIOMENTO"
            },
            {
                "nome": "Recebível #",
                "valor": "Codigo do contrato"
            }
        ]
    }
    const response = await efi.pixCreateImmediateCharge([], body)
}

async function generateQRCode(locId) {
    let params = {
        id: locId
    }

    const response = await efi.pixGenerateQRCode(params)
    return response
}



//para usar....
/*

const dueSeconds = 3600;
const due = new Date().addSeconds(dueSeconds);

const charge = await createCharge(dueSeconds, '1234567890123', 'John Doe', 100.00)
const qrCodeData = await generateQRCode(charge.loc.id)


... retorno apra o Flutter
return {
    id: contrato.id,
    valor: contrato.valor,
    qrCodeImage: qrCodeData.imagemQrcode,
    copiaecola: qrCodeData.qrCode,
    due: due.toISOString(), 
}

//salva no contrato para mostrar caso ele feche a janela
//adiconar eses campos no retorno para o comprador
const contrato = new Parse.Object('Contrato');
contrato.set('dueDate', due);
contrato.set('qrCodeImage', qrCodeData.imagemQrcode);
contrato.set('qrcode', qrCodeData.qrCode);
contrato.set('txid', charge.txid)
await contrato.save(null, { useMasterKey: true });

//retorno de due -> dueDate.iso

*/


module.exports = efi;


