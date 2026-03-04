/////////////////////////////////////////

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

/////////////////////////////////////////

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
        <label>Nome</label>
        <input id="categoriaNome" placeholder="Ex: Alimentação, Lazer..." required autofocus>
      </div>

      <label>Selecione um ícone</label></div>
      <div class="icone-principal-wrapper">
        <div id="iconePrincipal1" class="icone-principal selecionado" 
             data-icone="restaurant" 
             onclick="selecionarIconePrincipal(this)">
          <span class="material-icons">restaurant</span>
        </div>

        <div class="icone-principal" 
             data-icone="directions_car" 
             onclick="selecionarIconePrincipal(this)">
          <span class="material-icons">directions_car</span>
        </div>

        <div class="icone-principal" 
             data-icone="checkroom" 
             onclick="selecionarIconePrincipal(this)">
          <span class="material-icons">checkroom</span>
        </div>

        <button type="button" class="btn-outros" onclick="abrirModalIcones()">Outros...</button>
      </div>

      <input type="hidden" id="iconeCategoria" value="restaurant">

      <div class="input-group-color">
        <label>Cor</label>
        <input type="color" id="corCategoria" value="#673ab7" onchange="atualizarCorIcone()" class="input-color-ajustado">
        </div>
      </div>

      <button type="submit" class="save-btn">Salvar Categoria</button>
    </form>
  `);

  // Garante a execução inicial da cor e configura o listener do form
  setTimeout(() => {
    atualizarCorIcone();
    const form = document.getElementById('formCategoria');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarCategoria();
      });
    }
  }, 50);
}

function adicionarPessoa() {

  abrirModal("Nova Pessoa", `
    <input id="pessoaNome" placeholder="Nome da pessoa">
    <button class="save-btn" onclick="salvarPessoa()">Salvar</button>
  `);
}

/////////////////////////////////////////

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

async function salvarPessoa() {

  const nome = document.getElementById("pessoaNome").value;
  if (!nome) return;

  await db.pessoas.add({ nome });

  fecharModal();
  listarPessoas();
}

/////////////////////////////////////////

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

/////////////////////////////////////////

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
              <span class="material-icons">${c.icone}</span>
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

/////////////////////////////////////////

/* ================= CATEGORIAS ================= */


let iconeSelecionado = "restaurant";



function selecionarIconePrincipal(elemento) {

  document.querySelectorAll(".icone-principal")
    .forEach(el => el.classList.remove("selecionado"));

  elemento.classList.add("selecionado");

  iconeSelecionado = elemento.getAttribute("data-icone");
  document.getElementById("iconeCategoria").value = iconeSelecionado;

  atualizarCorIcone();
}

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

function gerarListaIconesModal() {

  const icones = [
    // --- TRANSPORTE & VEÍCULOS ---
    "motorcycle", "directions_car", "local_gas_station", "tire_repair", "directions_bus", "train", "taxi_alert",

    // --- CASA & CONTAS ---
    "home", "lightbulb", "water_drop", "wifi", "router", "faucet", "bolt", "umbrella", "key",

    // --- ALIMENTAÇÃO ---
    "shopping_cart", "local_grocery_store", "restaurant", "lunch_dining", "local_pizza", "bakery_dining", "coffee", "local_bar",

    // --- FAMÍLIA & NENÉM ---
    "child_care", "baby_changing_station", "toys", "family_restroom", "school", "face_6",

    // --- SAÚDE & BEM-ESTAR ---
    "medical_services", "pill", "vaccines", "fitness_center", "self_care", "spa", "dentist",

    // --- LAZER & TECNOLOGIA ---
    "sports_esports", "movie", "theater_comedy", "smartphone", "laptop_mac", "camera_alt", "headset", "tv",

    // --- PESSOAL & MODA ---
    "styler", "checkroom", "shopping_bag", "diamond", "watch", "content_cut",

    // --- FINANCEIRO & TRABALHO ---
    "payments", "credit_card", "account_balance", "savings", "work", "trending_up", "receipt_long", "contract"
  ];


  return icones.map(icone => `
    <div class="icone-item" onclick="selecionarIconeDoModal('${icone}')">
      <span class="material-icons">${icone}</span>
    </div>
  `).join("");
}

function selecionarIconeDoModal(icone) {

  iconeSelecionado = icone;

  const iconePrincipal = document.getElementById("iconePrincipal1");

  iconePrincipal.setAttribute("data-icone", icone);
  iconePrincipal.innerHTML =
    `<span class="material-icons">${icone}</span>`;

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

function fecharModalIcones() {
  document.getElementById("modalIconesOverlay")
    .classList.add("hidden");
}



function adicionarSubcategoria(categoriaId) {

  abrirModal("Nova Subcategoria", `
    <input id="subNome" placeholder="Nome da subcategoria">
    <button class="save-btn" onclick="salvarSubcategoria(${categoriaId})">Salvar</button>
  `);
}

async function salvarSubcategoria(categoriaId) {

  const nome = document.getElementById("subNome").value;
  if (!nome) return;

  await db.subcategorias.add({
    nome,
    categoriaId
  });

  fecharModal();
  listarCategorias();
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















/////////////////////////////////////////

// importar e exportar o db

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

// ⚠️ Essa versão APAGA o banco atual antes de importar.

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

        console.log("CONFIRMOU");

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


/////////////////////////////////////////