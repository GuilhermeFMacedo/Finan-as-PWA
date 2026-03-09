/////////////////////////////////////////

// 1. CONSTANTES E CONFIGURAÇÕES
const gruposIcones = {

  "Transporte": [
    "motorcycle","directions_car","local_gas_station","tire_repair",
    "directions_bus","train","taxi_alert"
  ],

  "Casa": [
    "home","lightbulb","water_drop","wifi","router","faucet","bolt","key"
  ],

  "Alimentação": [
    "shopping_cart","local_grocery_store","restaurant","lunch_dining",
    "local_pizza","bakery_dining","coffee","local_bar"
  ],

  "Família": [
    "child_care","baby_changing_station","toys","family_restroom","school"
  ],

  "Saúde": [
    "medical_services","pill","vaccines","fitness_center","spa",
  ],

  "Lazer": [
    "sports_esports","movie","theater_comedy","camera_alt","headset","tv"
  ],

  "Tecnologia": [
    "smartphone","laptop_mac"
  ],

  "Pessoal": [
    "styler","checkroom","shopping_bag","watch","content_cut"
  ],

  "Financeiro": [
    "payments","credit_card","account_balance","savings",
    "receipt_long","trending_up","contract"
  ],

  "Extras": [
    "pets","flight","luggage","store","subscriptions","menu_book","business_center"
  ]

};
let iconeSelecionado = "motorcycle";

// 2. FLUXO DE TELAS (CONFIGURAÇÃO)
async function abrirCartoes() {

  const container = document.getElementById("config-content");

  container.innerHTML = `
    <h3>Cartões</h3>
    <button onclick="adicionarCartao()">Adicionar Cartão</button>
    <div id="lista-cartoes"></div>
  `;

  listarCartoes();
}

async function abrirCategorias() {

  const container = document.getElementById("config-content");

  container.innerHTML = `
    <h3>Categorias</h3>
    <button onclick="adicionarCategoria()">Adicionar Categoria</button>
    <div id="lista-categorias"></div>
  `;

  listarCategorias();
}

async function abrirPessoas() {
  // Se você estiver usando o mesmo padrão de troca de conteúdo dinâmico:
  const container = document.getElementById("config-content");

  if (container) {
    container.innerHTML = `
      <h3>Pessoas</h3>
      <button class="primary-btn" onclick="adicionarPessoa()">
        Adicionar Pessoa
      </button>
      <div id="lista-pessoas"></div>
    `;
  }

  listarPessoas();
}

