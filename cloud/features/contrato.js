const B3 = require("./b3.js");
const Pacote = Parse.Object.extend('Pacote');
const Config = Parse.Object.extend('Config');
const Cliente = Parse.Object.extend('Cliente');
const Contrato = Parse.Object.extend('Contrato');
const UrContrato = Parse.Object.extend('URContrato');

Parse.Cloud.define('v1-registrar-contrato', async (req) => {

    //comprador
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.include('banco');
    queryCliente.equalTo('admins', req.user);
    const comprador = await queryCliente.first({ useMasterKey: true });
    if (!comprador) throw 'COMPRADOR_INVALIDO';

    const result = await registrarContrato(req.params.pacoteId, comprador.id);
    return result;
}, {
    requireUser: true,
    fields: {
        pacoteId: { required: true },
    }
});

async function registrarContrato(pacoteId, compradorId) {

    // const query = new Parse.Query(Pacote);
    // query.include('urs');
    // query.include('vendedor');
    // const pacote = await query.get(pacoteId, { useMasterKey: true });

    const pacote = new Pacote();
    pacote.id = pacoteId;
    await pacote.fetchWithInclude(['vendedor', 'urs'], { useMasterKey: true });

    if (!pacote) throw 'PACOTE_INVALIDO';
    console.log('exitem pacote para virar contrato')
    if (pacote.get('status') !== 'em negociacao') throw 'PACOTE_INVALIDO';
    console.log('pacote em negociação')
    const urs = pacote.get('urs');
    if (!urs || urs.length === 0) throw 'URS_INVALIDO';

    const vendedor = pacote.get('vendedor');
    if (!vendedor) throw 'VENDEDOR_INVALIDO';

    //comprador
    // const queryCliente = new Parse.Query(Cliente);
    // queryCliente.include('banco');
    // const comprador = await queryCliente.get(compradorId, { useMasterKey: true });
    // if (!comprador) throw 'COMPRADOR_INVALIDO';

    const comprador = new Cliente();
    comprador.id = compradorId;
    await comprador.fetchWithInclude(['banco'], { useMasterKey: true });
    if (!comprador) throw 'COMPRADOR_INVALIDO';

    const banco = comprador.get('banco');
    if (!banco) throw 'BANCO_INVALIDO';

    let queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'CodContrato');
    let config = await queryConfig.first({ useMasterKey: true });
    let proximoContador = parseInt(config.get("valor")) || 1;
    const codigoContrato = String(proximoContador).padStart(7, '0');
    proximoContador++;
    config.set("valor", String(proximoContador));
    await config.save(null, { useMasterKey: true })

    const today = new Date().toISOString().split('T')[0];
    const year = today.split('-')[0];
    const yy = year.slice(-2);
    const codContratoStr = `CTR-${codigoContrato}_${yy}`;

    queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'cnpjFinanciador');
    config = await queryConfig.first({ useMasterKey: true });
    const cnpjFinanciador = config.get('valor');

    // verificar se conta vai dígito e CNPJ formatado ou não
    const payload = JSON.stringify({
        "data": {
            "codigoExternoContrato": codContratoStr,
            "identificadorContrato": codContratoStr,
            "documentoContratanteDivida": vendedor.get('cnpj'),
            "indicadorRenegociacao": 0,
            "cnpjParticipante": cnpjFinanciador,
            "cnpjDetentor": cnpjFinanciador,
            "codigoTipoEfeitoContrato": 1,
            "valorSaldoDevedorOuLimite": pacote.get('valorBruto'),
            "valorMinimoMantido": pacote.get('valorBruto'),
            "dataAssinatura": today,
            "dataVencimento": today,
            "codigoModalidadeOperacao": 1,
            "codigoRegraDivisao": 1,
            "domicilio": {
                "codigoAgencia": banco.get('agencia'),
                "numeroConta": banco.get('conta'),
                "codigoISPB": banco.get('ispb'),
                "documentoTitularConta": comprador.get('cnpj'),
                "tipoConta": "CC"
            },
            "recebiveisAbrangidos": [
                ...urs.map((ur) => {
                    return {
                        "cnpjsCredenciadora": [ur.get('cnpjCredenciadora')],
                        "documentosUsuarioFinalRecebedor": [vendedor.get('cnpj')],
                        "codigosArranjoPagamento": [ur.get('arranjo')],
                        "dataLiquidacaoInicial": ur.get('dataPrevistaLiquidacao'),
                        "dataLiquidacaoFinal": ur.get('dataPrevistaLiquidacao'),
                        "valorOnerar": ur.get('valorLivreTotal')
                    }
                })
            ]
        }
    });

    try {
        data = await B3.registrarContrato(payload);

        //vamos guardar os dados:
        pacote.set('status', 'enviado_b3');
        pacote.set('identificadorContrato', data.RetornoRequisicao.identificadorContrato);
        pacote.set('protocoloProcessamento', data.RetornoRequisicao.protocoloProcessamento);
        pacote.set('dataHoraProcessamento', new Date(data.RetornoRequisicao.dataHoraProcessamento));

        await pacote.save(null, { useMasterKey: true });

        //Vamos criar o contrato
        const contrato = new Contrato();
        contrato.set('vendedor', vendedor);
        contrato.set('comprador', comprador);
        contrato.set('codigoExternoContrato', data.RetornoRequisicao.codigoExternoContrato);
        contrato.set('identificadorContrato', data.RetornoRequisicao.identificadorContrato);
        contrato.set('protocoloProcessamento', data.RetornoRequisicao.protocoloProcessamento);
        contrato.set('dataHoraProcessamento', new Date(data.RetornoRequisicao.dataHoraProcessamento));
        contrato.set('status', 'enviado_b3');
        contrato.set('credenciadoras', pacote.get('credenciadoras'));
        contrato.set('pacote', pacote);
        await contrato.save(null, { useMasterKey: true });

        //Vamos atualizar o pacote
        pacote.set('contrato', contrato);
        await pacote.save(null, { useMasterKey: true });
        return data;
    } catch (error) {
        console.error('Erro ao registrar contrato na B3:', error);
        if (error.status === 422 && error.body && error.body.erros) {
            // Tratar o erro específico da API da B3 (código 422 com corpo JSON)
            const mensagemErroB3 = error.body.erros.map(erro => `${erro.titulo}: ${erro.detalhe}`).join('; ');
            throw new Parse.Error(Parse.Error.OTHER_CAUSE, `Erro da B3: ${mensagemErroB3}`);
        } else {
            // Outro tipo de erro (falha na conexão, timeout, etc.)
            throw new Parse.Error(Parse.Error.INTERNAL_SERVER_ERROR, `Erro ao chamar a API externa: ${error.message || error}`);
        }
    }
}

