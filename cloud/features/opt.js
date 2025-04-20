const Cliente = Parse.Object.extend('Cliente');
const Config = Parse.Object.extend('Config');
const Opt = Parse.Object.extend('Opt');
const B3 = require("./b3.js");


Parse.Cloud.define('v1-opt-in', async (req) => {

    const queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'cnpjSolicitante');
    var config = await queryConfig.first({ useMasterKey: true });
    if (config == null) throw 'CONFIG_CNPJSOLICITANTE_INVALIDA';
    const cnpjSolicitante = config.get('valor');


    queryConfig.equalTo('nome', 'cnpjFinanciador');
    config = await queryConfig.first({ useMasterKey: true });
    if (config == null) throw 'CONFIG_CNPJFINANCIADOR_INVALIDA';
    const cnpjFinanciador = config.get('valor');

    // const queryCliente = new Parse.Query(Cliente);
    // const cliente = await queryCliente.get(req.params.clienteId, { useMasterKey: true });
    const cliente = new Cliente();
    cliente.id = req.params.clienteId;
    await cliente.fetch({ useMasterKey: true });
    if (!cliente) throw 'CLIENTE_INVALIDO';

    // Salvar Opt
    const opt = new Opt();
    opt.set('cliente', cliente);
    opt.set('codigoExterno', cliente.id);
    opt.set('cnpjSolicitante', cnpjSolicitante);
    opt.set('cnpjFinanciador', cnpjFinanciador);
    opt.set('cnpjCredenciadora', req.params.cnpjCredenciadora);
    opt.set('documentoUsuarioFinalRecebedor', cliente.get('cnpj'));
    opt.set('arranjoPagamento', req.params.arranjoPagamento);
    opt.set('dataAssinatura', req.params.dataAssinatura);
    opt.set('dataEfetivacao', req.params.dataEfetivacao);
    opt.set('dataExpiracao', req.params.dataExpiracao);
    await opt.save(null, { useMasterKey: true });

    const data = {
        codigoExterno: cliente.id,
        cnpjSolicitante: cnpjSolicitante,
        cnpjFinanciador: cnpjFinanciador,
        cnpjCredenciadora: req.params.cnpjCredenciadora,
        documentoUsuarioFinalRecebedor: cliente.get('cnpj'),
        arranjoPagamento: req.params.arranjoPagamento,
        dataAssinatura: req.params.dataAssinatura,
        dataEfetivacao: req.params.dataEfetivacao,
        dataExpiracao: req.params.dataExpiracao,
        documentoTitular: ""
    };

    // Mandar Opt-in para B3
    const response = await B3.optIn(data);

    return response;
    // const Ur = Parse.Object.extend("Ur");
    // const ursQuery = new Parse.Query(Ur);
    // ursQuery.containedIn("objectId", req.params.ursIds);
    // const urs = await ursQuery.find({ useMasterKey: true });

    // if (urs.length !== req.params.ursIds.length) {
    //     throw "Um ou mais urs não encontrados.";
    // }

    // const ursParaSalvar = urs.map((ur) => {
    //     ur.set("pacote", pacote);
    //     return ur;
    // });

    // // 5. Salvar urs
    // await Parse.Object.saveAll(ursParaSalvar, { useMasterKey: true });

    // // 6. Atualizar o pacote com os pointers dos urs.
    // const ursPointers = urs.map(ur => {
    //     return {
    //         __type: 'Pointer',
    //         className: 'Ur',
    //         objectId: ur.id
    //     }
    // })

    // pacote.set("urs", ursPointers);
    // await pacote.save(null, { useMasterKey: true })

    // return pacote;

}, {
    requireUser: true,
    fields: {
        clienteId: {
            required: true
        },
        cnpjCredenciadora: {},
        arranjoPagamento: {},
        dataAssinatura: {
            required: true
        },
        dataEfetivacao: {
            required: true
        },
        dataExpiracao: {
            required: true
        }
    }
});