async function abrirHistorico() {
  // 1. Seleciona a seção correta (conforme o ID que corrigimos no HTML)
  const container = document.getElementById("page-historico");

  if (!container) {
    console.error("Erro: A seção 'page-historico' não existe no HTML.");
    return;
  }


  // 3. Seleciona onde a lista de transações vai de fato entrar
  const lista = document.getElementById("lista-historico");

  try {
    // Busca os dados no banco (Dexie/IndexedDB)
    const [despesas, pagamentosFatura, cartoes, comprovantes] = await Promise.all([
      db.despesas.toArray(),
      db.pagamentosFatura.toArray(),
      db.cartoes.toArray(),
      db.comprovantes.toArray()
    ]);

    const cartMap = new Map(cartoes.map(c => [c.id, c]));
    
    // Funções auxiliares de formatação
    const escape = str => str ? str.replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[m])) : '';
    const fMoeda = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const fData = d => {
      const data = new Date(d);
      return `${data.getDate().toString().padStart(2,'0')}/${(data.getMonth()+1).toString().padStart(2,'0')}/${data.getFullYear()}`;
    };

    let htmlBuffer = "";

    // --- SEÇÃO: PIX PAGOS ---
    const pixPagos = despesas.filter(d => d.formaPagamento === "pix" && d.pago);
    if (pixPagos.length > 0) {
      htmlBuffer += `<h4 class="config-grupo">PIX Pagos</h4>`;
      pixPagos.forEach(d => {
        const comprovante = comprovantes.find(c => c.tipo === "pix" && c.referenciaId === d.id);
        htmlBuffer += `
          <div class="item-config" style="border-left: 4px solid #6366f1">
            <div class="info-primaria">
              <strong>${escape(d.descricao || "PIX")}</strong>
            </div>
            <div class="info-detalhes">
              <small>Valor: <strong>${fMoeda(d.valor)}</strong></small>
              <small>Data: ${fData(d.data)}</small>
            </div>
            ${comprovante ? `<button class="btn-ver-comprovante" onclick="verComprovante('${comprovante.id}')">📄 Ver Recibo</button>` : ''}
          </div>
        `;
      });
    }

    // --- SEÇÃO: FATURAS PAGAS ---
    if (pagamentosFatura.length > 0) {
      htmlBuffer += `<h4 class="config-grupo">Faturas de Cartão</h4>`;
      pagamentosFatura.forEach(p => {
        const cartao = cartMap.get(p.cartaoId);
        const comprovante = comprovantes.find(c => c.tipo === "fatura" && c.referenciaId === p.id);
        htmlBuffer += `
          <div class="item-config" style="border-left: 4px solid ${cartao?.cor || '#ccc'}">
            <div class="info-primaria">
              <strong>Fatura: ${escape(cartao?.nome || 'Cartão')}</strong>
            </div>
            <div class="info-detalhes">
              <small>Valor: <strong>${fMoeda(p.valor)}</strong></small>
              <small>Pago em: ${fData(p.dataPagamento)}</small>
            </div>
            ${comprovante ? `<button class="btn-ver-comprovante" onclick="verComprovante('${comprovante.id}')">📄 Ver Recibo</button>` : ''}
          </div>
        `;
      });
    }

    // Se não houver nada em nenhuma categoria
    if (!pixPagos.length && !pagamentosFatura.length) {
      htmlBuffer = `<p class="vazio">🤷‍♂️ Nenhum pagamento registrado no histórico.</p>`;
    }

    lista.innerHTML = htmlBuffer;

  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);
    lista.innerHTML = '<p class="erro">Falha ao acessar o banco de dados.</p>';
  }
}

// 3. Criação de Dados
function adicionarCartao() {
  abrirModal("Novo Cartão", `
    <form id="formCartao" class="modal-form">
      <div class="form-group">
        <label>Nome do Cartão</label>
        <input id="cartaoNome" placeholder="Ex: NuBank, Inter..." required>
      </div>

        <div class="form-group">
          <label>Limite Total</label>
          <input id="cartaoLimite" type="number" step="0.01" placeholder="R$ 0,00" required>
        </div>
      

      
        <div class="form-group">
          <label>Fechamento (Dia)</label>
          <input id="cartaoFechamento" type="number" placeholder="1-31" min="1" max="31" required>
        </div>
        <div class="form-group">
          <label>Vencimento (Dia)</label>
          <input id="cartaoVencimento" type="number" placeholder="1-31" min="1" max="31" required>
        </div>
            
      <div class="input-group-color">
        <label>Cor</label>
        <input type="color" id="corCartao" value="#673ab7">
      </div>

      <button type="submit" id="btnSalvarCartao" class="save-btn" onclick="salvarCartao()">
        Salvar Cartão
      </button>
    </form>
  `);

  // Configura o evento de salvar logo após abrir o modal
  const form = document.getElementById('formCartao');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Impede o refresh da página
    await salvarCartao();
  });
}