Parse.Cloud.define('v1-consulta-contrato', async (req) => {
    const payload = {
        "codigoExternoContrato": req.params.codContrato,
        "identificadorContrato": req.params.codContrato
    }

    const result = await B3.consultaContrato(payload);

    //recuperar o pacote
    const query = new Parse.Query(Pacote);
    query.equalTo('identificadorContrato', result.data.identificadorContrato);
    const pacote = await query.first({ useMasterKey: true });
    if (!pacote) throw 'PACOTE_INVALIDO';

    // return result;

    //Criar contrato
    const contrato = new Contrato();
    contrato.set('vendedor', pacote.get('vendedor'));
    contrato.set('comprador', pacote.get('comprador'));
    contrato.set('identificadorContrato', result.data.identificadorContrato);
    contrato.set('codigoExternoContrato', result.data.codigoExternoContrato);
    contrato.set('descricaoSituacaoContrato', result.data.descricaoSituacaoContrato);
    contrato.set('descricaoRenegociacao', result.data.descricaoRenegociacao);
    contrato.set('dataAssinatura', result.data.dataAssinatura);
    contrato.set('dataVencimento', result.data.dataVencimento);
    contrato.set('cnpjParticipante', result.data.cnpjParticipante.replace(/\D/g, ''));
    contrato.set('cnpjDetentor', result.data.cnpjDetentor.replace(/\D/g, ''));
    contrato.set('documentoContratanteDivida', result.data.documentoContratanteDivida.replace(/\D/g, ''));
    contrato.set('descricaoTipoEfeitoContrato', result.data.descricaoTipoEfeitoContrato);
    contrato.set('descricaoRegraDivisao', result.data.descricaoRegraDivisao);
    contrato.set('descricaoIdentificacaoGestao', result.data.descricaoIdentificacaoGestao);
    contrato.set('descricaoTipoCalculoComprometimento', result.data.descricaoTipoCalculoComprometimento);
    contrato.set('descricaoModalidadeOperacao', result.data.descricaoModalidadeOperacao);
    contrato.set('valorSaldoDevedorOuLimite', result.data.valorSaldoDevedorOuLimite);
    contrato.set('valorMinimoMantido', result.data.valorMinimoMantido);
    contrato.set('quantidadeUnidadesRecebiveis', result.data.quantidadeUnidadesRecebiveis);
    contrato.set('valorEfeitoSolicitadoTotal', result.data.valorAgregado.valorEfeitoSolicitadoTotal);
    contrato.set('valorEfeitoComprometidoTotal', result.data.valorAgregado.valorEfeitoComprometidoTotal);
    contrato.set('valorEfeitoAComprometerTotal', result.data.valorAgregado.valorEfeitoAComprometerTotal);
    contrato.set('domicilios', result.data.domicilios);
    await contrato.save(null, { useMasterKey: true });
    //comprador
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.equalTo('cnpj', result.data.documentoContratanteDivida);
    const cliente = await queryCliente.first({ useMasterKey: true });
    if (!cliente) throw 'CLIENTE_INVALIDO';
    contrato.set('comprador', cliente);
    await contrato.save(null, { useMasterKey: true });
    //vendedor
    const queryVendedor = new Parse.Query(Cliente);
    queryVendedor.equalTo('cnpj', result.data.cnpjParticipante);
    const vendedor = await queryVendedor.first({ useMasterKey: true });
    if (!vendedor) throw 'VENDENDOR_INVALIDO';
    contrato.set('vendedor', vendedor);
    await contrato.save(null, { useMasterKey: true });

    var ursContrato = [];

    for (const ur of result.data.unidadesRecebiveis) {
        const objetoUr = new UrContrato();
        objetoUr.set('idEfeitoContrato', ur.idEfeitoContrato);
        objetoUr.set('statusSolicitacao', ur.statusSolicitacao);
        objetoUr.set('cnpjCredenciadora', ur.cnpjCredenciadora);
        objetoUr.set('documentoUsuarioFinalRecebedor', ur.documentoUsuarioFinalRecebedor);
        objetoUr.set('codigoArranjoPagamento', ur.codigoArranjoPagamento);
        objetoUr.set('dataLiquidacao', ur.dataLiquidacao);
        objetoUr.set('descricaoSituacaoConstituicao', ur.descricaoSituacaoConstituicao);
        objetoUr.set('indicadorOrdemComprometimento', ur.valorUnidadeRecebivel.indicadorOrdemComprometimento);
        objetoUr.set('valorConstituidoTotal', ur.valorUnidadeRecebivel.valorConstituidoTotal);
        objetoUr.set('valorEfeitoSolicitado', ur.valorUnidadeRecebivel.valorEfeitoSolicitado);
        objetoUr.set('valorEfeitoComprometido', ur.valorUnidadeRecebivel.valorEfeitoComprometido);
        objetoUr.set('valorEfeitoAComprometer', ur.valorUnidadeRecebivel.valorEfeitoAComprometer);

        await objetoUr.save(null, { useMasterKey: true });
        ursContrato.push(objetoUr.id);
    }
    const ursPointers = ursContrato.map(ur => {
        return {
            __type: 'Pointer',
            className: 'URContrato',
            objectId: ur
        }
    })

    contrato.set("urs", ursPointers);
    await contrato.save(null, { useMasterKey: true });

    return contrato;
}, {
    requireUser: true,
    fields: {
        codContrato: { required: true },
    }
});

