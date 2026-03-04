document.addEventListener("DOMContentLoaded", () => {
  const mesInput = document.getElementById("mesSelecionado");
  const filtroPessoa = document.getElementById("filtroPessoa");

  // Define o mês atual no input (YYYY-MM)
  const hoje = new Date();
  mesInput.value = hoje.toISOString().slice(0, 7);

  // Chamadas iniciais
  atualizarDashboard();
  carregarResumoCartoes();
  carregarContasPendentes();

  // Listener para mudança de mês
  mesInput.addEventListener("change", () => {
    atualizarDashboard();
    carregarResumoCartoes();
    carregarContasPendentes();
  });

  // Listener para o filtro de pessoa (Agora dentro do escopo correto!)
  if (filtroPessoa) {
    filtroPessoa.addEventListener("change", atualizarDashboard);
  }
});

function atualizarUI(receita, despesa, saldo) {

  document.getElementById("totalReceita").textContent =
    formatarMoeda(receita);

  document.getElementById("totalDespesa").textContent =
    formatarMoeda(despesa);

  const saldoEl = document.getElementById("saldoTotal");

  saldoEl.textContent = formatarMoeda(saldo);
  saldoEl.style.color = saldo >= 0 ? "#00c853" : "#ff5252";
}

// Versão melhorada do atualizarDashboard que deve funcionar
async function atualizarDashboard() {
  const mesInput = document.getElementById("mesSelecionado").value;
  const filtroPessoaId = document.getElementById("filtroPessoa").value; // "todas" ou o ID da pessoa

  if (!mesInput) return;

  // 1. Preparar Datas
  const [ano, mes] = mesInput.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

  try {
    // 2. Buscar dados (Note que adicionei 'pessoas' aqui)
    const [todasReceitas, todasDespesas, todasPessoas] = await Promise.all([
      db.receitas.toArray(),
      db.despesas.toArray(),
      db.pessoas.toArray()
    ]);

    // 3. Atualizar o Select de Pessoas (Dinâmico para quem for testar)
    popularFiltroPessoas(todasPessoas);

    // 4. Lógica de Filtro Unificada
    const filtrarItem = (item) => {
      // Filtro de Data
      const dataItem = new Date(item.data);
      if (typeof item.data === 'string' && !item.data.includes('T')) {
          dataItem.setHours(dataItem.getHours() + 12); 
      }
      const estaNoMes = dataItem >= inicio && dataItem <= fim;

      // Filtro de Pessoa (Dinâmico!)
      // Se "todas" estiver selecionado, retorna true. 
      // Se não, verifica se o pessoaId do item bate com o selecionado.
      const eDaPessoa = filtroPessoaId === "todas" || Number(item.pessoaId) === Number(filtroPessoaId);

      return estaNoMes && eDaPessoa;
    };

    const receitasFiltradas = todasReceitas.filter(filtrarItem);
    const despesasFiltradas = todasDespesas.filter(filtrarItem);

    // 5. Cálculos
    const totalReceita = receitasFiltradas.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const totalDespesa = despesasFiltradas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);

    atualizarUI(totalReceita, totalDespesa, totalReceita - totalDespesa);

  } catch (error) {
    console.error("Erro no Dashboard:", error);
  }
}

// Função para preencher o select de pessoas sem apagar a opção "Todas"
function popularFiltroPessoas(pessoas) {
  const select = document.getElementById("filtroPessoa");
  // Se já tiver mais de uma opção (a "Todas"), não precisa reconstruir tudo sempre
  if (select.options.length > 1) return; 

  pessoas.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nome;
    select.appendChild(opt);
  });
}

// Utilitário de formatação
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}




