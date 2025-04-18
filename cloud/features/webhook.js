
const jwt = require('jsonwebtoken');
const oauth = Parse.Object.extend('OAuth');


function generateToken(payload, options) {
    const jwtSecret = process.env.JWT_SECRET; // Use a mesma chave secreta

    try {
        const token = jwt.sign(payload, jwtSecret, options);
        return token;
    } catch (error) {
        console.error("Erro ao gerar JWT:", error);
        throw new Parse.Error(Parse.Error.ERROR, "Falha ao gerar o token de acesso.");
    }
}

function validateToken(token) {
    const jwtSecret = process.env.JWT_SECRET; // Use a mesma chave secreta

    if (!token) {
        return { isValid: false, error: "Token não fornecido." };
    }
    console.log("Token a ser validado:", token);
    try {
        const decoded = jwt.verify(token, jwtSecret);
        // Se a verificação for bem-sucedida, 'decoded' conterá o payload do token
        console.log("Token decodificado:", decoded);
        return { isValid: true, payload: decoded };
    } catch (error) {
        console.error("Erro ao validar JWT:", error);
        return { isValid: false, error: error.message };
    }
}




Parse.Cloud.define('webhook', async (req) => {
    if (req.user == null) throw 'USER_NOT_FOUND';
    if (req.user.id != 'kdETA7qa25') throw 'USER_NOT_AUTHORIZED';
    return 'Olá desde a back4app da AppSales.....'
}, {
    requireUser: true
});

Parse.Cloud.define('webhook-auth', async (req) => {

    const { client_id, client_secret } = req.params;


    // 1. Recuperar o Client ID e Secret armazenados na collection OAuth
    const query = new Parse.Query(oauth);
    query.equalTo("client_id", client_id);
    const keys = await query.first({ useMasterKey: true });
    if (!keys) {
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Credenciais inválidas.");
    }
    const storedClientId = keys.get("client_id");
    const storedClientSecret = keys.get("client_secret");

    // 2. Validar as credenciais
    if (client_id !== storedClientId || client_secret !== storedClientSecret) {
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Credenciais inválidas.");
    }

    // 3. Gerar um Access Token único e seguro
    const source = keys.get("source");
    const Identifier = `${source}-webhook-client`;

    // Informações (payload) que você quer incluir no token
    const payload = {
        sub: Identifier, // "sub" (subject) é uma claim comum para identificar a entidade
        entityType: source.toUpperCase(),
        // Você pode adicionar outras informações relevantes aqui
    };

    const expiresIn = 86400; // Tempo de *expiração em segundos = 24 hrs.
    // Opções do JWT (opcional)
    const options = {
        expiresIn: expiresIn, // Tempo de expiração do token (ex: 1 hora)
        issuer: 'PaySales:recebiveis',
        audience: source
    };

    const accessToken = auth.generateToken(payload, options); // Implemente sua lógica de geração de token
    return {
        accessToken: accessToken,
        tokenType: "Bearer",
        expiresIn: expiresIn,
    };
}, {
    fields: {
        client_id: {
            required: true
        },
        client_secret: {
            required: true
        }
    }
});

Parse.Cloud.define('webhook-validate', async (req) => {

    // if (req.user == null) throw 'USER_NOT_FOUND';
    // if (req.user.id != 'kdETA7qa25') throw 'USER_NOT_AUTHORIZED';

    const authorizationHeader = req.headers["authorization"];

    if (!authorizationHeader) {
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Token de acesso não fornecido.");
    }

    const parts = authorizationHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Formato de token inválido.");
    }
    const accessToken = parts[1];

    const validationResult = await auth.validateToken(accessToken);

    if (!validationResult.isValid) {
        console.error("Token inválido:", validationResult.error);
        throw new Parse.Error(Parse.Error.UNAUTHORIZED, "Token de acesso inválido.");
    }

    const b3Info = validationResult.payload;
    console.log("Informações da B3 do token:", b3Info);

    // Agora você pode processar a requisição do webhook com a garantia de que ela (teoricamente) veio da B3

    return { success: true, message: "Webhook recebido e processado com sucesso.", info: b3Info };
});

