const Cliente = Parse.Object.extend('Cliente');
const Ur = Parse.Object.extend('UR');   
const Config = Parse.Object.extend('Config');
const Pacote = Parse.Object.extend('Pacote');

Parse.Cloud.define('v1-post-pacote', async (req) => {
    const queryCliente = new Parse.Query(Cliente);
	const cliente = await queryCliente.get(req.params.clienteId, { useMasterKey: true });
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
await pacote.save(null, {useMasterKey: true})

return pacote;

}, {
	requireUser: true,
	fields: {
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
        clienteId: {
            required: true
        },
        ursIds: {
            required: true
        }
	}
});
 