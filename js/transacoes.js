function abrirModalTipo() {

  abrirModal("Nova Transação", `
    <div class="tipo-container">
      <button class="btn-receita" onclick="abrirModalReceita()">
        <span class="material-symbols-outlined">arrow_upward</span>
        Receita
      </button>

      <button class="btn-despesa" onclick="abrirModalDespesa()">
        <span class="material-symbols-outlined">arrow_downward</span>
        Despesa
      </button>
    </div>
  `);
}

async function abrirModalReceita() {
  fecharModal();
  const hoje = new Date().toISOString().split('T')[0];

  abrirModal('Nova Receita', `
    <form id="formReceita">
      <div class="form-group">
        <label>Quem Recebeu?</label>
        <select id="pessoaReceita" required></select> 
      </div>
      <div class="form-group">
        <input type="number" id="valorReceita" placeholder="0,00" step="0.01" required>
      </div>
      <div class="form-group">
        <input type="date" id="dataReceita" value="${hoje}" required>
      </div>
      <button type="submit" class="save-btn" id="btnSalvarReceita">Salvar Receita</button>
    </form>
  `);

  // Carrega as pessoas passando o ID correto do select
  await carregarPessoas("pessoaReceita"); 

  // Captura o formulário e adiciona o evento
  const form = document.getElementById('formReceita');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Verificação de segurança antes de chamar a função
    if(!document.getElementById('pessoaReceita')) {
       console.error("ERRO: Elementos do modal sumiram antes do save.");
       return;
    }

    const sucesso = await salvarReceita();
    if (sucesso) fecharModal();
  });
}

async function salvarReceita() {
  // 1. Pegar os elementos exatamente com os IDs definidos no abrirModal
  const vInput = document.getElementById('valorReceita');
  const dInput = document.getElementById('dataReceita');
  const pInput = document.getElementById('pessoaReceita');
  const btn = document.getElementById('btnSalvarReceita');

  // 2. Verificação de existência (Onde dava o seu erro)
  if (!vInput || !dInput || !pInput) {
    console.error("Elementos encontrados:", { vInput, dInput, pInput });
    throw new Error('Campos do formulário não encontrados no DOM');
  }

  try {
    const valor = parseFloat(vInput.value);
    const dataStr = dInput.value;
    const pessoaId = pInput.value;

    if (!pessoaId) throw new Error('Selecione uma pessoa');
    if (isNaN(valor) || valor <= 0) throw new Error('Valor inválido');

    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    
    const novaReceita = {
      valor: valor,
      data: dataStr, // String YYYY-MM-DD para o Extrato não quebrar
      pessoaId: Number(pessoaId),
      timestamp: dataObj.getTime(),
      createdAt: new Date()
    };
    
    await db.receitas.add(novaReceita);
    
    // Atualiza a UI
    await Promise.all([
      listarTransacoes(),
      atualizarDashboard()
    ]);
    
    return true; 
    
  } catch (error) {
    mostrarErro(error.message);
    return false;
  }
}

// --- 1. CONFIGURAÇÃO INICIAL (Coloque isso fora da função listar) ---
function configurarFiltros() {
  const selMes = document.getElementById("selMes");
  const selAno = document.getElementById("selAno");
  if (!selMes || !selAno) return;

  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const hoje = new Date();

  // Preenche Meses
  if (selMes.options.length === 0) {
    selMes.innerHTML = meses.map((mes, i) => 
      `<option value="${i}" ${i === hoje.getMonth() ? 'selected' : ''}>${mes}</option>`
    ).join("");
  }

  // Preenche Anos
  if (selAno.options.length === 0) {
    const anoAtual = hoje.getFullYear();
    for (let i = anoAtual - 1; i <= anoAtual + 3; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.text = i;
      if (i === anoAtual) opt.selected = true;
      selAno.appendChild(opt);
    }
  }

  // Adiciona eventos para recarregar ao mudar
  selMes.onchange = () => listarTransacoes();
  selAno.onchange = () => listarTransacoes();
}

