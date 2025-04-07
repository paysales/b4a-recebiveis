const Cliente = Parse.Object.extend('Cliente');
const Config = Parse.Object.extend('Config');
const Opt = Parse.Object.extend('Opt');

const queryConfig    = new Parse.Query(Config);
queryConfig.equalTo('nome', 'cnpjSolicitante');
let config = queryConfig.first({ useMasterKey: true });
if (config == null) throw 'CONFIG_CNPJSOLICITANTE_INVALIDA';
const cnpjSolicitante = config.get('valor');

queryConfig.equalTo('nome', 'cnpjFinanciador');
config = queryConfig.first({ useMasterKey: true });
if (config == null) throw 'CONFIG_CNPJFINANCIADOR_INVALIDA';
const cnpjFinanciador = config.get('valor');


Parse.Cloud.define('v1-opt-in', async (req) => {
    const queryCliente = new Parse.Query(Cliente);
    const cliente = await queryCliente.get(req.params.clienteId, { useMasterKey: true });
    if (!cliente) throw 'CLIENTE_INVALIDO';

    const opt = new Opt();
    opt.set('cnpjSolicitante', cnpjSolicitante);
    opt.set('cnpjFinanciador', cnpjFinanciador);
    opt.set('cnpjCredenciadora  ', req.params.cnpjCredenciadora);
    opt.set('arranjoPagamento', req.params.arranjoPagamento);
    opt.set('dataAssinatura', req.params.dataAssinatura);
    opt.set('dataEfetivacao', req.params.dataEfetivacao);
    opt.set('dataExpiracao', req.params.dataExpiracao);
    await opt.save(null, { useMasterKey: true });

    // Mandar Opt-in para B3
    const Ur = Parse.Object.extend("Ur");
    const ursQuery = new Parse.Query(Ur);
    ursQuery.containedIn("objectId", req.params.ursIds);
    const urs = await ursQuery.find({ useMasterKey: true });

    if (urs.length !== req.params.ursIds.length) {
        throw "Um ou mais urs não encontrados.";
    }

    const ursParaSalvar = urs.map((ur) => {
        ur.set("pacote", pacote);
        return ur;
    });

    // 5. Salvar urs
    await Parse.Object.saveAll(ursParaSalvar, { useMasterKey: true });

    // 6. Atualizar o pacote com os pointers dos urs.
    const ursPointers = urs.map(ur => {
        return {
            __type: 'Pointer',
            className: 'Ur',
            objectId: ur.id
        }
    })

    pacote.set("urs", ursPointers);
    await pacote.save(null, { useMasterKey: true })

    return pacote;

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
