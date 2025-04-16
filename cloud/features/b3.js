const axios = require("axios");
const https = require("https");
// const Pacote = Parse.Object.extend('Pacote');
// const Ur = Parse.Object.extend('UR');
const Config = Parse.Object.extend('Config');
// const Cliente = Parse.Object.extend('Cliente');

const { CRT, KEY, CLIENT_ID, CLIENT_SECRET, CRT_HOMOL, KEY_HOMOL, CLIENT_ID_HOMOL, CLIENT_SECRET_HOMOL, ENV } = process.env;

const env = ENV || 'production';
let baseUrl;
let certData;
let keyData;
let clientId;
let clientSecret;
if (env === 'production') {
  baseUrl = "https://api-balcao.b3.com.br";
  certData = Buffer.from(CRT, 'base64').toString('utf-8');
  keyData = Buffer.from(KEY, 'base64').toString('utf-8');
  clientId = CLIENT_ID;
  clientSecret = CLIENT_SECRET;
} else {
  baseUrl = "https://api-balcao-cert.b3.com.br";
  certData = Buffer.from(CRT_HOMOL, 'base64').toString('utf-8');
  keyData = Buffer.from(KEY_HOMOL, 'base64').toString('utf-8');
  clientId = CLIENT_ID_HOMOL;
  clientSecret = CLIENT_SECRET_HOMOL;
}

const b3API = axios.create({
  httpsAgent: new https.Agent({
    // rejectUnauthorized: false,
    cert: certData,
    key: keyData
  })
});

async function obterTokenB3() {
  console.log('Iniciando obter token na B3...');
  const config = await Parse.Config.get({ useMasterKey: true });
  var tokenData;
  if (env === 'production') {
    tokenData = config.get('B3Token');
    console.log('Token Data: ' + JSON.stringify(tokenData));
  } else {
    tokenData = config.get('B3TokenHom');
    console.log('Token Homologação Data: ' + JSON.stringify(tokenData));
  }

  if (!tokenData) {
    // Token não existe, realizar login
    console.log('Token não encontrado, realizando login na B3...');
    return await realizarLoginB3();
  }

  const { token, expiresAt } = JSON.parse(tokenData);

  if (Date.now() >= expiresAt) {
    console.log('Token expirado, realizando login na B3...');
    // Token expirado, realizar login
    return await realizarLoginB3();
  }

  console.log('Token válido, retornando token...');
  return token;
}

async function realizarLoginB3() {
  console.log('Realizando login na B3...');

  // Securely access credentials from environment variables
  // const { CRT, KEY, CLIENT_ID, CLIENT_SECRET } = process.env;

  // const certData = Buffer.from(CRT, 'base64').toString('utf-8');
  // const keyData = Buffer.from(KEY, 'base64').toString('utf-8');
  // const passData = process.env.PASS;
  // const clientId = CLIENT_ID;
  // const clientSecret = CLIENT_SECRET;
  console.log('Iniciando login na B3...');
  try {
    // const b3API = axios.create({
    //   httpsAgent: new https.Agent({
    //     rejectUnauthorized: false,
    //     cert: certData,
    //     key: keyData
    //   })
    // });
    const options = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    console.log('Iniciando login na B3 ' + env + '...');
    const data = "grant_type=client_credentials&client_id=" + clientId + "&client_secret=" + clientSecret;

    const response = await b3API.post(baseUrl + "/api/oauth/token", data, options);
    console.log('Token obtido com sucesso: ' + JSON.stringify(response.data));

    const token = response.data['access_token'];
    const expiresIn = response.data['expires_in']; // Em segundos

    // Calcular a data de expiração
    const expiresAt = Date.now() + expiresIn * 1000;

    // Salvar o token e a data de expiração na configuração
    if (env === 'production') {
      await Parse.Config.save({
        B3Token: JSON.stringify({ token, expiresAt }),
      }, { useMasterKey: true }); // Usando MasterKey
      console.log('Token salvo na configuração na produção...');
    } else {
      await Parse.Config.save({
        B3TokenHom: JSON.stringify({ token, expiresAt }),
      }, { useMasterKey: true }); // Usando MasterKey
      console.log('Token salvo na configuração na homologação...');
    }

    return token;
  } catch (error) {
    console.error('Erro ao realizar login na B3:', error);
    throw error;
  }
}


