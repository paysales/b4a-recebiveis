
const auth = require("./auth.js");
const oauth = Parse.Object.extend('OAuth');


Parse.Cloud.define('/oauth/token', async (req) => {

    const { clientId, clientSecret } = req.params;

    // 1. Recuperar o Client ID e Secret armazenados na collection OAuth
    const query = new Parse.Query(oauth);
    query.equalTo("clientId", clientId);
    const oauth = await query.first({ useMasterKey: true });
    if (!oauth) {
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Credenciais inválidas.");
    }
    const storedClientId = oauth.get("clientId");
    const storedClientSecret = oauth.get("clientSecret");

    // 2. Validar as credenciais
    if (clientId !== storedClientId || clientSecret !== storedClientSecret) {
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Credenciais inválidas.");
    }

    // 3. Gerar um Access Token único e seguro
    const source = oauth.get("source");
    const Identifier = `${source}-webhook-client`;

    // Informações (payload) que você quer incluir no token
    const payload = {
        sub: Identifier, // "sub" (subject) é uma claim comum para identificar a entidade
        entityType: source.toUpperCase(),
        // Você pode adicionar outras informações relevantes aqui
    };

    // Chave secreta para assinar o JWT. Mantenha isso em um local seguro!
    const jwtSecret = process.env.JWT_SECRET; // Use uma variável de ambiente em produção

    // Opções do JWT (opcional)
    const options = {
        expiresIn: '24h', // Tempo de expiração do token (ex: 1 hora)
        issuer: 'PaySales:recebiveis',
        audience: source
    };

    const accessToken = auth.generateToken(payload, options); // Implemente sua lógica de geração de token
    return {
        accessToken
    };
}, {
    fields: {
        clientId: {
            required: true
        },
        clientSecret: {
            required: true
        }
    }
});