async function listarTransacoes() {
  configurarFiltros(); // Garante que os selects existam

  const lista = document.getElementById("lista-transacoes");
  const selMes = document.getElementById("selMes");
  const selAno = document.getElementById("selAno");
  
  if (!lista || !selMes || !selAno) return;

  const mesFiltro = parseInt(selMes.value);
  const anoFiltro = parseInt(selAno.value);

  try {
    const [receitas, despesas, cats, subcats, pess, carts] = await Promise.all([
      db.receitas.toArray(),
      db.despesas.toArray(),
      db.categorias.toArray(),
      db.subcategorias.toArray(),
      db.pessoas.toArray(),
      db.cartoes.toArray()
    ]);

    const catMap = new Map(cats.map(c => [c.id, c.nome]));
    const subMap = new Map(subcats.map(s => [s.id, s.nome]));
    const pessMap = new Map(pess.map(p => [p.id, p.nome]));
    const cartMap = new Map(carts.map(c => [c.id, c.nome]));

    // --- FILTRO COM DEBUG ---
    const todas = [
      ...receitas.map(r => ({ ...r, tipo: "receita" })),
      ...despesas.map(d => ({ ...d, tipo: "despesa" }))
    ].filter(t => {
      // 1. Forçar a data para o início do dia para evitar erros de fuso horário
      let d;
      if (typeof t.data === 'string') {
        // Se a string vier YYYY-MM-DD, o replace garante que o JS não use UTC
        d = new Date(t.data.replace(/-/g, '\/'));
      } else {
        d = new Date(t.data);
      }

      const m = d.getMonth();
      const a = d.getFullYear();

      // DEBUG: Abra o console (F12) e veja se isso aparece
      if (a === anoFiltro) {
         console.log(`Transação ID: ${t.id} | Mês: ${m} (Buscando: ${mesFiltro}) | Ano: ${a}`);
      }

      return m === mesFiltro && a === anoFiltro;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));

    // --- RENDERIZAÇÃO ---
    if (todas.length === 0) {
      lista.innerHTML = `<p class="lista-vazia">Nenhum dado para ${selMes.options[selMes.selectedIndex].text}/${anoFiltro}</p>`;
      return;
    }

    lista.innerHTML = todas.map(t => {
  const isDespesa = t.tipo === "despesa";
  
  // Normalização da Data (Proteção contra Date/String)
  const dataString = typeof t.data === 'string' ? t.data : t.data.toISOString().split('T')[0];
  const dataFormatada = dataString.split("-").reverse().join("/");
  const valorFormatado = t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  // Busca de Dados Relacionados
  const categoria = cats.find(c => c.id === Number(t.categoriaId)) || 
                    { nome: 'Receita', icone: 'payments', cor: '#22c55e' };
  
  const subNome = subMap.get(Number(t.subcategoriaId));
  const pessoaNome = pessMap.get(Number(t.pessoaId)) || 'Ninguém';
  const cartaoObj = carts.find(c => c.id === Number(t.cartaoId));

  // Cores dinâmicas
  const corDestaque = isDespesa ? (categoria.cor || '#f87171') : '#22c55e';
  const corBadgeCard = (isDespesa && cartaoObj) ? cartaoObj.cor : 'transparent';

  return `
    <div class="card-extrato ${t.tipo}" 
         style="--cor-cat: ${corDestaque}; --cor-card: ${corBadgeCard}">

      <div class="icon-box">
        <span class="material-icons">
          ${isDespesa ? categoria.icone : 'trending_up'}
        </span>
      </div>

      <div class="extrato-content">
        <div class="extrato-main-row">
          <div class="extrato-texts">
            ${isDespesa && subNome ? `<span class="extrato-sub">${subNome}</span>` : ''}
            ${!isDespesa ? `<span class="extrato-sub">Entrada</span>` : ''}
            <span class="extrato-desc">${t.descricao || (isDespesa ? categoria.nome : 'Receita')}</span>
          </div>

          <div class="extrato-amount ${isDespesa ? 'negativo' : 'positivo'}">
            ${isDespesa ? '-' : '+'} R$ ${valorFormatado}
          </div>
        </div>

        <div class="extrato-info-row">
          <div class="extrato-meta">
            <span>${dataFormatada}</span>
            <span class="sep">•</span>
            <span>👤 ${pessoaNome.split(' ')[0]}</span>
          </div>

          <div class="extrato-badges">
            ${isDespesa ? `
              ${t.formaPagamento === 'pix'
                ? `<span class="badge-pix ${t.pago ? 'pago' : 'pendente'}">
                    ${t.pago ? 'Pix Pago' : 'Pix Pendente'}
                  </span>`
                : `<span class="badge-cartao-real">
                    <span class="material-icons">credit_card</span>
                    <span class="nome-cartao">${cartaoObj ? cartaoObj.nome : 'Cartão'}</span>
                  </span>`
              }
              ${t.parcelas > 1 ? `<span class="badge-parc">${t.parcelaAtual}/${t.parcelas}x</span>` : ''}
            ` : `
              <span class="badge-receita">Depósito</span>
            `}

            <button class="btn-excluir" onclick="excluirTransacao(${t.id}, '${t.tipo}')">
              <span class="material-icons">delete_outline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}).join('');

  } catch (error) {
    console.error("Erro na listagem:", error);
  }
}

async function excluirTransacao(id, tipo) {
  const confirmou = await perguntarExcluir("Excluir Registro", "Deseja realmente apagar esta transação?");
  if (!confirmou) return;

  try {
    if (tipo === "receita") {
      await db.receitas.delete(id);
    } else {
      // 1. Buscar os dados da despesa antes de excluir
      const despesa = await db.despesas.get(id);

      if (despesa) {
        // 2. Verificar se foi no cartão e se tem um cartaoId válido
        if (despesa.formaPagamento === "cartao" && despesa.cartaoId) {
          const cartao = await db.cartoes.get(despesa.cartaoId);
          
          if (cartao) {
            // 3. Devolver o valor ao limite atual do cartão
            const novoLimite = cartao.limiteAtual + despesa.valor;
            
            await db.cartoes.update(despesa.cartaoId, { 
              limiteAtual: novoLimite 
            });
            
            console.log(`✅ R$ ${despesa.valor} estornado para o cartão ${cartao.nome}`);
          }
        }
        
        // 4. Excluir o registro da despesa
        await db.despesas.delete(id);
      }
    }

    // 5. Atualizar a interface
    await Promise.all([
      atualizarDashboard(),
      listarTransacoes()
    ]);
    
  } catch (error) {
    console.error("Erro ao excluir transação:", error);
  }
}

// DESPESA ==

document.addEventListener("DOMContentLoaded", () => {

  carregarCategorias();
  carregarPessoas();
  carregarCartoes();

  const selectCategoria = document.getElementById("categoria");

  if (selectCategoria) {
    selectCategoria.addEventListener("change", async function () {

      const categoriaId = this.value;
      const grupoSub = document.getElementById("Subcategoria");

      if (!categoriaId) {
        grupoSub.style.display = "none";
        return;
      }

      // Mostrar subcategoria
      grupoSub.style.display = "block";

      // Carregar subcategorias relacionadas
      await carregarSubcategorias(categoriaId);

    });
  }

});

window.togglePix = function() {
  const pixCheck = document.getElementById("togglePix");
  const cartaoCheck = document.getElementById("toggleCartao");
  
  const pix = pixCheck ? pixCheck.checked : false;
  
  // Mostra/Esconde área do Pix
  const pixExtra = document.getElementById("pixExtra");
  if (pixExtra) pixExtra.style.display = pix ? "block" : "none";

  // Se ligou Pix, desliga Cartão obrigatoriamente
  if (pix && cartaoCheck) {
    cartaoCheck.checked = false;
    const cartaoExtra = document.getElementById("cartaoExtra");
    if (cartaoExtra) cartaoExtra.style.display = "none";
  }
};

window.toggleCartao = function() {
  const cartaoCheck = document.getElementById("toggleCartao");
  const pixCheck = document.getElementById("togglePix");
  
  const cartao = cartaoCheck ? cartaoCheck.checked : false;

  // Mostra/Esconde área do Cartão
  const cartaoExtra = document.getElementById("cartaoExtra");
  if (cartaoExtra) cartaoExtra.style.display = cartao ? "block" : "none";

  // Se ligou Cartão, desliga Pix obrigatoriamente
  if (cartao && pixCheck) {
    pixCheck.checked = false;
    const pixExtra = document.getElementById("pixExtra");
    if (pixExtra) pixExtra.style.display = "none";
  }
};

window.toggleParcelado = function() {
  const parceladoCheck = document.getElementById("toggleParcelado");
  const parcelado = parceladoCheck ? parceladoCheck.checked : false;
  
  const parcelasExtra = document.getElementById("parcelasExtra");
  if (parcelasExtra) {
    parcelasExtra.style.display = parcelado ? "block" : "none";
  }
};

function abrirModalDespesa() {
  const hoje = new Date().toISOString().split("T")[0];

  // 1. Injeta o HTML (Estrutura limpa, sem eventos onchange no HTML)
  abrirModal("Nova Despesa", `
    <form id="formDespesa">
      <div id="formErro" class="form-erro" style="display:none;"></div>
      <div class="form-group">
        <label>Data</label>
        <input type="date" id="despesaData" value="${hoje}" required>
      </div>

      <div class="form-group">
        <label>Valor</label>
        <input type="number" id="despesaValor" step="0.01" placeholder="0,00" required>
      </div>

      <div class="form-group">
        <label>Descrição</label>
        <input type="text" id="despesaDescricao" placeholder="Ex: Mercado, Aluguel..." required>
      </div>

      <div class="form-group">
      <label>Categoria</label>
        <select id="categoria" required>
          <option value="categoria" disabled selected hidden></option>
        </select>
      </div>

      <div id="grupoSubcategoria" style="display:none;" class="form-group">
        <label>SubCategoria</label>
        <select id="subcategoria">
          <option value="" disabled selected hidden></option>
        </select>
      </div>

      <div class="form-group">
        <label>Quem Gastou?</label>
        <select id="pessoa" required>
          <option value="" disabled selected hidden></option>
        </select>
      </div>

      <div class="switch-group">
        <label>Pagar com Pix?</label>
        <input type="checkbox" id="togglePix">
      </div>
      <div id="pixExtra" style="display:none;">
        <div class="switch-group">
          <label>Já está pago?</label>
          <input type="checkbox" id="despesaPago">
        </div>
      </div>

      <div class="switch-group">
        <label>Cartão de Crédito?</label>
        <input type="checkbox" id="toggleCartao">
      </div>
      
      <div id="cartaoExtra" style="display:none;">
        <div class="form-group">
          <label>Qual Cartão?</label>
          <select id="cartao">
            <option value="" disabled selected hidden>Selecione o Cartão</option>
          </select>
        </div>
        
        <div class="switch-group">
          <label>Parcelado?</label>
          <input type="checkbox" id="toggleParcelado">
        </div>
        
        <div id="parcelasExtra" style="display:none;">
          <div class="form-group">
            <label>Quantas Parcelas?</label>
            <input type="number" id="despesaParcelas" min="1" value="1" placeholder="Ex: 12">
          </div>
        </div>
      </div>

      <button type="submit" class="save-btn">Salvar Despesa</button>
    </form>
  `);

  // 2. Carregar dados nos selects (Assíncrono)
  carregarCategorias();
  carregarPessoas();
  carregarCartoes();

  // 3. Selecionar Elementos para os Eventos
  const form = document.getElementById("formDespesa");
  const selCategoria = document.getElementById("categoria");
  const checkPix = document.getElementById("togglePix");
  const checkCartao = document.getElementById("toggleCartao");
  const checkParcelado = document.getElementById("toggleParcelado");

  // --- ATRIBUIR EVENTOS VIA JAVASCRIPT (ADEUS ERRO DE "NOT A FUNCTION") ---

  // Lógica de Categoria -> Subcategoria
  selCategoria.addEventListener("change", async function() {
    const grupoSub = document.getElementById("grupoSubcategoria");
    if (this.value) {
      grupoSub.style.display = "block";
      await carregarSubcategorias(this.value);
    }
  });

  // Lógica de Alternância Pix
  checkPix.addEventListener("change", function() {
    document.getElementById("pixExtra").style.display = this.checked ? "block" : "none";
    if (this.checked) {
      checkCartao.checked = false;
      document.getElementById("cartaoExtra").style.display = "none";
    }
  });

  // Lógica de Alternância Cartão
  checkCartao.addEventListener("change", function() {
    document.getElementById("cartaoExtra").style.display = this.checked ? "block" : "none";
    if (this.checked) {
      checkPix.checked = false;
      document.getElementById("pixExtra").style.display = "none";
    }
  });

  // Lógica de Parcelamento
  checkParcelado.addEventListener("change", function() {
    document.getElementById("parcelasExtra").style.display = this.checked ? "block" : "none";
  });

  // Lógica de Envio do Formulário
  form.addEventListener("submit", async function(e) {
    e.preventDefault(); // Impede o recarregamento da página
    
    // Desabilitar botão para evitar cliques duplos
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Salvando...";

    const sucesso = await salvarDespesa();
    
    if (!sucesso) {
        btn.disabled = false;
        btn.innerText = "Salvar Despesa";
    }
  });
}

async function salvarDespesa() {
  try {
    limparErro();
    // 1. Coleta de dados (igual antes)
    const dataStr = document.getElementById("despesaData").value;
    const valorTotal = parseFloat(document.getElementById("despesaValor").value);
    const descricao = document.getElementById("despesaDescricao").value;
    const categoriaId = parseInt(document.getElementById("categoria").value);
    const subcategoriaId = parseInt(document.getElementById("subcategoria")?.value) || null;
    const pessoaId = parseInt(document.getElementById("pessoa").value);

    const isPix = document.getElementById("togglePix").checked;
    const isCartao = document.getElementById("toggleCartao").checked;

    if (!isPix && !isCartao) {
      mostrarErro("Selecione um método de pagamento (Pix ou Cartão).");
      return false;
    }

    let formaPagamento = isPix ? "pix" : "cartao";
    let pago = isPix ? document.getElementById("despesaPago").checked : false;
    let cartaoId = isCartao ? parseInt(document.getElementById("cartao").value) : null;
    let parcelas = (isCartao && document.getElementById("toggleParcelado").checked) 
                   ? (parseInt(document.getElementById("despesaParcelas").value) || 1) 
                   : 1;

    if (!dataStr || isNaN(valorTotal)) {
      mostrarErro("Preencha data e valor corretamente.");
      return false;
    }

    const [ano, mes, dia] = dataStr.split('-').map(Number);
    let ajusteFatura = 0;
    let novoLimiteCalculado = null; // Variável temporária para o limite

    // 2. Validação do Cartão (SEM SALVAR AINDA)
    if (isCartao) {
      const cartaoObj = await db.cartoes.get(cartaoId);
      if (!cartaoObj) {
        mostrarErro("Selecione um cartão válido.");
        return false;
      }

      if (cartaoObj.limiteAtual < valorTotal) {
        mostrarErro("Limite insuficiente!");
        return false;
      }

      const diaFechamento = cartaoObj.fechamento || 1;
      if (dia >= diaFechamento) {
        ajusteFatura = 1;
      }

      // APENAS CALCULAMOS, não salvamos no banco ainda
      novoLimiteCalculado = cartaoObj.limiteAtual - valorTotal;
    }

    const valorParcela = valorTotal / parcelas;

    // 3. Loop de Salvamento das Despesas
    // Se algo der erro aqui, o código pula para o CATCH e o limite do cartão nunca é alterado
    for (let i = 0; i < parcelas; i++) {
      const dataParcela = new Date(ano, (mes - 1) + i + ajusteFatura, dia, 12, 0, 0);

      await db.despesas.add({
        data: dataParcela,
        timestamp: dataParcela.getTime(),
        valor: valorParcela,
        descricao: descricao,
        categoriaId,
        subcategoriaId,
        pessoaId,
        formaPagamento,
        pago: isCartao ? false : pago,
        cartaoId,
        parcelas,
        parcelaAtual: i + 1,
        createdAt: new Date()
      });
    }

    // 4. SÓ AGORA ATUALIZAMOS O LIMITE (Depois que as despesas foram salvas com sucesso)
    if (isCartao && novoLimiteCalculado !== null) {
      await db.cartoes.update(cartaoId, { 
        limiteAtual: novoLimiteCalculado 
      });
      console.log("💳 Limite do cartão atualizado com sucesso.");
    }

    // 5. Finalização
    fecharModal();
    await Promise.all([atualizarDashboard(), listarTransacoes()]);
    
    if (typeof listarCartoes === "function") listarCartoes();

    console.log("✅ Processo completo: Despesas salvas e limite atualizado!");

  } catch (error) {
    // Se qualquer erro acontecer acima (inclusive no loop), cai aqui
    console.error("❌ ERRO CRÍTICO: O processo foi cancelado e nada foi alterado.", error);
    mostrarErro("Erro ao salvar. Nada foi alterado.");
  }
}

async function carregarCategorias() {
  const select = document.getElementById("categoria");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';

  const categorias = await db.categorias.orderBy("nome").toArray();

  categorias.forEach(cat => {
    select.innerHTML += `
      <option value="${cat.id}">
        ${cat.nome}
      </option>
    `;
  });
}

async function carregarSubcategorias(categoriaId) {
  const select = document.getElementById("subcategoria");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';
  if (!categoriaId) return;

  const subcategorias = await db.subcategorias
    .where("categoriaId")
    .equals(Number(categoriaId)) // ⚠️ importante
    .toArray();

  subcategorias.forEach(sub => {
    select.innerHTML += `
      <option value="${sub.id}">
        ${sub.nome}
      </option>
    `;
  });
}

async function carregarPessoas(idSelect = "pessoa") {
  const select = document.getElementById(idSelect);
  if (!select) return;

  // Usar innerHTML de uma vez só é mais performático que += em loop
  const pessoas = await db.pessoas.orderBy("nome").toArray();
  
  const options = pessoas.map(p => `
    <option value="${p.id}">${p.nome}</option>
  `).join('');

  select.innerHTML = '<option value="" disabled selected>Selecione a pessoa</option>' + options;
}

async function carregarCartoes() {
  const select = document.getElementById("cartao");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione</option>';

  const cartoes = await db.cartoes.orderBy("nome").toArray();

  cartoes.forEach(cartao => {
    select.innerHTML += `
      <option value="${cartao.id}" ${cartao.limiteAtual <= 0 ? "disabled" : ""}>
        ${cartao.nome} - Limite: R$ ${cartao.limiteAtual.toFixed(2)}
      </option>
    `;
  });
}