async function carregarResumoCartoes() {

  const mesInput = document.getElementById("mesSelecionado").value;
  if (!mesInput) return;

  const [ano, mes] = mesInput.split("-").map(Number);

  const hoje = new Date();

  const cartoes = await db.cartoes.toArray();
  const despesas = await db.despesas.toArray();

  const container = document.getElementById("resumoCartoes");
  container.innerHTML = "";

  for (const cartao of cartoes) {

    const diaFechamento = Number(cartao.fechamento);

    // 📅 Define ciclo da fatura
    const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
    const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

    // 🧮 Filtra despesas do cartão dentro do ciclo
    const despesasCartao = despesas.filter(d => {
      if (d.cartaoId !== cartao.id) return false;
      if (d.formaPagamento !== "cartao") return false;

      const dataDespesa = new Date(d.data);
      return dataDespesa >= dataInicio && dataDespesa <= dataFim;
    });

    // 💰 Soma da fatura
    const totalFatura = despesasCartao.reduce((total, d) => {
      return total + (Number(d.valor) || 0);
    }, 0);

    const limiteGasto = totalFatura;
    const limiteDisponivel = Number(cartao.limite) - limiteGasto;

    // 📌 Define status correta
    const estaNoMesAtual =
      hoje.getFullYear() === ano &&
      hoje.getMonth() === mes - 1;

    let faturaFechada = false;

    if (estaNoMesAtual) {
      faturaFechada = hoje.getDate() > diaFechamento;
    } else if (hoje > dataFim) {
      faturaFechada = true;
    }

    const status = faturaFechada ? "Fechada" : "Aberta";

    // 🎨 Render
    container.innerHTML += `
      <div class="card-cartao" onclick="abrirDetalheCartao(${cartao.id}, '${mesInput}')">
        <h3>${cartao.nome}</h3>
        <p><strong>Fatura ${status}:</strong> ${formatarMoeda(totalFatura)}</p>
        <p>Limite usado: ${formatarMoeda(limiteGasto)}</p>
        <p>Disponível: ${formatarMoeda(limiteDisponivel)}</p>
      </div>
    `;
  }
}

async function abrirDetalheCartao(cartaoId, mesInput) {

  const [ano, mes] = mesInput.split("-").map(Number);

  const cartao = await db.cartoes.get(cartaoId);
  const despesas = await db.despesas.where("cartaoId").equals(cartaoId).toArray();
  const pessoas = await db.pessoas.toArray();

  const diaFechamento = Number(cartao.fechamento);

  const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
  const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

  // Filtra pelo ciclo
  const despesasCiclo = despesas.filter(d => {
    if (d.formaPagamento !== "cartao") return false;
    const dataDespesa = new Date(d.data);
    return dataDespesa >= dataInicio && dataDespesa <= dataFim;
  });

  const agrupadoPorPessoa = {};

  despesasCiclo.forEach(d => {
    if (!agrupadoPorPessoa[d.pessoaId]) {
      agrupadoPorPessoa[d.pessoaId] = 0;
    }
    agrupadoPorPessoa[d.pessoaId] += Number(d.valor);
  });

  let html = `<div class="fatura-detalhe">
  <h2>Detalhes da Fatura</h2>
`;

for (const pessoaId in agrupadoPorPessoa) {
  const pessoa = pessoas.find(p => p.id == pessoaId);

  html += `
    <div class="fatura-pessoa"
         onclick="abrirDetalhePessoa(${cartaoId}, ${pessoaId}, '${mesInput}')">
      <span class="nome">${pessoa.nome}</span>
      <span class="valor">${formatarMoeda(agrupadoPorPessoa[pessoaId])}</span>
    </div>
  `;
}

html += `</div>`;

  abrirModal("Fatura do Cartão", html);
}

async function abrirDetalhePessoa(cartaoId, pessoaId, mesInput) {

  const [ano, mes] = mesInput.split("-").map(Number);

  const cartao = await db.cartoes.get(cartaoId);

  const diaFechamento = Number(cartao.fechamento);

  const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
  const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

  const despesas = await db.despesas
    .where({ cartaoId: cartaoId, pessoaId: Number(pessoaId) })
    .toArray();

  const despesasFiltradas = despesas.filter(d => {
    if (d.formaPagamento !== "cartao") return false;
    const dataDespesa = new Date(d.data);
    return dataDespesa >= dataInicio && dataDespesa <= dataFim;
  });

  let html = `
<div class="fatura-gastos">
  <h3>Gastos</h3>
`;

despesasFiltradas.forEach(d => {
  html += `
    <div class="gasto-item">
      <span class="descricao">
        ${d.descricao || "Sem descrição"}
      </span>
      <span class="valor">
        ${formatarMoeda(Number(d.valor))}
      </span>
    </div>
  `;
});

html += `</div>`;

  abrirModal("Detalhe da Pessoa", html);
}











function arquivoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function pagarFaturaComComprovante(cartaoId, mesInput) {

  const inputFile = document.getElementById("inputComprovante");
  const file = inputFile.files[0];

  if (!file) {
    alert("Selecione um comprovante.");
    return;
  }

  const base64 = await arquivoParaBase64(file);

  const [ano, mes] = mesInput.split("-").map(Number);

  const cartao = await db.cartoes.get(cartaoId);

  const diaFechamento = Number(cartao.fechamento);
  const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
  const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

  const despesas = await db.despesas.where("cartaoId").equals(cartaoId).toArray();

  const despesasCiclo = despesas.filter(d => {
    if (d.formaPagamento !== "cartao") return false;
    const dataDespesa = new Date(d.data);
    return dataDespesa >= dataInicio && dataDespesa <= dataFim;
  });

  const totalFatura = despesasCiclo.reduce((acc, d) => acc + Number(d.valor), 0);

  const pagamentoId = await db.pagamentosFatura.add({
    cartaoId,
    ano,
    mes,
    valor: totalFatura,
    dataPagamento: new Date()
  });

  // liberar limite
  await db.cartoes.update(cartaoId, {
    limiteAtual: cartao.limiteAtual + totalFatura
  });

  // salvar comprovante
  await db.comprovantes.add({
    tipo: "fatura",
    referenciaId: pagamentoId,
    arquivo: base64,
    nomeArquivo: file.name,
    dataUpload: new Date()
  });

  alert("Fatura paga com comprovante salvo!");

  carregarResumoCartoes();
}