Parse.Cloud.define('v1-get-contrato', async (req) => {
    const Contrato = Parse.Object.extend('Contrato');
    const query = new Parse.Query(Contrato);
    query.include('urs');
    query.equalTo('identificadorContrato', req.params.codContrato);
    const contrato = await query.first({ useMasterKey: true });
    if (!contrato) throw 'CONTRATO_INVALIDO';
    return contrato;
}, {
    requireUser: true,
    fields: {
        codContrato: { required: true },
    }
});

Parse.Cloud.define('v1-get-buyer-contratos', async (req) => {

    const user = req.user;
    if (user.get('tipo') !== 'comprador') throw 'TIPO_USUARIO_COMPRADOR';

    //comprador
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.include('banco');
    queryCliente.equalTo('admins', req.user);
    const comprador = await queryCliente.first({ useMasterKey: true });
    if (!comprador) throw 'COMPRADOR_INVALIDO';

    const query = new Parse.Query(Contrato);
    query.include('pacote');
    query.include('vendedor');
    query.include('urs');
    query.equalTo('comprador', comprador);
    const contratos = await query.find({ useMasterKey: true });

    // return contratos;

    return contratos.map((c) => formatarContratoDisplay(c));
}, {
    requireUser: true
});

function formatarContratoDisplay(contrato) {
    const pacote = contrato.get('pacote');
    const vendedor = contrato.get('vendedor');

    return {
        id: contrato.id,
        identificadorContrato: contrato.get('identificadorContrato'),
        descricaoSituacaoContrato: contrato.get('descricaoSituacaoContrato'),
        status: contrato.get('status'),
        clienteId: vendedor.id,
        clienteNome: vendedor.get('razaoSocial'),
        clienteCNPJ: vendedor.get('cnpj'),
        dataAssinatura: contrato.get('dataAssinatura'),
        dataVencimento: contrato.get('dataVencimento'),
        valorAPagar: pacote.get('valorLiquido') + pacote.get('valorComissaoPaySales') + pacote.get('taxaContratoPaySales'),
        valorBruto: pacote.get('valorBruto'),
        valorLiquido: pacote.get('valorLiquido'),
        desconto: pacote.get('desconto'),
        taxaMes: pacote.get('taxaMes'),
        prazoMedioPonderado: pacote.get('prazoMedioPonderado'),
        credenciadoras: contrato.get('credenciadoras'),
        estrelas: pacote.get('estrelas'),

    };
}
function formatarContrato(contrato) {
    const pacote = contrato.get('pacote');
    const vendedor = contrato.get('vendedor');
    // const vendedorData = vendedor ? {
    //     id: vendedor.id,
    //     razaoSocial: vendedor.get('razaoSocial'),
    //     cnpj: vendedor.get('cnpj')
    // } : null;

    const pacoteData = {
        id: pacote.id,
        clienteId: vendedor.id,
        clienteNome: vendedor.get('razaoSocial'),
        clienteCNPJ: vendedor.get('cnpj'),
        status: pacote.get('status'),
        valorBruto: pacote.get('valorBruto'),
        prazoMedioPonderado: pacote.get('prazoMedioPonderado'),
        taxaMes: pacote.get('taxaMes'),
        desconto: pacote.get('desconto'),
        taxaContratoPaySales: pacote.get('taxaContratoPaySales'),
        valorComissaoPaySales: pacote.get('valorComissaoPaySales'),
        valorLiquido: pacote.get('valorLiquido'),
        estrelas: pacote.get('estrelas'),
        urs: pacote.get('urs').map((ur) => ({
            id: ur.id,
            arranjo: ur.get('arranjo'),
            cnpjCredenciadora: ur.get('cnpjCredenciadora'),
            dataPrevistaLiquidacao: ur.get('dataPrevistaLiquidacao'),
            valorLivreTotal: ur.get('valorLivreTotal')
        }))
    };

    return {
        id: contrato.id,
        identificadorContrato: contrato.get('identificadorContrato'),
        descricaoSituacaoContrato: contrato.get('descricaoSituacaoContrato'),
        clienteId: vendedor.id,
        clienteNome: vendedor.get('razaoSocial'),
        clienteCNPJ: vendedor.get('cnpj'),
        dataAssinatura: contrato.get('dataAssinatura'),
        dataVencimento: contrato.get('dataVencimento'),
        valorAPagar: pacote.get('valorLiquido') + pacote.get('valorComissaoPaySales') + pacote.get('taxaContratoPaySales'),
        valorSaldoDevedorOuLimite: contrato.get('valorSaldoDevedorOuLimite'),
        valorMinimoMantido: contrato.get('valorMinimoMantido'),
        quantidadeUnidadesRecebiveis: contrato.get('quantidadeUnidadesRecebiveis'),
        valorEfeitoSolicitadoTotal: contrato.get('valorEfeitoSolicitadoTotal'),
        valorEfeitoComprometidoTotal: contrato.get('valorEfeitoComprometidoTotal'),
        valorEfeitoAComprometerTotal: contrato.get('valorEfeitoAComprometerTotal'),
        pacote: pacoteData
    };
}

module.exports = {
    registrarContrato
};