Parse.Cloud.define('v1-test-b3-login', async (req) => {
  // return b3Login();
  return realizarLoginB3();
});

Parse.Cloud.define('v1-test-b3-token', async (req) => {
  return obterTokenB3();
});


async function b3Login() {

  // Securely access credentials from environment variables
  const { CRT, KEY, CLIENT_ID, CLIENT_SECRET } = process.env;

  const certData = Buffer.from(CRT, 'base64').toString('utf-8');
  const keyData = Buffer.from(KEY, 'base64').toString('utf-8');
  // const passData = process.env.PASS;
  const clientId = CLIENT_ID;
  const clientSecret = CLIENT_SECRET;

  try {
    const b3API = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        cert: certData,
        key: keyData
      })
    });
    const options = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    const data = "grant_type=client_credentials&client_id=" + clientId + "&client_secret=" + clientSecret;

    const response = await b3API.post(baseUrl + "/api/oauth/token", data, options);

    if (response) {
      // return ("resultado: " + JSON.stringify(response.data['access_token']));
      await Parse.Config.save({ 'B3Token': JSON.stringify(response.data['access_token']) });
      return ('SUCESSO');
    } else {
      return ("sem resultado");
    }
  } catch (error) {
    return ("erro: " + error);
  }
};


Parse.Cloud.define('v1-test-b3-optin', async (req) => {
  return optIn(req.params);
});

async function optIn(data) {

  const token = await obterTokenB3();

  console.log('Token: ' + token);

  const payload = {
    Optin: [data], // Usando os parâmetros da requisição
  };


  console.log('Payload: ' + JSON.stringify(payload));
  // const payload = JSON.stringify({
  //   "Optin": [
  //     {
  //       "codigoExterno": "HL-04",
  //       "cnpjSolicitante": "57033206000135",
  //       "cnpjFinanciador": "57033206000135",
  //       "cnpjCredenciadora": "",
  //       "documentoUsuarioFinalRecebedor": "68428236000167",
  //       "arranjoPagamento": "",
  //       "dataAssinatura": "2025-04-04",
  //       "dataEfetivacao": "2025-04-07",
  //       "dataExpiracao": "2026-09-24",
  //       "documentoTitular": ""
  //     }
  //   ]
  // });
  // const payload = JSON.stringify(data)
  console.log('Iniciando opt-in na B3...');

  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await b3API.post(baseUrl + "/api/rcc-opt/v2/optin", JSON.stringify(payload), options);
    return response.data;
  } catch (error) {
    console.error('Erro ao realizar opt-in na B3:', error);
    throw error;
  }
}

Parse.Cloud.define('v1-test-b3-consulta-agenda', async (req) => {
  return consultaAgenda(req.params);
});

async function consultaAgenda(data) {
  const token = await obterTokenB3();
  // console.log('Token: ' + token);
  const payload = JSON.stringify({
    "SolicitacaoConsultaAgenda": {
      "documentoOriginador": "68428236000167",
      "cnpjFinanciador": "57033206000135",
      "cnpjSolicitante": "57033206000135",
      "documentoTitular": "",
      "cnpjCredenciadora": "",
      "codigoArranjoPagamento": "",
      "indicadorAceiteAgendaParcial": "Sim",
      "dataInicio": "2025-04-07",
      "dataFim": "2025-04-07"
    }
  });
  console.log('Iniciando consulta agenda na B3...');
  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    const response = await b3API.post(baseUrl + "/api/rcc-agenda/v1.0/consulta-agenda-online", payload, options);
    return response.data;
  } catch (error) {
    console.error('Erro ao realizar consulta agenda na B3:', error);
    throw error;
  }
}

