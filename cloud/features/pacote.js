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
            className: 'UR',
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


Parse.Cloud.define("v1-get-vendor-pacotes", async (req) => {
    const user = req.user;
    if (user.get('type') !== 'Vendor') throw 'TIPO_USUARIO_VENDEDOR';
    const query = new Parse.Query(Pacote);
    query.include('vendedor');
    query.include('urs');
    const pacotes = await query.find({ useMasterKey: true });
    // return pacotes.map((c) => formatPacote(c.toJSON()));
    return pacotes.map(formatarPacote);
}, {
    requireUser: true
});


function formatarPacote(pacote) { // Renomeei 'c' para 'pacote' para maior clareza
    const ursData = pacote.get('urs') ? pacote.get('urs').map((urObject) => ({
        id: urObject.id,
        arranjo: urObject.get('arranjo'),
        cnpjCredenciadora: urObject.get('cnpjCredenciadora'),
        dataPrevistaLiquidacao: urObject.get('dataPrevistaLiquidacao'),
        valorLivreTotal: urObject.get('valorLivreTotal')
    })) : [];

    const vendedor = pacote.get('vendedor');
    const vendedorData = vendedor ? {
        id: vendedor.id,
        razaoSocial: vendedor.get('razaoSocial'),
        cnpj: vendedor.get('cnpj')
    } : null;

    return {
        id: pacote.id,
        clienteId: vendedorData ? vendedorData.id : null,
        clienteNome: vendedorData ? vendedorData.razaoSocial : null,
        clienteCNPJ: vendedorData ? vendedorData.cnpj : null,
        status: pacote.get('status'),
        valorBruto: pacote.get('valorBruto'),
        prazoMedioPonderado: pacote.get('prazoMedioPonderado'),
        taxaMes: pacote.get('taxaMes'),
        desconto: pacote.get('desconto'),
        valorLiquido: pacote.get('valorLiquido'),
        urs: ursData
    };
}



function formatPacote(c) {
    const ursData = c.urs ? c.urs.map((ur) => ({
        id: ur.id,
        arranjo: ur.arranjo,
        cnpjCredenciadora: ur.cnpjCredenciadora,
        dataPrevistaLiquidacao: ur.dataPrevistaLiquidacao,
        valorLivreTotal: ur.valorLivreTotal
    })) : [];
    return {
        id: c.objectId,
        clienteId: c.vendedor.id,
        clienteNome: c.vendedor.razaoSocial,
        clienteCNPJ: c.vendedor.cnpj,
        valorBruto: c.valorBruto,
        prazoMedioPonderado: c.prazoMedioPonderado,
        taxaMes: c.taxaMes,
        desconto: c.desconto,
        valorLiquido: c.valorLiquido,
        urs: ursData
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
