const axios = require("axios");
const https = require("https");

Parse.Cloud.define('v1-get-cnpj', async (req) => {

    return await getCNPJ(req.params.cnpj);
    // const url = 'https://brasilapi.com.br/api/cnpj/v1/' + cnpj;

    // try {
    //     const response = await axios.get(url);
    //     return formatCompany(response.data);
    //     // return response.data;
    // } catch (error) {
    //     console.log(error);
    // }
}, {
    fields: {
        cnpj: {
            required: true
        }
    }
});

async function getCNPJ(cnpj) {
    const url = 'https://brasilapi.com.br/api/cnpj/v1/' + cnpj;

    try {
        const response = await axios.get(url);
        return formatCompany(response.data);
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function getFullCNPJ(cnpj) {
    const url = 'https://brasilapi.com.br/api/cnpj/v1/' + cnpj;

    try {
        const response = await axios.get(url);
        return (response.data);
    } catch (error) {
        console.log(error);
        return null;
    }
}


Parse.Cloud.define('v1-get-bancos', async (req) => {

    const url = 'https://brasilapi.com.br/api/banks/v1';

    try {
        const response = await axios.get(url);

        // return response.data.map((r) => formatBancos(r));

        return response.data;
    } catch (error) {
        console.log(error);
    }
});


Parse.Cloud.define('v1-get-cidades', async (req) => {

    const url = 'https://brasilapi.com.br/api/ibge/municipios/v1/' + req.params.uf + '?providers=dados-abertos-br,gov,wikipedia';

    try {
        const response = await axios.get(url);

        return response.data.map((r) => formatCidades(r));

        // return response.data;
    } catch (error) {
        console.log(error);
    }
}, {
    fields: {
        uf: {
            required: true
        }
    }
});

Parse.Cloud.define('v1-get-cep', async (req) => {

    const url = 'https://brasilapi.com.br/api/cep/v2/' + req.params.cep;

    try {
        const response = await axios.get(url);
        return formatCep(response.data);
        // return response.data;
    } catch (error) {
        console.log(error);
    }
}, {
    fields: {
        cep: {
            required: true
        }
    }
});

function formatCompany(u) {
    return {
        cnpj: u.cnpj,
        razaoSocial: u.razao_social,
        nomeFantasia: u.nome_fantasia,
        cnae: u.cnae_fiscal,
        cnaeDescricao: u.cnae_fiscal_descricao,
        tipoLogradouro: u.descricao_tipo_de_logradouro,
        logradouro: u.logradouro,
        numero: u.numero,
        complemento: u.complemento,
        bairro: u.bairro,
        cidade: u.municipio,
        uf: u.uf,
        cep: u.cep,
        // dtInicio: u.data_inicio_atividade,
        // situacao: u.descricao_situacao_cadastral,
        // descricaoMotivoSituacao: u.descricao_motivo_situacao,
        // porte: u.porte,
        // descricaoPorte: u.descricao_porte,
        // capitalSocial: u.capital_social,
        // naturezaJuridica: u.natureza_juridica,
        // descricaoIdentificadorMatrizFilial: u.descricao_identificador_matriz_filial,
        // opcaoMei: u.opcao_mei,
        // opcaoSimples: u.opcao_simples,
        // qualificacaoResponsavel: u.qualificacao_responsavel,
        // qsa: u.qsa.map((s) => formatSocio(s)),
        // cnaesSecundarios: u.cnaes_secundarios.map((c) => formatCNAE(c))
    }
}

function formatSocio(s) {
    return {
        nome: s.nome_socio,
        cpfCnpjSocio: s.cnpj_cpf_do_socio,
        faixaEtaria: s.faixa_etaria,
        qualificacaoSocio: s.qualificacao_socio,
        dataEntrada: s.data_entrada_sociedade,
        cpfRepresentante: s.cpf_representante_legal,
        codQualificacao: s.codigo_qualificacao_socio,
    }
}

function formatCNAE(c) {
    return {
        codigo: c.codigo,
        descricao: c.descricao
    }
}

function formatBancos(u) {
    return {
        ispb: u.ispb,
        nome: u.name,
        cod: u.code,
        fullName: u.fullName
    }
}

function formatCep(u) {
    return {
        cep: u.cep,
        logradouro: u.street,
        bairro: u.neighborhood,
        cidade: u.city,
        uf: u.state
    }
}

function formatCidades(u) {
    return {
        nome: u.nome,
    }
}

module.exports = {
    getCNPJ,
    getFullCNPJ,
};
