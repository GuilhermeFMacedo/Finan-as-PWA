const db = new Dexie("FinancasDB");

db.version(18).stores({
  receitas: "++id, valor, data, pessoaId",
  despesas: "++id, data, valor, categoriaId, subcategoriaId, descricao, pessoaId, formaPagamento, pago, cartaoId, parcelas, parcelaAtual, grupoParcelas",
  cartoes: "++id, nome, limite, limiteAtual, fechamento, vencimento, cor",
  categorias: "++id, nome, cor, icone",
  subcategorias: "++id, nome, categoriaId",
  pessoas: "++id, nome",
  pagamentosFatura: "++id, cartaoId, ano, mes, valor, dataPagamento",
  comprovantes: "++id, tipo, referenciaId",
  orcamentos: "++id, categoriaId, mesAno, valorLimite, [categoriaId+mesAno]"
});