async function registrarContrato(payload) {

  const token = await obterTokenB3();

  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      validateStatus: (status) => status >= 200 && status < 300 // Não lançar erro para outros status
    };
    const response = await b3API.post(baseUrl + "/api/rcc-efeitos-contratos/v1/definicao-unidades-recebiveis/generica", payload, options);

    if (response.status >= 200 && response.status < 300) {
      // Chamada bem-sucedida
      return response.data;
    } else {
      // Erro na chamada, vamos processar o corpo da resposta
      console.error("Erro da API da B3:", response.status, response.data);
      throw { status: response.status, body: response.data }; // Lança um objeto com status e body
    }

  } catch (error) {
    // Erro na requisição (ex: falha na conexão, timeout, etc.) ou erro lançado pelo axios para status fora de 2xx (se validateStatus for removido)
    console.error("Erro na requisição para a API da B3:", error);
    if (error.response) {
      // Erro recebido da API (incluindo status e dados)
      throw { status: error.response.status, body: error.response.data };
    } else {
      // Outro erro (ex: rede)
      throw error;
    }
  }

}

async function consultaContrato(payload) {

  const token = await obterTokenB3();
  console.log(payload);

  const url = `${baseUrl}/api/rcc-efeitos-contratos/v1/definicao-unidades-recebiveis/generica/${payload.codigoExternoContrato}/${payload.identificadorContrato}`;
  console.log(url);

  try {
    const options = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    const response = await b3API.get(url, options);
    const data = response.data;
    return data;
  } catch (error) {
    console.error('Erro ao realizar consulta de contrato na B3:', error);
    throw error;
  }
}


// Parse.Cloud.define('v1-registrar-contrato', async (req) => {

//   // const token = await obterTokenB3();

//   const query = new Parse.Query(Pacote);
//   query.include('urs');
//   query.include('vendedor');
//   const pacote = await query.get(req.params.pacoteId, { useMasterKey: true });
//   if (!pacote) throw 'PACOTE_INVALIDO';
//   console.log('exitem pacote para virar contrato')
//   if (pacote.get('status') !== 'em negociacao') throw 'PACOTE_INVALIDO';
//   console.log('pacote em negociação')
//   const urs = pacote.get('urs');
//   if (!urs || urs.length === 0) throw 'URS_INVALIDO';

//   const vendedor = pacote.get('vendedor');
//   if (!vendedor) throw 'VENDEDOR_INVALIDO';

//   //comprador
//   const queryCliente = new Parse.Query(Cliente);
//   queryCliente.include('banco');
//   queryCliente.equalTo('admins', req.user);
//   const comprador = await queryCliente.first({ useMasterKey: true });
//   if (!comprador) throw 'COMPRADOR_INVALIDO';

//   const banco = comprador.get('banco');
//   if (!banco) throw 'BANCO_INVALIDO';

//   let queryConfig = new Parse.Query(Config);
//   queryConfig.equalTo('nome', 'CodContrato');
//   let config = await queryConfig.first({ useMasterKey: true });
//   let proximoContador = parseInt(config.get("valor")) || 1;
//   proximoContador++;
//   config.set("valor", String(proximoContador));
//   await config.save(null, { useMasterKey: true })

//   const today = new Date().toISOString().split('T')[0];
//   const year = today.split('-')[0];
//   const yy = year.slice(-2);
//   const codigoContrato = String(proximoContador).padStart(7, '0');
//   const codContratoStr = `CTR-${codigoContrato}_${yy}`;

//   queryConfig = new Parse.Query(Config);
//   queryConfig.equalTo('nome', 'cnpjFinanciador');
//   config = await queryConfig.first({ useMasterKey: true });
//   const cnpjFinanciador = config.get('valor');

