const Pacote = Parse.Object.extend('Pacote');
const Cliente = Parse.Object.extend('Cliente');

Parse.Cloud.define('v1-create-cliente', async (req) => {
	const cliente = new Cliente();
	cliente.set('razaoSocial', req.params.razaoSocial);
	cliente.set('cnpj', req.params.cnpj);
	cliente.set('admins', req.params.admins);
	await cliente.save(null, { useMasterKey: true });
	return formatCliente(cliente.toJSON());

}, {
	fields: {
		razaoSocial: {},
		cnpj: {},

	}
});

async function getClientes(user) {
	const query = new Parse.Query(Cliente);
	if (!user) throw 'USUARIO_OBRIGATORIO';

	// query.equalTo('owner', user);
	query.equalTo('admins', user);
	// query.matchesQuery("admins", user);
	query.include('agenda');
	query.ascending('razaoSocial');
	const results = await query.find({ useMasterKey: true });
	return results.map((r) => formatClienteListAgenda(r.toJSON()));
}

Parse.Cloud.define('v1-get-clientes', async (req) => {
	return await getClientes(req.user);
}, {
	requireUser: true
});


Parse.Cloud.define('v1-get-hp-buyer', async (req) => {
	if (!req.user) throw 'USUARIO_OBRIGATORIO';

	const query = new Parse.Query(Cliente);
	query.equalTo('admins', req.user);
	const cliente = await query.first({ useMasterKey: true });
	if (!cliente) throw 'CLIENTE_INVALIDO';

	const queryPacote = new Parse.Query(Pacote);
	queryPacote.equalTo('comprador', cliente);
	queryPacote.include('urs');
	const pacotes = await queryPacote.find({ useMasterKey: true });

	const dataRef = new Date();
	const numMilSeconds = dataRef.getTime();
	const horaMlSeconds = 60 * 60 * 1000;
	const dataAtual = new Date(numMilSeconds - (4 * horaMlSeconds)).toISOString().split('T')[0];

	var valorTotal = 0.0;
	var valorHoje = 0.0;
	for (const p of pacotes) {
		valorTotal += p.get('valorBruto');
		const urs = p.get('urs');
		if (urs) {
			const queryUr = new Parse.Query(Ur);
			queryUr.equalTo('dataPrevistaLiquidacao', dataAtual);
			const ursHoje = await queryUr.find({ useMasterKey: true });
			if (ursHoje.length > 0) {
				valorHoje += p.get('valorBruto');
			}
		}
	}
	const listUrs = pacotes.map(p => p.get('urs'));



	const uniqueUrs = Array.from(new Set(listUrs));

	return pacotes.map(formatarPacote);
}, {
	requireUser: true,
});

// Parse.Cloud.define('v1-get-cliente', async (req) => {
// 	const query = new Parse.Query(Cliente);
// 	// query.include('admins');
// 	if (req.params.adminId) {
// 		const user = new Parse.User();
// 		user.id = req.params.adminId;
// 		query.equalTo('admins', user);
// 	} else {
// 		query.equalTo('owner', req.user);
// 	}

// 	// query.include('admins');
// 	const results = await query.find({ useMasterKey: true });

// 	// return results;

// 	return results.map((r) => formatClienteList(r.toJSON()));


// }, {
// 	requireUser: true,
// 	fields: {
// 		adminId: {}
// 	}
// });

Parse.Cloud.define('v1-get-cliente', async (req) => {
	const query = new Parse.Query(Cliente);
	query.include('admins');

	const result = await query.get(req.params.clienteId, { useMasterKey: true });

	return formatCliente(result.toJSON());


}, {
	requireUser: true,
	fields: {
		clienteId: {}
	}
});

Parse.Cloud.define('v1-edit-cliente', async (req) => {

	const queryCliente = new Parse.Query(Cliente);
	const cliente = await queryCliente.get(req.params.clienteId, { useMasterKey: true });

	if (req.user.id != cliente.get('owner').id && !cliente.get('admins').some((u) => u.id == req.user.id)) throw 'CLIENTE_INVALIDO';

	cliente.set('razaoSocial', req.params.razaoSocial);
	cliente.set('cnpj', req.params.cnpj);
	cliente.set('telefone', req.params.telefone);
	cliente.set('endereco', req.params.endereco);
	cliente.set('numero', req.params.numero);
	cliente.set('complemento', req.params.complemento);
	cliente.set('bairro', req.params.bairro);
	cliente.set('cidade', req.params.cidade);
	cliente.set('uf', req.params.uf);
	cliente.set('cep', req.params.cep);
	cliente.set('banco', req.params.banco);
	cliente.set('agencia', req.params.agencia);
	cliente.set('conta', req.params.conta);
	cliente.set('contaDigito', req.params.contaDigito);
	cliente.set('ispb', req.params.ispb);
	cliente.set('pix', req.params.pix);
	cliente.set('cnae', req.params.cnae);
	cliente.set('cnaeDescricao', req.params.cnaeDescricao);

	await cliente.save(null, { useMasterKey: true });

	return await getCliente(cliente.id);

}, {
	requireUser: true,
	fields: {
		clienteId: {
			required: true
		},
		razaoSocial: {
			required: true
		},
		cnpj: {
			required: true
		}
	}
});

