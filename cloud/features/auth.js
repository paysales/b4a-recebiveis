const jwt = require('jsonwebtoken');
const brasilApi = require("./brasil_api.js");
const Cliente = Parse.Object.extend('Cliente');
const Conta = Parse.Object.extend('Conta');
const Oauth = Parse.Object.extend('OAuth');

Parse.Cloud.define('v1-login', async (req) => {
	const user = await Parse.User.logIn(req.params.username.toLowerCase().trim(), req.params.password);

	return formatUser(user.toJSON());
}, {
	fields: {
		username: {
			required: true
		},
		password: {
			required: true
		}
	}
});

Parse.Cloud.define('v1-get-me', async (req) => {
	return formatUser(req.user.toJSON()) || req.user;
});

Parse.Cloud.define('v1-sign-up2', async (req) => {
	const user = new Parse.User();
	user.set('username', req.params.cpf);
	user.set('password', req.params.senha);
	await user.signUp(null, { useMasterKey: true });
	return formatUser(user.toJSON());
}, {
	fields: {
		cpf: {
			required: true
		},
		senha: {
			required: true
		}
	}
});


Parse.Cloud.define('v1-sign-up', async (req) => {
	const user = new Parse.User();
	user.set('username', req.params.cpf);
	user.set('password', req.params.senha);
	user.set('cpf', req.params.cpf);
	user.set('email', req.params.email.toLowerCase());
	user.set('nomeCompleto', req.params.nomeCompleto);
	user.set('celular', req.params.celular);
	// user.set('selfie', req.params.selfie);
	await user.signUp(null, { useMasterKey: true });
	// await user.save(null, {useMasterKey: true});
	const user1 = await Parse.User.logIn(req.params.cpf, req.params.senha);

	// const cliente = new Cliente();
	// cliente.set('razaoSocial', req.params.razaoSocial);
	// cliente.set('cnpj', req.params.cnpj);
	// cliente.set('tipo', req.params.tipo);
	// cliente.set('telefone', req.params.telefone);
	// cliente.set('endereco', req.params.endereco);
	// cliente.set('numero', req.params.numero);
	// cliente.set('complemento', req.params.complemento);
	// cliente.set('bairro', req.params.bairro);
	// cliente.set('cidade', req.params.cidade);
	// cliente.set('uf', req.params.uf);
	// cliente.set('cep', req.params.cep);
	// cliente.set('banco', req.params.banco);
	// cliente.set('agencia', req.params.agencia);
	// cliente.set('conta', req.params.conta);
	// cliente.set('contaDigito', req.params.contaDigito);
	// cliente.set('ispb', req.params.ispb);
	// cliente.set('pix', req.params.pix);
	// cliente.set('cnae', req.params.cnae);
	// cliente.set('cnaeDescricao', req.params.cnaeDescricao);
	// cliente.set('admins', [user]);
	// cliente.set('owner', user);
	// await cliente.save(null, {useMasterKey: true});

	return formatUser(user1.toJSON());
}, {
	fields: {
		cpf: {
			required: true
		},
		senha: {
			required: true
		},
		email: {
			required: true
		},
		nomeCompleto: {
			required: true
		},
		celular: {
			required: true
		},
		// selfie: {
		// 	// required: true
		// },
		// tipo: {
		// 	required: true
		// },
		// telefone: {
		// 	required: true
		// },
		// endereco: {
		// 	required: true
		// },
		// numero: {
		// 	required: true
		// },
		// complemento: {
		// 	// required: true
		// },
		// bairro: {
		// 	required: true
		// },
		// cidade: {
		// 	required: true
		// },
		// uf: {
		// 	required: true
		// },
		// cep: {
		// 	required: true
		// },
		// banco: {
		// 	required: true
		// },
		// agencia: {
		// 	required: true
		// },
		// conta: {
		// 	required: true
		// },
		// contaDigito: {
		// 	required: true
		// },
		// razaoSocial: {
		// 	required: true
		// },
		// cnpj: {
		// 	required: true
		// },
		// ispb: {
		// 	// required: true
		// },
		// pix: {
		// 	// required: true
		// },
		// cnae: {
		// 	required: true
		// },
		// cnaeDescricao: {
		// 	required: true
		// }

	}
});
Parse.Cloud.define('v1-sign-up-all', async (req) => {
	const user = new Parse.User();
	user.set('username', req.params.cpf);
	user.set('password', req.params.password);
	user.set('cpf', req.params.cpf);
	user.set('email', req.params.email.toLowerCase());
	user.set('nomeCompleto', req.params.fullName);
	user.set('celular', req.params.cellPhone);
	// user.set('selfie', req.params.selfie);
	await user.signUp(null, { useMasterKey: true });

	//Dados da Conta
	const conta = new Conta();

	conta.set('bancoCod', req.params.bancoCod);
	conta.set('bancoNome', req.params.bancoNome);
	conta.set('agencia', req.params.agencia);
	conta.set('conta', req.params.conta);
	conta.set('contaDigito', req.params.contaDigito);
	conta.set('ispb', req.params.ispb);
	conta.set('pix', req.params.chavePix);
	await conta.save(null, { useMasterKey: true });

	//Dados do Cliente
	const cliente = new Cliente();
	cliente.set('status', 'pendente');
	cliente.set('razaoSocial', req.params.razaoSocial);
	cliente.set('nomeFantasia', req.params.nomeFantasia);
	cliente.set('cnpj', req.params.cnpj);
	cliente.set('cnae', req.params.cnae);
	cliente.set('cnaeDescricao', req.params.cnaeDescricao);

	cliente.set('endereco', req.params.endereco);
	cliente.set('numero', req.params.numero);
	cliente.set('complemento', req.params.complemento);
	cliente.set('bairro', req.params.bairro);
	cliente.set('cidade', req.params.cidade);
	cliente.set('uf', req.params.estado);
	cliente.set('cep', req.params.cep);

	cliente.set('ondeConheceu', req.params.whereSelected);
	// cliente.set('admins', [user]);
	cliente.set('owner', user);
	cliente.set('banco', conta);

	//vamos buscar as info da emprese

	const company = await brasilApi.getFullCNPJ(req.params.cnpj);
	if (company != null) {
		cliente.set('dtInicio', company.data_inicio_atividade);
		cliente.set('situacao', company.descricao_situacao_cadastral);
		cliente.set('descricaoMotivoSituacao', company.descricao_motivo_situacao);
		cliente.set('porte', company.porte);
		cliente.set('descricaoPorte', company.descricao_porte);
		cliente.set('capitalSocial', company.capital_social);
		cliente.set('naturezaJuridica', company.natureza_juridica);
		cliente.set('descricaoIdentificadorMatrizFilial', company.descricao_identificador_matriz_filial);
		cliente.set('opcaoMei', company.opcao_pelo_mei);
		cliente.set('opcaoSimples', company.opcao_pelo_simples);
		cliente.set('qualificacaoResponsavel', company.qualificacao_responsavel);
		cliente.set('socios', company.qsa);
		cliente.set('cnaesSecundarios', company.cnaes_secundarios);
	}

	await cliente.save(null, { useMasterKey: true });

	// return cliente.toJSON();
	return formatCliente(cliente.toJSON());

}, {
	fields: {

		cpf: {
			required: true
		},
		password: {
			required: true
		},
		email: {
			required: true
		},
		fullName: {
			required: true
		},
		cellPhone: {
			required: true
		},

		razaoSocial: {
			required: true
		},
		nomeFantasia: {
			required: true
		},
		cnpj: {
			required: true
		},
		cnae: {
			required: true
		},
		cnaeDescricao: {
			required: true
		},

		endereco: {
			required: true
		},
		numero: {
			required: true
		},
		complemento: {
			// required: true
		},
		bairro: {
			// required: true
		},
		cidade: {
			required: true
		},
		estado: {
			required: true
		},
		cep: {
			required: true
		},

		bancoCod: {
			required: true
		},
		bancoNome: {
			required: true
		},
		agencia: {
			required: true
		},
		conta: {
			required: true
		},
		contaDigito: {
			// required: true
		},
		ispb: {
			required: true
		},
		chavePix: {
			required: true
		},
	}
});