async function pagarPixComComprovante(despesaId) {

  const inputFile = document.getElementById("inputComprovante");
  const file = inputFile.files[0];

  if (!file) {
    alert("Selecione um comprovante.");
    return;
  }

  const base64 = await arquivoParaBase64(file);

  await db.despesas.update(despesaId, {
    pago: true
  });

  await db.comprovantes.add({
    tipo: "pix",
    referenciaId: despesaId,
    arquivo: base64,
    nomeArquivo: file.name,
    dataUpload: new Date()
  });

  alert("Pix marcado como pago com comprovante!");

  atualizarDashboard();
}

async function visualizarComprovante(tipo, referenciaId) {

  const comp = await db.comprovantes
    .where({ tipo, referenciaId })
    .first();

  if (!comp) {
    alert("Nenhum comprovante encontrado.");
    return;
  }

  const win = window.open();
  win.document.write(`
    <iframe src="${comp.arquivo}" 
            style="width:100%; height:100%; border:none;"></iframe>
  `);
}

async function carregarContasPendentes() {

  const mesInput = document.getElementById("mesSelecionado").value;
  if (!mesInput) return;

  const [ano, mes] = mesInput.split("-").map(Number);
  const hoje = new Date();

  const container = document.getElementById("contasPendentes");
  container.innerHTML = "<h2>Contas Pendentes</h2>";

  const [despesas, cartoes, pagamentosFatura] = await Promise.all([
    db.despesas.toArray(),
    db.cartoes.toArray(),
    db.pagamentosFatura.toArray()
  ]);

  // ============================
  // 1️⃣ PIX NÃO PAGOS
  // ============================

  const pixNaoPagos = despesas.filter(d => {
    if (d.formaPagamento !== "pix") return false;
    if (d.pago !== false) return false;

    const data = new Date(d.data);
    return data.getFullYear() === ano &&
           data.getMonth() === mes - 1;
  });

  if (pixNaoPagos.length > 0) {
    container.innerHTML += "<h3>Pix Pendentes</h3>";

    pixNaoPagos.forEach(d => {
      container.innerHTML += `
        <div class="pendente-item">
          <strong>${d.descricao || "Sem descrição"}</strong>
          <p>${formatarMoeda(Number(d.valor))}</p>
          <button onclick="abrirModalPagamentoPix(${d.id})">
            Pagar
          </button>
        </div>
      `;
    });
  }

  // ============================
  // 2️⃣ FATURAS FECHADAS NÃO PAGAS
  // ============================

  for (const cartao of cartoes) {

    const diaFechamento = Number(cartao.fechamento);

    const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
    const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

    // Verifica se já foi paga
    const jaPaga = pagamentosFatura.find(p =>
      p.cartaoId === cartao.id &&
      p.ano === ano &&
      p.mes === mes
    );

    if (jaPaga) continue;

    // Verifica se está fechada
    const estaNoMesAtual =
      hoje.getFullYear() === ano &&
      hoje.getMonth() === mes - 1;

    let faturaFechada = false;

    if (estaNoMesAtual) {
      faturaFechada = hoje.getDate() > diaFechamento;
    } else if (hoje > dataFim) {
      faturaFechada = true;
    }

    if (!faturaFechada) continue;

    // Calcula valor da fatura
    const despesasCartao = despesas.filter(d => {
      if (d.cartaoId !== cartao.id) return false;
      if (d.formaPagamento !== "cartao") return false;

      const data = new Date(d.data);
      return data >= dataInicio && data <= dataFim;
    });

    const totalFatura = despesasCartao.reduce(
      (acc, d) => acc + Number(d.valor),
      0
    );

    if (totalFatura === 0) continue;

    container.innerHTML += `
      <div class="pendente-item">
        <strong>Fatura ${cartao.nome}</strong>
        <p>${formatarMoeda(totalFatura)}</p>
        <button onclick="abrirModalPagamentoFatura(${cartao.id}, '${mesInput}')">
          Pagar Fatura
        </button>
      </div>
    `;
  }

  if (container.innerHTML === "<h2>Contas Pendentes</h2>") {
    container.innerHTML += "<p>🎉 Nenhuma conta pendente!</p>";
  }
}