function adicionarCategoria() {
  abrirModal("Nova Categoria", `
    <form id="formCategoria" class="modal-form">
      <div class="form-group">
        <label for="categoriaNome">Nome</label>
        <input id="categoriaNome" placeholder="Ex: Alimentação, Lazer..." required>
      </div>

      <div class="form-group">
       <label for="titulo-icones">Selecione um ícone</label>
        <div class="icone-principal-wrapper" aria-labelledby="titulo-icones">
          <div id="iconePrincipal1" class="icone-principal selecionado" 
               data-icone="motorcycle" 
               onclick="selecionarIconePrincipal(this)">
            <span class="material-symbols-outlined">restaurant</span>
          </div>

          <div class="icone-principal" 
               data-icone="directions_car" 
               onclick="selecionarIconePrincipal(this)">
            <span class="material-symbols-outlined">directions_car</span>
          </div>

          <div class="icone-principal" 
               data-icone="checkroom" 
               onclick="selecionarIconePrincipal(this)">
            <span class="material-symbols-outlined">checkroom</span>
          </div>

          <button type="button" class="btn-outros" onclick="abrirModalIcones()">Outros...</button>
        </div>
      </div>

      <input type="hidden" id="iconeCategoria" value="restaurant">

      <div class="input-group-color">
        <label for="corCategoria">Cor</label>
        <input type="color" id="corCategoria" value="#673ab7" onchange="atualizarCorIcone()" class="input-color-ajustado">
      </div>

      <button type="submit" class="save-btn">Salvar Categoria</button>
    </form>
  `);

  // Ajustes de inicialização
  setTimeout(() => {
    atualizarCorIcone();
    
    // Resolve o erro de Autofocus focando manualmente após o modal abrir
    const inputNome = document.getElementById('categoriaNome');
    if (inputNome) inputNome.focus();

    const form = document.getElementById('formCategoria');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarCategoria();
      });
    }
  }, 50);
}

function adicionarSubcategoria(categoriaId) {

  abrirModal("Nova Subcategoria", `
    <input id="subNome" placeholder="Nome da subcategoria">
    <button class="save-btn" onclick="salvarSubcategoria(${categoriaId})">Salvar</button>
  `);
}

function adicionarPessoa() {

  abrirModal("Nova Pessoa", `
    <input id="pessoaNome" placeholder="Nome da pessoa">
    <button class="save-btn" onclick="salvarPessoa()">Salvar</button>
  `);
}

// 4. Persistência de Dados
// Salvar
async function salvarCartao() {
  const btn = document.getElementById("btnSalvarCartao");

  // Captura dos valores
  const nome = document.getElementById("cartaoNome").value.trim();
  const limite = parseFloat(document.getElementById("cartaoLimite").value);
  const fechamento = parseInt(document.getElementById("cartaoFechamento").value);
  const vencimento = parseInt(document.getElementById("cartaoVencimento").value);
  const cor = document.getElementById("corCartao").value;

  // Validação Básica
  if (!nome || isNaN(limite) || limite <= 0) {
    mostrarErro("Por favor, preencha o nome e um limite válido.");
    return false;
  }

  // Feedback visual no botão
  btn.disabled = true;
  btn.textContent = "Salvando...";

  try {
    await db.cartoes.add({
      nome,
      limite,
      limiteAtual: limite,
      fechamento,
      vencimento,
      cor
    });
    notificarSucesso("Cartão criado com sucesso!");
    fecharModal();
    listarCartoes(); // Atualiza a lista na tela
  } catch (erro) {
    console.error("Erro ao salvar cartão:", erro);
    mostrarErro("Ops! Erro ao salvar o cartão.");
  } finally {
    // Caso o modal não feche por erro, reabilita o botão
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Salvar Cartão";
    }
  }
}

async function salvarCategoria() {
  // Busca o botão dentro do formulário para evitar erro de 'null'
  const btn = document.querySelector("#formCategoria .save-btn");

  const nomeInput = document.getElementById("categoriaNome");
  const nome = nomeInput.value.trim();
  const icone = document.getElementById("iconeCategoria").value; // Recomendo pegar do input hidden que você já tem
  const cor = document.getElementById("corCategoria").value;

  if (!nome) {
    mostrarErro("Digite um nome para a categoria");
    nomeInput.focus();
    return false;
  }

  // Proteção contra cliques duplos e erro de 'null'
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Salvando...";
  }

  try {
    await db.categorias.add({
      nome: nome,
      icone: icone,
      cor: cor
    });
    notificarSucesso("Categoria criada com sucesso!");
    fecharModal();
    listarCategorias();

  } catch (erro) {
    console.error("Erro ao salvar categoria:", erro);
    mostrarErro("Erro ao salvar categoria. Tente novamente.");

    // Devolve o botão ao estado normal apenas se o modal ainda estiver aberto
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Salvar Categoria";
    }
  }
}