Parse.Cloud.define('v1-set-user-selfie', async (req) => {
	const user = req.user;

	const file = new Parse.File(user.id + '_arquivo.' + req.params.extensao, { base64: req.params.base64Arquivo });
	user.set('selfie', file);
	await user.save(null, { useMasterKey: true });

	return formatUser(user.toJSON());

}, {
	requireUser: true,
	fields: {
		base64Arquivo: {
			required: true
		},
		extensao: {
			required: true
		}
	}
});


Parse.Cloud.define('v1-remove-user-selfie', async (req) => {
	const user = req.user;

	await user.get('selfie').destroy({ useMasterKey: true });
	user.unset('selfie');
	await user.save(null, { useMasterKey: true });

	return formatUser(user.toJSON());
}, {
	requireUser: true,
});

function formatUser(u) {
	return {
		id: u.objectId,
		username: u.username,
		token: u.sessionToken,
		type: u.tipo,
		cpf: u.cpf,
		name: u.nomeCompleto,
		email: u.email,
		celular: u.celular,
		selfie: u.selfie != null ? u.selfie.url : undefined
	}
}

Parse.Cloud.define("v1-validar-senha", async (req) => {
	const user = req.user;
	const { password } = req.params;

	const passwordIsValid = await Parse.User.logIn(user.getUsername(), password);
	return passwordIsValid ? true : false;
}, {
	requireUser: true,
	fields: {
		password: {
			required: true
		}
	}
});


