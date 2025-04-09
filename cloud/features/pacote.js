const Cliente = Parse.Object.extend('Cliente');
const Agenda = Parse.Object.extend('Agenda');
const Ur = Parse.Object.extend('UR');
const Config = Parse.Object.extend('Config');
const Pacote = Parse.Object.extend('Pacote');

Parse.Cloud.define('v1-create-pacote', async (req) => {
    const queryAgenda = new Parse.Query(Agenda);
    const agenda = await queryAgenda.get(req.params.agendaId, { useMasterKey: true });
    if (!agenda) throw 'AGENDA_INVALIDA';

    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('cnpj', agenda.get('cpfCnpjOriginador'));
    const cliente = await queryCliente.first({ useMasterKey: true });
    if (!cliente) throw 'CLIENTE_INVALIDO';

    const pacote = new Pacote();
    pacote.set('vendedor', cliente);
    pacote.set('valorBruto', req.params.valorBruto);
    pacote.set('prazoMedioPonderado', req.params.prazoMedioPonderado);
    pacote.set('taxaMes', req.params.taxaMes);
    pacote.set('desconto', req.params.desconto);
    pacote.set('valorLiquido', req.params.valorLiquido);
    await pacote.save(null, { useMasterKey: true });


    // 4. Buscar urs e atualizar o campo pacote
    // const Ur = Parse.Object.extend("Ur");
    // const ursQuery = new Parse.Query(Ur);

    var urs = [];

    for (const urId of req.params.ursIds) {
        const ur = new Ur();
        ur.id = urId;
        await ur.fetch({ useMasterKey: true });
        if (!ur) throw 'UR_INVALIDA';
        urs.push(ur);
    }
    // ursQuery.containedIn("id", req.params.ursIds);
    // const urs = await ursQuery.find({ useMasterKey: true });

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
        agendaId: {
            required: true
        },
        valorBruto: {
            required: true
        },
        prazoMedioPonderado: {
            required: true
        },
        taxaMes: {
            required: true
        },
        desconto: {
            required: true
        },
        valorLiquido: {
            required: true
        },
        ursIds: {
            required: true
        }
    }
});

function formatPacote(c) {
    return {
        id: c.objectId,
        clienteId: c.vendedor.id,
        clienteNome: c.vendedor.razaoSocial,
        clienteCNPJ: c.vendedor.cnpj,
        valorBruto: c.valorBruto,
        parazoMedioPonderado: c.prazoMedioPonderado,
        taxaMes: c.taxaMes,
        desconto: c.desconto,
        valorLiquido: c.valorLiquido,
        urs: c.urs.map((n) => formatUR(n.toJSON()))
    }
}

function formatUR(n) {
    return {
        id: n.objectId,
        arranjo: n.arranjo,
        cnpjCredenciadora: n.cnpjCredenciadora,
        dataPrevistaLiquidacao: n.dataPrevistaLiquidacao,
        valorLivreTotal: n.valorLivreTotal
    }
}