Parse.Cloud.define('v1-set-cliente-arquivo', async (req) => {
	const queryCliente = new Parse.Query(Cliente);
	const cliente = await queryCliente.get(req.params.clienteId, { useMasterKey: true });
	if (!cliente) throw 'CLIENTE_INVALIDO';

	const file = new Parse.File(cliente.id + '_arquivo.' + req.params.extensao, { base64: req.params.base64Arquivo });
	cliente.set('arquivo', file);
	await cliente.save(null, { useMasterKey: true });

	return await getCliente(cliente.id);

}, {
	requireUser: true,
	fields: {
		clienteId: {
			required: true
		},
		base64Arquivo: {
			required: true
		},
		extensao: {
			required: true
		}
	}
});

Parse.Cloud.define('v1-remove-cliente-arquivo', async (req) => {
	const queryCliente = new Parse.Query(Cliente);
	const cliente = await queryCliente.get(req.params.clienteId, { useMasterKey: true });
	if (!cliente) throw 'CLIENTE_INVALIDO';

	await cliente.get('arquivo').destroy({ useMasterKey: true });
	cliente.unset('arquivo');
	await cliente.save(null, { useMasterKey: true });

	return await getCliente(cliente.id);

}, {
	requireUser: true,
	fields: {
		clienteId: {
			required: true
		}
	}
});

async function getCliente(clienteId) {
	const query = new Parse.Query(Cliente);
	query.include('admins');
	query.include('agenda');
	const result = await query.get(clienteId, { useMasterKey: true });




	return formatCliente(result.toJSON());
}

function formatAdmin(a) {
	return {
		id: a.objectId,
		nome: a.nomeCompleto
	}
}

function formatCliente(data) {
	return {
		id: data.objectId,
		razaoSocial: data.razaoSocial,
		cnpj: data.cnpj,
		nomeFantasia: data.nomeFantasia,

		endereco: data.endereco,
		numero: data.numero,
		complemento: data.complemento,
		bairro: data.bairro,
		cidade: data.cidade,
		uf: data.uf,
		cep: data.cep,
		// banco: data.banco,
		// agencia: data.agencia,
		// conta: data.conta,
		// contaDigito: data.contaDigito,
		// ispb: data.ispb,
		// pix: data.pix,
		cnae: data.cnae,
		cnaeDescricao: data.cnaeDescricao,
		arquivo: data.arquivo != null ? data.arquivo.url : undefined,
		admins: data.admins.map((a) => formatAdmin(a))
	}
}

function formatClienteList(data) {
	return {
		id: data.objectId,
		razaoSocial: data.razaoSocial,
		cnpj: data.cnpj,
		nomeFantasia: data.nomeFantasia,
		cnae: data.cnae,
		cnaeDescricao: data.cnaeDescricao,
	}
}

function formatClienteListAgenda(data) {

	var dataRef = new Date();
	var numMilSeconds = dataRef.getTime();
	var horaMlSeconds = 60 * 60 * 1000;
	var dataAtual = new Date(numMilSeconds - (4 * horaMlSeconds)).toISOString().split('T')[0];

	return {
		id: data.objectId,
		razaoSocial: data.razaoSocial,
		cnpj: data.cnpj,
		nomeFantasia: data.nomeFantasia,
		cnae: data.cnae,
		cnaeDescricao: data.cnaeDescricao,
		agenda: (data.agenda != null && data.agenda.dataReferencia == dataAtual) ? formatAgenda(data.agenda) : undefined
	}
}

function formatAgenda(a) {
	return {
		id: a.objectId,
		dataHoraRecepcao: a.dataHoraRecepcao.iso,
		dataReferencia: a.dataReferencia,
		valorLivreTotal: a.valorLivreTotal,
		arranjos: a.arranjos,
		cnpjCredenciadoras: a.cnpjCredenciadoras,
		dtIni: a.dtIni,
		dtFim: a.dtFim
	}
}

function formatUser(u) {
	return {
		id: u.objectId,
		token: u.sessionToken,
		cpf: u.CPF,
		nomeCompleto: u.nomeCompleto,
		email: u.email,
		celular: u.celular,
		selfie: u.selfie != null ? u.selfie.url : undefined
	}
}


// Helper function to format dates
function getTodayDateFormatted() {
	const now = new Date();
	return now.toISOString().slice(2, 10).replace(/-/g, ''); // Formats date to yymmdd
}

module.exports = {
	getClientes
};