//   queryConfig = new Parse.Query(Config);
//   queryConfig.equalTo('nome', 'cnpjSolicitante');
//   config = await queryConfig.first({ useMasterKey: true });
//   const cnpjSolicitante = config.get('valor');


//   // verificar se conta vai dígito e CNPJ formatado ou não
//   const payload = JSON.stringify({
//     "data": {
//       "codigoExternoContrato": codContratoStr,
//       "identificadorContrato": codContratoStr,
//       "documentoContratanteDivida": vendedor.get('cnpj'),
//       "indicadorRenegociacao": 0,
//       "cnpjParticipante": cnpjFinanciador,
//       "cnpjDetentor": cnpjFinanciador,
//       "codigoTipoEfeitoContrato": 1,
//       "valorSaldoDevedorOuLimite": pacote.get('valorBruto'),
//       "valorMinimoMantido": pacote.get('valorBruto'),
//       "dataAssinatura": today,
//       "dataVencimento": today,
//       "codigoModalidadeOperacao": 1,
//       "codigoRegraDivisao": 1,
//       "domicilio": {
//         "codigoAgencia": banco.get('agencia'),
//         "numeroConta": banco.get('conta'),
//         "codigoISPB": banco.get('ispb'),
//         "documentoTitularConta": comprador.get('cnpj'),
//         "tipoConta": "CC"
//       },
//       "recebiveisAbrangidos": [
//         ...urs.map((ur) => {
//           return {
//             "cnpjsCredenciadora": [ur.get('cnpjCredenciadora')],
//             "documentosUsuarioFinalRecebedor": [vendedor.get('cnpj')],
//             "codigosArranjoPagamento": [ur.get('arranjo')],
//             "dataLiquidacaoInicial": ur.get('dataPrevistaLiquidacao'),
//             "dataLiquidacaoFinal": ur.get('dataPrevistaLiquidacao'),
//             "valorOnerar": ur.get('valorLivreTotal')
//           }
//         })
//       ]
//     }
//   });

//   data = await registrarContrato(payload);

//   //vamos guardar os dados:
//   pacote.set('status', 'enviado_b3');
//   pacote.set('codigoContrato', data.RetornoRequisicao.codigoExternoContrato);
//   pacote.set('protocoloProcessamento', data.RetornoRequisicao.protocoloProcessamento);
//   pacote.set('dataHoraProcessamento', new Date(data.RetornoRequisicao.dataHoraProcessamento));

//   await pacote.save(null, { useMasterKey: true });

//   return data;

//   // // return payload;

//   // try {
//   //   const options = {
//   //     headers: {
//   //       Authorization: `Bearer ${token}`,
//   //       'Content-Type': 'application/json'
//   //     }
//   //   };
//   //   const response = await b3API.post(baseUrl + "/api/rcc-efeitos-contratos/v1/definicao-unidades-recebiveis/generica", payload, options);
//   //   const data = response.data;
//   //   //vamos guardar os dados:
//   //   pacote.set('status', 'enviado_b3');
//   //   pacote.set('codigoContrato', data.RetornoRequisicao.codigoExternoContrato);
//   //   pacote.set('protocoloProcessamento', data.RetornoRequisicao.protocoloProcessamento);
//   //   pacote.set('dataHoraProcessamento', new Date(data.RetornoRequisicao.dataHoraProcessamento));

//   //   await pacote.save(null, { useMasterKey: true });
//   //   return data;
//   // } catch (error) {
//   //   console.error('Erro ao realizar registro de contrato na B3:', error);
//   //   throw error;
//   // }
// }, {
//   requireUser: true,
//   fields: {
//     pacoteId: { required: true },
//   }
// });

module.exports = {
  realizarLoginB3,
  obterTokenB3,
  optIn,
  registrarContrato,
  consultaContrato
};