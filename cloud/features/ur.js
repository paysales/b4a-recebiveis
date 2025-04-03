const Cliente = Parse.Object.extend('Cliente');
const Ur = Parse.Object.extend('UR');
const Agenda = Parse.Object.extend('Agenda');
const Config = Parse.Object.extend('Config');

Parse.Cloud.define('v1-get-urs', async (req) => {
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('owner', req.user);
    const cliente = await queryCliente.first({ useMasterKey: true });
    if (!cliente) throw 'CLIENTE_INVALIDO';

    if (cliente.get('cnpj') != req.params.cpfCnpjOriginador) throw 'CLIENTE_INVALIDO';

    const queryAgenda = new Parse.Query(Agenda);
    queryAgenda.equalTo('cpfCnpjOriginador', req.params.cpfCnpjOriginador);
    const agenda = await queryAgenda.first({ useMasterKey: true });
    if (!agenda) throw 'AGENDA_INVALIDA';
    //validar que dataReferencia seja igual a data atual em formato aaaa-mm-dd
    const dataAtual = new Date().toISOString().split('T')[0];
    if (agenda.get('dataReferencia') != dataAtual) throw 'AGENDA_NAO_DISPONIVEL';

    const queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'Dias_UR');
    const config = await queryConfig.first({ useMasterKey: true });
    let diasUR = 0;
    if (config) diasUR = parseInt(config.get('valor'));

    const dataPrevistaLiquidacao = new Date();
    dataPrevistaLiquidacao.setDate(dataPrevistaLiquidacao.getDate() + diasUR);

    const limit = req.params.limit ?? 30;
    //buscar as ur
    const queryUr = new Parse.Query(Ur);
    queryUr.equalTo('cpfCnpjOriginador', req.params.cpfCnpjOriginador);
    queryUr.greaterThan('valorLivreTotal', 0);
    queryUr.greaterThanOrEqualTo('dataPrevistaLiquidacao', dataPrevistaLiquidacao.toISOString().split('T')[0]);
    queryUr.ascending('dataPrevistaLiquidacao');
    queryUr.limit(limit);
    queryUr.skip(limit * req.params.page);

    if (req.params.arranjo != null) {
        queryUr.equalTo('arranjo', req.params.arranjo);
    }
    if (req.params.cnpjCredenciadora != null) {
        queryUr.equalTo('cnpjCredenciadora', req.params.cnpjCredenciadora);
    }
    if (req.params.cnpjRegistradora != null) {
        queryUr.equalTo('cnpjRegistradora', req.params.cnpjRegistradora);
    }
    if (req.params.dataInicio != null) {
        queryUr.greaterThanOrEqualTo('numPrevistaLiquidacao', req.params.dataInicio);
    }
    if (req.params.dataFim != null) {
        queryUr.lessThanOrEqualTo('numPrevistaLiquidacao', req.params.dataFim);
    }

    const urs = await queryUr.find({ useMasterKey: true });

    return urs.map((n) => formatUR(n.toJSON()));

}, {
    requireUser: true,
    fields: {
        cpfCnpjOriginador: {
            required: true
        },
        page: {
            required: true
        },
        arranjo: {},
        cnpjCredenciadora: {},
        cnpjRegistradora: {},
        dataInicio: {},
        dataFim: {}
    }
});
Parse.Cloud.define('v1-get-urs-by-agenda', async (req) => {

    const queryAgenda = new Parse.Query(Agenda);
    queryAgenda.equalTo('objectId', req.params.agendaId);
    const agenda = await queryAgenda.first({ useMasterKey: true });
    if (!agenda) throw 'AGENDA_INVALIDA';
    //validar que dataReferencia seja igual a data atual em formato aaaa-mm-dd
    var dataRef = new Date();
    var numMilSeconds = dataRef.getTime();
    var horaMlSeconds = 60 * 60 * 1000;
    var dataAtual = new Date(numMilSeconds - (4 * horaMlSeconds)).toISOString().split('T')[0];
    if (agenda.get('dataReferencia') != dataAtual) throw 'AGENDA_NAO_DISPONIVEL';

    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('agenda', agenda);
    const cliente = await queryCliente.first({ useMasterKey: true });

    if (!cliente) throw 'CLIENTE_INVALIDO';

    const queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'Dias_UR');
    const config = await queryConfig.first({ useMasterKey: true });
    let diasUR = 0;
    if (config) diasUR = parseInt(config.get('valor'));

    const dataPrevistaLiquidacao = new Date();
    dataPrevistaLiquidacao.setDate(dataPrevistaLiquidacao.getDate() + diasUR);

    // const limit = req.params.limit ?? 30;
    //buscar as ur
    const queryUr = new Parse.Query(Ur);
    queryUr.equalTo('agenda', agenda);
    queryUr.greaterThan('valorLivreTotal', 0);
    queryUr.greaterThanOrEqualTo('dataPrevistaLiquidacao', dataPrevistaLiquidacao.toISOString().split('T')[0]);
    queryUr.ascending('dataPrevistaLiquidacao');
    // queryUr.limit(limit);
    // queryUr.skip(limit * req.params.page);

    if (req.params.arranjo != null) {
        var bandeira = req.params.arranjo.split(',').map((n) => n.trim());
        queryUr.containedIn('arranjo', bandeira);
    }
    if (req.params.cnpjCredenciadora != null) {
        queryUr.equalTo('cnpjCredenciadora', req.params.cnpjCredenciadora);
    }
    if (req.params.dataInicio != null && req.params.dataFim != null) {
        let dtInicio = new Date(req.params.dataInicio);
        let dtFim = new Date(req.params.dataFim);
        queryUr.greaterThanOrEqualTo('dataPrevistaLiquidacao', dtInicio.toISOString().split('T')[0]);
        queryUr.lessThanOrEqualTo('dataPrevistaLiquidacao', dtFim.toISOString().split('T')[0]);
    }

    // const urs = await queryUr.find({ useMasterKey: true });

    // Recuperar todos os registros utilizando find e um loop
    const urs = [];
    let results;
    let skip = 0;
    const limit = 1000; // Defina um limite maior, se necessário

    do {
        queryUr.skip(skip);
        queryUr.limit(limit);
        results = await queryUr.find({ useMasterKey: true });
        urs.push(...results);
        skip += results.length;
    } while (results.length === limit);

    const registrosSomados = [];
    if (req.params.valor != null) {
        let soma = 0;
        for (const registro of urs) {
            if (soma + registro.get("valorLivreTotal") <= req.params.valor) {
                registrosSomados.push(registro);
                soma += registro.get("valorLivreTotal");
            } else {
                registrosSomados.push(registro);
                soma += registro.get("valorLivreTotal");
                break;
            }
        }
        // return registrosSomados.map((n) => formatUR(n.toJSON()));
    } else {
        registrosSomados.push(...urs);
    }

    // Recuperar dados da busca
    const total = registrosSomados.length;
    const agendaId = req.params.agendaId;
    const dtInicio = registrosSomados.length > 0 ? registrosSomados[0].get('dataPrevistaLiquidacao') : null;
    const dtFim = registrosSomados.length > 0 ? registrosSomados[total - 1].get('dataPrevistaLiquidacao') : null;
    let valorLivreTotal = 0;
    let count = 0;
    let arranjos = [];
    let cnpjCredenciadoras = [];
    for (const registro of registrosSomados) {
        valorLivreTotal += registro.get("valorLivreTotal");
        count++;
        if (registro.get("valorLivreTotal") > 0) {
            if (!arranjos.includes(registro.get("arranjo"))) {
                arranjos.push(registro.get("arranjo"));
            }
            if (!cnpjCredenciadoras.includes(registro.get("cnpjCredenciadora"))) {
                cnpjCredenciadoras.push(registro.get("cnpjCredenciadora"));
            }
        }
    }

    // agenda.set('arranjos', arranjos);
    // agenda.set('cnpjCredenciadoras', cnpjCredenciadoras);
    // agenda.set('dtIni', dtInicio);
    // agenda.set('dtFim', dtFim);
    // await agenda.save(null, { useMasterKey: true });

    return {
        clienteCnpj: cliente.get('cnpj'),
        clienteRazaoSocial: cliente.get('razaoSocial'),
        agendaId,
        total,
        valorLivreTotal,
        arranjos,
        cnpjCredenciadoras,
        dtInicio,
        dtFim,
        urs: registrosSomados.map((n) => formatUR(n.toJSON()))
    };

    // return urs;
    // return urs.map((n) => formatUR(n.toJSON()));

}, {
    requireUser: true,
    fields: {
        agendaId: {
            required: true
        },
        valor: {},
        arranjo: {},
        cnpjCredenciadora: {},
        dataInicio: {},
        dataFim: {}
    }
});


function formatUR(n) {
    return {
        id: n.objectId,
        arranjo: n.arranjo,
        cnpjCredenciadora: n.cnpjCredenciadora,
        dataPrevistaLiquidacao: n.dataPrevistaLiquidacao,
        valorLivreTotal: n.valorLivreTotal
    }
}