function formatCliente(u) {
	return {
		id: u.objectId,
		// razaoSocial: u.razaoSocial,
		// cnpj: u.cnpj,
		// tipo: u.tipo,
		// telefone: u.telefone,
		// endereco: u.endereco,
		// numero: u.numero,
		// complemento: u.complemento,
		// bairro: u.bairro,
		// cidade: u.cidade,
		// uf: u.uf,
		// cep: u.cep,
		// bancoCod: u.bancoCod,
		// bancoNome: u.bancoNome,
		// agencia: u.agencia,
		// conta: u.conta,
		// contaDigito: u.contaDigito,
		// ispb: u.ispb,
		// pix: u.pix,
		// ondeConheceu: u.ondeConheceu
	}
}

Parse.Cloud.define("generateAccessToken", async (request) => {
	const { clientId, clientSecret } = request.params;

	// 1. Recuperar o Client ID e Secret armazenados na collection OAuth
	const query = new Parse.Query(Oauth);
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
	const accessToken = generateRandomToken(); // Implemente sua lógica de geração de token
	const expiresIn = 86400; // Tempo de *expiração em segundos = 24 hrs.
	const tokenType = "Bearer";

	// 4. Salvar o Access Token (opcional, dependendo da sua necessidade de revogação, etc.)
	// await saveAccessToken(accessToken, expiresIn);

	// 5. Retornar o Access Token
	return {
		access_token: accessToken,
		token_type: tokenType,
		expires_in: expiresIn,
	};
});

// Função auxiliar para gerar um token aleatório
function generateRandomToken() {
	const length = 32;
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let token = '';
	for (let i = 0; i < length; i++) {
		token += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return token;
}

Parse.Cloud.define("generateB3WebhookToken", async (request) => {
	const b3Identifier = "b3-webhook-client"; // Um identificador único para a B3

	// Informações (payload) que você quer incluir no token
	const payload = {
		sub: b3Identifier, // "sub" (subject) é uma claim comum para identificar a entidade
		entityType: "B3",
		// Você pode adicionar outras informações relevantes aqui
	};

	// Chave secreta para assinar o JWT. Mantenha isso em um local seguro!
	const jwtSecret = process.env.JWT_SECRET; // Use uma variável de ambiente em produção

	// Opções do JWT (opcional)
	const options = {
		expiresIn: '24h', // Tempo de expiração do token (ex: 1 hora)
		issuer: 'PaySales:recebiveis',
		audience: 'b3'
	};

	try {
		const token = jwt.sign(payload, jwtSecret, options);
		return { accessToken: token };
	} catch (error) {
		console.error("Erro ao gerar JWT:", error);
		throw new Parse.Error(Parse.Error.ERROR, "Falha ao gerar o token de acesso.");
	}
});

function generateToken(payload, options) {
	const jwtSecret = process.env.JWT_SECRET; // Use a mesma chave secreta

	try {
		const token = jwt.sign(payload, jwtSecret, options);
		return { accessToken: token };
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

arse.Cloud.define("validateB3WebhookToken", async (request) => {
	const { token } = request.params;
	const jwtSecret = process.env.JWT_SECRET || "SUA_CHAVE_SECRETA_AQUI"; // Use a mesma chave secreta

	if (!token) {
		return { isValid: false, error: "Token não fornecido." };
	}

	try {
		const decoded = jwt.verify(token, jwtSecret);
		// Se a verificação for bem-sucedida, 'decoded' conterá o payload do token
		console.log("Token decodificado:", decoded);
		return { isValid: true, payload: decoded };
	} catch (error) {
		console.error("Erro ao validar JWT:", error);
		return { isValid: false, error: error.message };
	}
});

module.exports = {
	generateToken,
	validateToken
};