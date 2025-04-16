const B3 = require("./b3.js");
const Pacote = Parse.Object.extend('Pacote');
const Config = Parse.Object.extend('Config');
const Cliente = Parse.Object.extend('Cliente');
const Contrato = Parse.Object.extend('Contrato');
const UrContrato = Parse.Object.extend('URContrato');

Parse.Cloud.define('v1-registrar-contrato', async (req) => {

    const query = new Parse.Query(Pacote);
    query.include('urs');
    query.include('vendedor');
    const pacote = await query.get(req.params.pacoteId, { useMasterKey: true });
    if (!pacote) throw 'PACOTE_INVALIDO';
    console.log('exitem pacote para virar contrato')
    if (pacote.get('status') !== 'em negociacao') throw 'PACOTE_INVALIDO';
    console.log('pacote em negociação')
    const urs = pacote.get('urs');
    if (!urs || urs.length === 0) throw 'URS_INVALIDO';

    const vendedor = pacote.get('vendedor');
    if (!vendedor) throw 'VENDEDOR_INVALIDO';

    //comprador
    const queryCliente = new Parse.Query(Cliente);
    queryCliente.include('banco');
    queryCliente.equalTo('admins', req.user);
    const comprador = await queryCliente.first({ useMasterKey: true });
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

    queryConfig = new Parse.Query(Config);
    queryConfig.equalTo('nome', 'cnpjSolicitante');
    config = await queryConfig.first({ useMasterKey: true });
    const cnpjSolicitante = config.get('valor');


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


    // return payload;

    try {
        data = await B3.registrarContrato(payload);

        //vamos guardar os dados:
        pacote.set('status', 'enviado_b3');
        pacote.set('identificadorContrato', data.RetornoRequisicao.identificadorContrato);
        pacote.set('protocoloProcessamento', data.RetornoRequisicao.protocoloProcessamento);
        pacote.set('dataHoraProcessamento', new Date(data.RetornoRequisicao.dataHoraProcessamento));

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

    // // return payload;

    // try {
    //   const options = {
    //     headers: {
    //       Authorization: `Bearer ${token}`,
    //       'Content-Type': 'application/json'
    //     }
    //   };
    //   const response = await b3API.post(baseUrl + "/api/rcc-efeitos-contratos/v1/definicao-unidades-recebiveis/generica", payload, options);
    //   const data = response.data;
    //   //vamos guardar os dados:
    //   pacote.set('status', 'enviado_b3');
    //   pacote.set('codigoContrato', data.RetornoRequisicao.codigoExternoContrato);
    //   pacote.set('protocoloProcessamento', data.RetornoRequisicao.protocoloProcessamento);
    //   pacote.set('dataHoraProcessamento', new Date(data.RetornoRequisicao.dataHoraProcessamento));

    //   await pacote.save(null, { useMasterKey: true });
    //   return data;
    // } catch (error) {
    //   console.error('Erro ao realizar registro de contrato na B3:', error);
    //   throw error;
    // }
}, {
    requireUser: true,
    fields: {
        pacoteId: { required: true },
    }
});

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

