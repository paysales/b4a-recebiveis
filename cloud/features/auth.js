const brasilApi = require("./brasil_api.js");
const sftp = require("./sftp_homol.js");
const Cliente = Parse.Object.extend('Cliente');
const Conta = Parse.Object.extend('Conta');
const Device = Parse.Object.extend('Device');
const Notification = Parse.Object.extend('Notification');

const Recipient = require("mailersend").Recipient;
const EmailParams = require("mailersend").EmailParams;
const MailerSend = require("mailersend").MailerSend;
const Sender = require("mailersend").Sender;

const resetPasswordMaxTime = 1000 * 60 * 60; // 1 hora

const mailersend = new MailerSend({
	apiKey: process.env.MAILERSEND_KEY,
});

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

	await user.signUp(null, { useMasterKey: true });
	const fileFrente = new Parse.File(user.id + '_docFrente', { base64: req.params.docFrente });
	user.set('docFrente', fileFrente);
	const fileVerso = new Parse.File(user.id + '_docVerso', { base64: req.params.docVerso });
	user.set('docVerso', fileVerso);
	const fileVideo = new Parse.File(user.id + '_docVideo', { base64: req.params.capturedVideo });
	user.set('selfie', fileVideo);
	await user.save(null, { useMasterKey: true });

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

Parse.Cloud.define('v1-set-user-docs', async (req) => {
	const user = req.user;

	const fileFrente = new Parse.File(user.id + '_arquivo.' + req.params.extensao, { base64: req.params.docFrente });
	user.set('docFrente', fileFrente);

	const fileVerso = new Parse.File(user.id + '_arquivo.' + req.params.extensao, { base64: req.params.docVerso });
	user.set('docVerso', fileVerso);

	await user.save(null, { useMasterKey: true });

	return formatUser(user.toJSON());

}, {
	requireUser: true,
	fields: {
		docFrente: {
			required: true
		},
		docVerso: {
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
		status: u.status,
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

Parse.Cloud.afterDelete('_User', async (request) => {
	const user = request.object;

	const queryDevices = new Parse.Query(Device);
	queryDevices.equalTo('user', user);
	const devices = await queryDevices.find({ useMasterKey: true });

	await Parse.Object.destroyAll(devices, { useMasterKey: true });

	const queryNotifications = new Parse.Query(Notification);
	queryNotifications.equalTo('user', user);
	const notifications = await queryNotifications.find({ useMasterKey: true });

	await Parse.Object.destroyAll(notifications, { useMasterKey: true });

	//Clients emque ele é administrador ?
	const Cliente = Parse.Object.extend("Cliente");
	const queryCliente = new Parse.Query(Cliente);
	queryCliente.contains('admins', user);
	const clientes = await queryCliente.find({ useMasterKey: true });

	if (clientes.length > 0) {
		const promisesAtualizacao = clientes.map(async (cliente) => {
			const relation = cliente.relation("admin");
			relation.remove(user);
			await cliente.save(null, { useMasterKey: true });

			// Após remover o usuário, verifica se a relation 'admin' está vazia
			const queryAdmins = relation.query();
			const adminsRestantes = await queryAdmins.count({ useMasterKey: true });

			if (adminsRestantes === 0) {
				// Se não há mais admins, apaga o cliente
				//Buscar agendas
				const queryAgenda = new Parse.Query(Agenda);
				queryAgenda.equalTo('cliente', cliente);
				const agendas = await queryAgenda.find({ useMasterKey: true });
				for (const agenda of agendas) {
					//pagar as Urs
					await sftp.deleteAllRelatedURRecords(agenda);
					await agenda.destroy({ useMasterKey: true });
				}
				// await cliente.destroy({ useMasterKey: true });
				//Contratos
				// const queryContrato = new Parse.Query(Contrato);
				// queryContrato.equalTo('cliente', cliente);
				// const contratos = await queryContrato.find({ useMasterKey: true });
				// await Parse.Object.destroyAll(contratos, { useMasterKey: true });

			}
		});
		await Promise.all(promisesAtualizacao);
	}
});


Parse.Cloud.define('v1-delete-account', async (req) => {
	const user = await Parse.User.logIn(req.user.getUsername(), req.params.password);
	await user.destroy({ useMasterKey: true });
}, {
	fields: {
		password: {
			required: true
		}
	},
	requireUser: true
});


Parse.Cloud.define("v1-request-password-reset", async (req) => {
	const queryUser = new Parse.Query(Parse.User);
	queryUser.equalTo("username", req.params.username);
	const user = await queryUser.first({ useMasterKey: true });
	if (user) {
		const code = getRndInt(100000, 999999);
		user.set('resetPasswordCode', code);
		user.set('resetPasswordDateTime', new Date());
		user.set('resetPasswordAttempts', 0);
		await user.save(null, { useMasterKey: true });

		// await sendResetPasswordCode(user.get('fullname'), user.get('email'), code);
	}
}, {
	fields: {
		username: {
			required: true
		}
	}
});


Parse.Cloud.define("v1-set-new-password", async (req) => {
	const queryUser = new Parse.Query(Parse.User);
	queryUser.equalTo("username", req.params.username);
	const user = await queryUser.first({ useMasterKey: true });
	if (!user) {
		throw 'CODIGO_INVALIDO';
	}

	if (user.get('resetPasswordCode') != req.params.code || user.get('resetPasswordAttempts') >= 5) {
		user.increment('resetPasswordAttempts');
		await user.save(null, { useMasterKey: true });
		if (user.get('resetPasswordAttempts') >= 5) {
			throw 'EXCEDEU_NUM_TENTATIVAS';
		} else {
			throw 'CODIGO_INVALIDO';
		}
	} else if (new Date() - user.get('resetPasswordDateTime') > resetPasswordMaxTime) {
		throw 'EXCEDEU_TEMPO_MAXIMO';
	} else {
		user.set('password', req.params.password);
		user.unset('resetPasswordCode');
		user.unset('resetPasswordDateTime');
		user.unset('resetPasswordAttempts');
		await user.save(null, { useMasterKey: true });
	}
}, {
	fields: {
		username: {
			required: true
		},
		code: {
			required: true
		},
		password: {
			required: true
		}
	}
});

function getRndInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendResetPasswordCode(userName, userEmail, code) {
	// const recipients = [new Recipient(userEmail, userName)];
	const recipients = [new Recipient("dev@paysales.com.br", userName)];

	const sentFrom = new Sender("dev@paysales.com.br", "Paysales");

	const personalization = [
		{
			email: "dev@paysales.com.br",
			data: {
				code: code,
				name: userName
			},
		}
	];

	const emailParams = new EmailParams()
		.setFrom(sentFrom)
		.setTo(recipients)
		.setTemplateId('jpzkmgq8xv2g059v')
		.setPersonalization(personalization);

	await mailersend.email.send(emailParams);
}

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
