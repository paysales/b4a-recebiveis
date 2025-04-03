const axios = require("axios");
const https = require("https");

Parse.Cloud.define('v1-test-b3-login', async (req) => {
  return b3Login();
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

    const response = await b3API.post("https://api-balcao.b3.com.br/api/oauth/token", data, options);

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

module.exports = {
  b3Login,
};