async function salvarSubcategoria(categoriaId) {

  const nome = document.getElementById("subNome").value;
  if (!nome) return;

  await db.subcategorias.add({
    nome,
    categoriaId
  });
  notificarSucesso("SubCategoria criada com sucesso!");
  fecharModal();
  listarCategorias();
}

async function salvarPessoa() {

  const nome = document.getElementById("pessoaNome").value;
  if (!nome) return;

  await db.pessoas.add({ nome });
  notificarSucesso("Pessoa criada com sucesso!");
  fecharModal();
  listarPessoas();
}

// Excluir
async function excluirCartao(id) {
  await db.cartoes.delete(id);
  listarCartoes();
}

async function excluirCategoria(id) {
  await db.categorias.delete(id);
  await db.subcategorias.where("categoriaId").equals(id).delete();
  listarCategorias();
}

async function excluirSubcategoria(id) {
  await db.subcategorias.delete(id);
  listarCategorias();
}

async function excluirPessoa(id) {
  await db.pessoas.delete(id);
  listarPessoas();
}

// 5. Listagem e Renderização
async function listarCartoes() {
  const lista = document.getElementById("lista-cartoes");

  try {
    const cartoes = await db.cartoes.toArray();

    if (cartoes.length === 0) {
      lista.innerHTML = '<p class="vazio">Nenhum cartão cadastrado.</p>';
      return;
    }

    // Helper para formatar moeda e evitar repetição
    const fMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Helper para evitar ataques de script (XSS)
    const escape = (str) => str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" }[m]));

    const htmlBuffer = cartoes.map(c => `
      <div class="item-config" style="--cor-cartao: ${c.cor || '#ccc'}">
        <div class="info-primaria">
          <span class="indicador-cor"></span>
          <strong>${escape(c.nome)}</strong>
        </div>
        
        <div class="info-detalhes">
          <small>Limite: ${fMoeda(c.limite)}</small>
          <small>Disponível: <strong>${fMoeda(c.limiteAtual)}</strong></small>
          <small>Fechamento: Dia ${c.fechamento}</small>
          <small>Vencimento: Dia ${c.vencimento}</small>
        </div>

        <button class="btn-excluir" onclick="excluirCartao(${c.id})" title="Excluir">
          🗑️
        </button>
      </div>
    `).join('');

    lista.innerHTML = htmlBuffer;

  } catch (erro) {
    console.error("Erro ao carregar cartões:", erro);
    lista.innerHTML = '<p class="erro">Falha ao sincronizar dados.</p>';
  }
}

