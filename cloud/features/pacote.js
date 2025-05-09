const Contrato = require("./contrato.js");
const Cliente = Parse.Object.extend('Cliente');
const Agenda = Parse.Object.extend('Agenda');
const Ur = Parse.Object.extend('UR');
const UrPacote = Parse.Object.extend('URPacote');
const Config = Parse.Object.extend('Config');
const Pacote = Parse.Object.extend('Pacote');
const TaxaContrato = Parse.Object.extend('TaxaContrato');

Parse.Cloud.define('v1-create-pacote', async (req) => {
    // const queryAgenda = new Parse.Query(Agenda);
    // const agenda = await queryAgenda.get(req.params.agendaId, { useMasterKey: true });

    const agenda = new Agenda();
    agenda.id = req.params.agendaId;
    await agenda.fetch({ useMasterKey: true });
    if (!agenda) throw 'AGENDA_INVALIDA';

    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('cnpj', agenda.get('cpfCnpjOriginador'));
    const cliente = await queryCliente.first({ useMasterKey: true });
    if (!cliente) throw 'CLIENTE_INVALIDO';

    const valorBruto = req.params.valorBruto;
    //taxa de contrato
    const queryTaxaContrato = new Parse.Query(TaxaContrato);
    // Busca todas as faixas onde o valor inicial é menor ou igual ao valor do contrato
    queryTaxaContrato.lessThanOrEqualTo("valorInicial", valorBruto);
    // Ordena as faixas em ordem decrescente pelo valor inicial
    queryTaxaContrato.descending("valorInicial");
    // Limita o resultado a 1 para pegar a faixa com o maior valor inicial
    queryTaxaContrato.limit(1);
    let taxa = 0;
    try {
        const faixaEncontrada = await queryTaxaContrato.first({ useMasterKey: true });

        if (faixaEncontrada) {
            taxa = faixaEncontrada.get("taxa");
        } else {
            throw 'TAXA_CONTRATO_INVALIDA';
        }
    } catch (error) {
        throw error;
    }

    const pacote = new Pacote();
    pacote.set('vendedor', cliente);
    pacote.set('valorBruto', parseFloat(req.params.valorBruto.toFixed(2)));
    pacote.set('prazoMedioPonderado', req.params.prazoMedioPonderado);
    pacote.set('taxaMes', parseFloat(req.params.taxaMes.toFixed(2)));
    pacote.set('desconto', parseFloat(req.params.desconto.toFixed(2)));
    pacote.set('valorLiquido', parseFloat(req.params.valorLiquido.toFixed(2)));
    pacote.set('taxaContratoPaySales', taxa);
    pacote.set("estrelas", req.params.estrelas);
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
    //buscar as credenciadoras
    let credenciadoras = [];
    const ursParaSalvar = urs.map((ur) => {
        credenciadoras.push(ur.get('cnpjCredenciadora'));
        ur.set("pacote", pacote);
        return ur;
    });
    credenciadoras = Array.from(new Set(credenciadoras));

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
    pacote.set('credenciadoras', credenciadoras);
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
        estrelas: {
            required: true
        },
        ursIds: {
            required: true
        }
    }
});


Parse.Cloud.define("v1-get-vendor-pacotes", async (req) => {
    const user = req.user;
    if (user.get('tipo') !== 'vendedor') throw 'TIPO_USUARIO_VENDEDOR';

    const Cliente = Parse.Object.extend("Cliente");
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo("admins", user);
    try {
        const clientesAdmin = await queryCliente.find({ useMasterKey: true });

        if (clientesAdmin.length === 0) {
            throw 'SEM_CLIENTES';
        }
        const query = new Parse.Query(Pacote);
        query.include('vendedor');
        query.include('urs');
        query.containedIn('vendedor', clientesAdmin);
        const pacotes = await query.find({ useMasterKey: true });
        return pacotes.map(formatarPacote);

    } catch (error) {
        throw error;
    }
}, {
    requireUser: true
});

Parse.Cloud.define("v1-get-buyer-pacotes", async (req) => {
    const user = req.user;
    if (user.get('tipo') !== 'comprador') throw 'TIPO_USUARIO_COMPRADOR';

    //comprador
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('admins', req.user);
    const comprador = await queryCliente.first({ useMasterKey: true });
    if (!comprador) throw 'COMPRADOR_INVALIDO';

    const taxaPaySales = comprador.get('taxaPaySales');


    const query = new Parse.Query(Pacote);
    query.include('vendedor');
    // query.include('urs');
    query.equalTo('status', 'disponivel');
    query.descending('valorBruto');
    const pacotes = await query.find({ useMasterKey: true });

    return pacotes.map((n) => formatarPacoteDisplay(n, taxaPaySales));

}, {
    requireUser: true
});


function formatarPacoteDisplay(pacote, taxaPaySales) { // Renomeei 'c' para 'pacote' para maior clareza
    const ursData = [];

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
        estrelas: pacote.get('estrelas'),
        taxaContratoPaySales: pacote.get('taxaContratoPaySales'),
        valorComissaoPaySales: parseFloat((taxaPaySales * pacote.get('valorBruto')).toFixed(2)),
        credenciadoras: pacote.get('credenciadoras'),
        urs: ursData
    };
}


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
        // estrelas: pacote.get('estrelas'),
        urs: ursData
    };
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