async function abrirModalPagamentoFatura(cartaoId, mesInput) {

  const [ano, mes] = mesInput.split("-").map(Number);
  const cartao = await db.cartoes.get(cartaoId);

  const diaFechamento = Number(cartao.fechamento);
  const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
  const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

  const despesas = await db.despesas.where("cartaoId").equals(cartaoId).toArray();

  const despesasCiclo = despesas.filter(d => {
    if (d.formaPagamento !== "cartao") return false;
    const data = new Date(d.data);
    return data >= dataInicio && data <= dataFim;
  });

  const totalFatura = despesasCiclo.reduce(
    (acc, d) => acc + Number(d.valor),
    0
  );

  const html = `
    <h2>Pagar Fatura - ${cartao.nome}</h2>
    <p><strong>Valor:</strong> ${formatarMoeda(totalFatura)}</p>

    <label>Comprovante:</label>
    <input type="file" id="inputComprovante" accept="image/*,application/pdf">

    <button onclick="confirmarPagamentoFatura(${cartaoId}, '${mesInput}')">
      Confirmar Pagamento
    </button>
  `;

  abrirModal("Pagamento de Fatura", html);
}

async function confirmarPagamentoFatura(cartaoId, mesInput) {

  const inputFile = document.getElementById("inputComprovante");
  const file = inputFile.files[0];

  if (!file) {
    alert("Selecione um comprovante.");
    return;
  }

  const base64 = await arquivoParaBase64(file);

  const [ano, mes] = mesInput.split("-").map(Number);
  const cartao = await db.cartoes.get(cartaoId);

  const diaFechamento = Number(cartao.fechamento);
  const dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59);
  const dataInicio = new Date(ano, mes - 2, diaFechamento + 1, 0, 0, 0);

  const despesas = await db.despesas.where("cartaoId").equals(cartaoId).toArray();

  const despesasCiclo = despesas.filter(d => {
    if (d.formaPagamento !== "cartao") return false;
    const data = new Date(d.data);
    return data >= dataInicio && data <= dataFim;
  });

  const totalFatura = despesasCiclo.reduce(
    (acc, d) => acc + Number(d.valor),
    0
  );

  // Impede pagar duas vezes
  const jaPaga = await db.pagamentosFatura
    .where({ cartaoId, ano, mes })
    .first();

  if (jaPaga) {
    alert("Essa fatura já foi paga.");
    return;
  }

  const pagamentoId = await db.pagamentosFatura.add({
    cartaoId,
    ano,
    mes,
    valor: totalFatura,
    dataPagamento: new Date()
  });

  await db.cartoes.update(cartaoId, {
    limiteAtual: cartao.limiteAtual + totalFatura
  });

  await db.comprovantes.add({
    tipo: "fatura",
    referenciaId: pagamentoId,
    arquivo: base64,
    nomeArquivo: file.name,
    dataUpload: new Date()
  });

  fecharModal();

  await Promise.all([
    carregarResumoCartoes(),
    carregarContasPendentes(),
    atualizarDashboard()
  ]);

  alert("✅ Fatura paga com sucesso!");
}

async function abrirModalPagamentoPix(despesaId) {

  const despesa = await db.despesas.get(despesaId);

  const html = `
    <h2>Pagar Pix</h2>
    <p><strong>${despesa.descricao || "Sem descrição"}</strong></p>
    <p>${formatarMoeda(Number(despesa.valor))}</p>

    <label>Comprovante:</label>
    <input type="file" id="inputComprovante" accept="image/*,application/pdf">

    <button onclick="confirmarPagamentoPix(${despesaId})">
      Confirmar Pagamento
    </button>
  `;

  abrirModal("Pagamento Pix", html);
}

async function confirmarPagamentoPix(despesaId) {

  const inputFile = document.getElementById("inputComprovante");
  const file = inputFile.files[0];

  if (!file) {
    alert("Selecione um comprovante.");
    return;
  }

  const base64 = await arquivoParaBase64(file);

  await db.despesas.update(despesaId, {
    pago: true
  });

  await db.comprovantes.add({
    tipo: "pix",
    referenciaId: despesaId,
    arquivo: base64,
    nomeArquivo: file.name,
    dataUpload: new Date()
  });

  fecharModal();

  await Promise.all([
    carregarContasPendentes(),
    atualizarDashboard()
  ]);

  alert("✅ Pix marcado como pago!");
}