async function listarCategorias() {
  const lista = document.getElementById("lista-categorias");

  try {
    const [categorias, subcategorias] = await Promise.all([
      db.categorias.toArray(),
      db.subcategorias.toArray()
    ]);

    if (categorias.length === 0) {
      lista.innerHTML = '<p class="vazio">Nenhuma categoria cadastrada.</p>';
      return;
    }

    const escape = (str) => str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" }[m]));

    const htmlBuffer = categorias.map(c => {
      const subs = subcategorias.filter(s => s.categoriaId === c.id);

      return `
        <div class="cat-card" style="--cor-cat: ${c.cor}">
          <div class="cat-main-info">
            <div class="cat-icon-box">
              <span class="material-symbols-outlined">${c.icone}</span>
            </div>
            <span class="cat-title">${escape(c.nome)}</span>
          </div>

          <div class="cat-subs-wrapper">
            <div class="cat-tags-flex">
              ${subs.map(s => `
                <div class="cat-tag">
                  <span>${escape(s.nome)}</span>
                  <button class="cat-btn-del-sub" onclick="excluirSubcategoria(${s.id})">×</button>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="cat-actions">
            <button class="cat-btn-add" onclick="adicionarSubcategoria(${c.id})">
              + Sub
            </button>
            <button class="btn-excluir" onclick="excluirCategoria(${c.id})">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    lista.innerHTML = htmlBuffer;

  } catch (erro) {
    console.error("Erro ao listar categorias:", erro);
  }
}

async function listarPessoas() {
  const lista = document.getElementById("lista-pessoas");

  try {
    const pessoas = await db.pessoas.toArray();

    const escape = (str) => str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "&#39;" }[m]));

    const htmlBuffer = pessoas.map(p => `
      <div class="pes-item">
        <div class="pes-info">
          <div class="pes-avatar">
            ${p.nome.charAt(0).toUpperCase()}
          </div>
          <span class="pes-nome">${escape(p.nome)}</span>
        </div>

        <button class="btn-excluir" onclick="excluirPessoa(${p.id})" title="Excluir Pessoa">
          🗑️
        </button>
      </div>
    `).join('');

    lista.innerHTML = htmlBuffer || '<p class="pes-vazio">Nenhuma pessoa cadastrada.</p>';

  } catch (erro) {
    console.error("Erro ao listar pessoas:", erro);
  }
}

// 6. Lógica de Ícones e Comprovantes
// Ícones
function fecharModalIcones() {
  document.getElementById("modalIconesOverlay")
    .classList.add("hidden");
}

function selecionarIconePrincipal(elemento) {

  document.querySelectorAll(".icone-principal")
    .forEach(el => el.classList.remove("selecionado"));

  elemento.classList.add("selecionado");

  iconeSelecionado = elemento.getAttribute("data-icone");
  document.getElementById("iconeCategoria").value = iconeSelecionado;

  atualizarCorIcone();
}

function selecionarIconeDoModal(icone) {

  iconeSelecionado = icone;

  const iconePrincipal = document.getElementById("iconePrincipal1");

  iconePrincipal.setAttribute("data-icone", icone);
  iconePrincipal.innerHTML =
    `<span class="material-symbols-outlined">${icone}</span>`;

  document.getElementById("iconeCategoria").value = icone;

  atualizarCorIcone();

  fecharModalIcones();
}

function abrirModalIcones() {

  const container = document.getElementById("listaIconesModal");

  container.innerHTML = gerarListaIconesModal();

  document.getElementById("modalIconesOverlay")
    .classList.remove("hidden");
}

function gerarListaIconesModal() {
  let html = "";

  Object.entries(gruposIcones).forEach(([grupo, icones]) => {

    html += `<div class="grupo-icones">`;

    html += `<h4 class="titulo-grupo">${grupo}</h4>`;

    html += `<div class="grade-icones">`;

    icones.forEach(icone => {

      html += `
        <div class="icone-item" onclick="selecionarIconeDoModal('${icone}')">
          <span class="material-symbols-outlined">${icone}</span>
        </div>
      `;

    });

    html += `</div>`;
    html += `</div>`; // FECHA O GRUPO

  });

  return html;
}

window.atualizarCorIcone = function () {

  const corInput = document.getElementById("corCategoria");
  if (!corInput) return;

  const cor = corInput.value;

  document.querySelectorAll(".icone-principal")
    .forEach(el => {
      if (el.classList.contains("selecionado")) {
        el.style.background = cor;
      } else {
        el.style.background = "#444";
      }
    });
};

function selecionarIcone(elemento) {
  document.querySelectorAll(".icone-principal, .icone-item")
    .forEach(el => el.classList.remove("selecionado"));

  elemento.classList.add("selecionado");

  document.getElementById("iconeCategoria").value =
    elemento.getAttribute("data-icone");
}

function toggleGradeIcones() {
  document.getElementById("gradeIcones")
    .classList.toggle("hidden");
}