Parse.Cloud.define("v1-delete-pacote", async (req) => {
    const query = new Parse.Query(Pacote);
    query.include('urs');

    const pacote = new Pacote();
    pacote.id = req.params.pacoteId;
    await pacote.fetchWithInclude(['urs'], { useMasterKey: true });

    if (!pacote) throw 'PACOTE_INVALIDO';
    const ursParaAtualizar = pacote.get("urs");

    if (ursParaAtualizar && ursParaAtualizar.length > 0) {
        const ursAtualizadas = ursParaAtualizar.map((ur) => {
            ur.unset("pacote"); // Supondo que o campo Pointer na classe Ur para Pacote se chame "pacote"
            return ur;
        });

        // Salva todos os objetos Ur modificados de uma vez
        await Parse.Object.saveAll(ursAtualizadas, { useMasterKey: true });
        console.log(`${ursAtualizadas.length} URs tiveram a referência ao pacote ${req.params.pacoteId} removida.`);
    } else {
        console.log(`Não há URs relacionadas ao pacote ${req.params.pacoteId} para atualizar.`);
    }
    await pacote.destroy({ useMasterKey: true });
    return true;
}, {
    requireUser: true,
    fields: {
        pacoteId: {
            required: true
        }
    }
});

Parse.Cloud.define("v1-get-pacote", async (req) => {
    const pacote = new Pacote();
    pacote.id = req.params.pacoteId;
    await pacote.fetchWithInclude(['vendedor', 'urs'], { useMasterKey: true });
    if (!pacote) throw 'PACOTE_INVALIDO';
    return formatarPacoteComprado(pacote);
}, {
    requireUser: true,
    fields: {
        pacoteId: {
            required: true
        }
    }
});


Parse.Cloud.define("v1-comprar-pacote", async (req) => {
    const user = req.user;
    if (user.get('tipo') !== 'comprador') throw 'TIPO_USUARIO_COMPRADOR';

    const pacoteId = req.params.pacoteId;

    const pacote = new Pacote();
    pacote.id = pacoteId;
    await pacote.fetchWithInclude(['urs'], { useMasterKey: true });
    if (!pacote) throw 'PACOTE_INVALIDO';

    if (pacote.get('status') !== 'disponivel') throw 'PACOTE_NAO_DISPONIVEL';

    //comprador
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('admins', req.user);
    const comprador = await queryCliente.first({ useMasterKey: true });
    if (!comprador) throw 'CLIENTE_INVALIDO';
    //comissão da PaySales
    const taxaPaySales = comprador.get('taxaPaySales');
    //vamos pegar a taxa de contrato
    const valorBruto = pacote.get('valorBruto');    //taxa de contrato
    const queryTaxaContrato = new Parse.Query(TaxaContrato);
    // Busca todas as faixas onde o valor inicial é menor ou igual ao valor do contrato
    queryTaxaContrato.lessThanOrEqualTo("valorInicial", valorBruto);
    // Ordena as faixas em ordem decrescente pelo valor inicial
    queryTaxaContrato.descending("valorInicial");
    // Limita o resultado a 1 para pegar a faixa com o maior valor inicial
    queryTaxaContrato.limit(1);
    let taxa = 0;
    try {
        const faixaEncontrada = await queryTaxaContrato.first({ useMasterKey: true });

        if (faixaEncontrada) {
            taxa = faixaEncontrada.get("taxa");
        } else {
            throw 'TAXA_CONTRATO_INVALIDA';
        }
    } catch (error) {
        throw error;
    }
    //comissão da PaySales
    const valorComissaoPaySales = valorBruto * taxaPaySales / 100;

    // const urs = pacote.get('urs');
    // if (!urs || urs.length === 0) throw 'SEM_URS';
    // //copiar as urs para tabela de Urs Pacote
    // const ursPacote = urs.map((ur) => {
    //     const urPacote = new UrPacote();
    //     urPacote.set('arranjo', ur.get('arranjo'));
    //     urPacote.set('dataPrevistaLiquidacao', ur.get('dataPrevistaLiquidacao'));
    //     urPacote.set('valor', ur.get('valorLivreTotal'));
    //     urPacote.set('cnpjCredenciadora', ur.get('cnpjCredenciadora'));
    //     urPacote.set('pacote', pacote);
    //     return urPacote;
    // });
    // await Parse.Object.saveAll(ursPacote, { useMasterKey: true });
    pacote.set('status', 'em negociacao');
    pacote.set('comprador', comprador);
    pacote.set('taxaContratoPaySales', taxa);
    pacote.set('valorComissaoPaySales', valorComissaoPaySales);
    await pacote.save(null, { useMasterKey: true });

    // return formatarPacoteComprado(pacote);
    result = await Contrato.registrarContrato(pacoteId, comprador.id);
    return result;

}, {
    requireUser: true,
    fields: {
        pacoteId: {
            required: true
        }
    }
});

function formatarPacoteComprado(pacote) { // Renomeei 'c' para 'pacote' para maior clareza
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
        valorPagar: pacote.get('valorLiquido') + pacote.get('valorComissaoPaySales') + pacote.get('taxaContratoPaySales'),
        valorLiquido: pacote.get('valorLiquido'),
        estrelas: pacote.get('estrelas'),
        credenciadoras: pacote.get('credenciadoras'),
        urs: ursData
    };
}