// Histórico/Comprovantes
async function verComprovante(comprovanteId) {
  const comprovante = await db.comprovantes.get(Number(comprovanteId));
  
  if (!comprovante) {
    alert("Comprovante não encontrado.");
    return;
  }

  const arquivo = comprovante.arquivo;
  const isImage = arquivo.startsWith("data:image");

  // No celular, botões grandes e fáceis de tocar (Touch Friendly)
  let botoes = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
      <a href="${arquivo}" download="comprovante.png" 
         style="text-decoration:none; background:#22c55e; color:white; padding:12px; border-radius:8px; text-align:center; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;">
         📥 Salvar
      </a>
      
      <button onclick="compartilharComprovante('${arquivo}')" 
         style="background:#6366f1; color:white; padding:12px; border-radius:8px; border:none; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:5px;">
         📤 Enviar
      </button>
    </div>
  `;

  let exibicao = "";
  if (isImage) {
    exibicao = `
      <div style="width:100%; overflow:hidden; border-radius:8px; background:#f0f0f0;">
        <img src="${arquivo}" 
             style="width:100%; display:block; height:auto; pointer-events: auto;"
             id="imgComprovante">
      </div>
      <p style="font-size:12px; color:#666; text-align:center; margin-top:8px;">
        💡 Dica: Você pode usar o gesto de pinça para dar zoom.
      </p>
    `;
  } else {
    exibicao = `<iframe src="${arquivo}" width="100%" height="400px" style="border:none; border-radius:8px;"></iframe>`;
  }

  abrirModal("Comprovante", botoes + exibicao);
}

async function compartilharComprovante(base64Data) {
  try {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    const file = new File([blob], "comprovante.png", { type: blob.type });

    if (navigator.share) {
      await navigator.share({
        files: [file],
        title: 'Comprovante',
        text: 'Segue comprovante de pagamento.',
      });
    } else {
      alert("Seu navegador não suporta compartilhamento direto. Use o botão Salvar.");
    }
  } catch (err) {
    console.error("Erro ao compartilhar:", err);
  }
}

// 7. Importação e Exportação
async function exportarDados() {
  try {

    limparErro("backupErro");

    const backup = {
      versaoApp: 1,
      versaoDB: db.verno,
      dataExportacao: new Date().toISOString(),
      dados: {}
    };

    for (const table of db.tables) {
      backup.dados[table.name] = await table.toArray();
    }

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `financas-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();

    URL.revokeObjectURL(url);

    // ✅ SUCESSO
    mostrarErro(
      "Backup exportado com sucesso!",
      "backupErro",
      true,
      "sucesso"
    );

  } catch (error) {
    console.error("Erro ao exportar:", error);

    // ❌ ERRO
    mostrarErro(
      "Erro ao exportar os dados.",
      "backupErro",
      false,
      "erro"
    );
  }
}

async function importarDados(file) {
  try {

    limparErro("backupErro");

    const texto = await file.text();
    const backup = JSON.parse(texto);

    if (!backup.dados) {
      mostrarErro("Arquivo inválido.", "backupErro", false, "erro");
      return;
    }

    if (backup.versaoDB > db.verno) {
      mostrarErro(
        "Este backup foi feito em uma versão mais nova do aplicativo.",
        "backupErro",
        false,
        "erro"
      );
      return;
    }

    confirmarAcao(
      "Isso apagará TODOS os dados atuais. Deseja continuar?",
      async () => {

        await db.transaction("rw", db.tables, async () => {

          for (const table of db.tables) {
            await table.clear();
          }

          for (const tableName in backup.dados) {
            if (db.table(tableName)) {
              await db.table(tableName).bulkAdd(backup.dados[tableName]);
            }
          }

        });

        mostrarErro(
          "Importação concluída com sucesso!",
          "backupErro",
          true,
          "sucesso"
        );

        notificarSucesso("CONFIRMOU");

        setTimeout(() => location.reload(), 1500);
      }
    );

  } catch (error) {
    console.error("Erro ao importar:", error);

    mostrarErro(
      "Erro ao importar os dados.",
      "backupErro",
      false,
      "erro"
    );
  }
}
