document.addEventListener("DOMContentLoaded", async () => {
  await configurarFiltros(); // garante que os selects existam e estejam preenchidos
});

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
      notificarSucesso("Receita salva com sucesso!"),
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
  configurarFiltros(); 

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

    const subMap = new Map(subcats.map(s => [s.id, s.nome]));
    const pessMap = new Map(pess.map(p => [p.id, p.nome]));

    const todas = [
      ...receitas.map(r => ({ ...r, tipo: "receita" })),
      ...despesas.map(d => ({ ...d, tipo: "despesa" }))
    ].filter(t => {
      const [anoD, mesD] = t.data.split("-").map(Number);
      return (mesD - 1) === mesFiltro && anoD === anoFiltro;
    }).sort((a, b) => b.data.localeCompare(a.data));

    if (todas.length === 0) {
      lista.innerHTML = `<p class="lista-vazia">Nenhum dado para ${selMes.options[selMes.selectedIndex].text}/${anoFiltro}</p>`;
      return;
    }

    function formatarDataLocal(dataInput) {
      const [ano, mes, dia] = dataInput.split("-");
      return `${dia}/${mes}/${ano}`;
    }

    lista.innerHTML = todas.map(t => {
      const isDespesa = t.tipo === "despesa";
      const isFinanciamento = t.formaPagamento === 'financiamento';
      const isDebito = t.formaPagamento === 'debito';
      const dataFormatada = formatarDataLocal(t.data);
      
      const valorFormatado = Number(t.valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });

      const categoria = cats.find(c => c.id === Number(t.categoriaId)) || 
                        { nome: 'Receita', icone: 'payments', cor: '#22c55e' };
      
      const subNome = subMap.get(Number(t.subcategoriaId));
      const pessoaNome = pessMap.get(Number(t.pessoaId)) || 'Ninguém';
      const cartaoObj = carts.find(c => c.id === Number(t.cartaoId));

      const corDestaque = isDespesa ? (categoria.cor || '#f87171') : '#22c55e';
      
      // Cor da borda lateral: Débito usa a cor do cartão também
      let corBadgeMetodo = 'transparent';
      if (isDespesa) {
          if (cartaoObj) corBadgeMetodo = cartaoObj.cor;
          else if (isFinanciamento) corBadgeMetodo = '#6366f1';
      }

      const isPago = Number(t.pago) === 1;

      return `
        <div class="card-extrato ${t.tipo}" style="--cor-cat: ${corDestaque}; --cor-card: ${corBadgeMetodo}">
          <div class="icon-box">
            <span class="material-symbols-outlined">
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

              <div class="extrato-right">
                <div class="extrato-amount ${isDespesa ? 'negativo' : 'positivo'}">
                  ${isDespesa ? '-' : '+'} ${valorFormatado.replace('R$', '').trim()}
                </div>

                ${isDespesa && cartaoObj ? `
                  <div class="extrato-cartao">
                    <span class="cartao-dot" style="background:${cartaoObj.cor}"></span>
                    ${cartaoObj.nome} ${isDebito ? '(Débito)' : ''}
                  </div>
                ` : isDespesa && isFinanciamento ? `
                  <div class="extrato-cartao">
                    <span class="cartao-dot" style="background:#6366f1"></span>
                    Financiamento
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="extrato-info-row">
              <div class="extrato-meta">
                <span class="meta-data">${dataFormatada}</span>
                <span class="meta-pessoa">${pessoaNome.split(' ')[0]}</span>
              </div>

              <div class="extrato-badges">
                ${isDespesa ? `
                  ${['pix', 'financiamento', 'debito'].includes(t.formaPagamento)
                    ? `<span class="badge-pix ${isPago ? 'pago' : 'pendente'}">
                        ${isPago ? 'Pago' : 'Pendente'}
                      </span>` : ''}
                  ${t.parcelas > 1 ? `<span class="badge-parc">${t.parcelaAtual}/${t.parcelas}x</span>` : ''}
                ` : `<span class="badge-receita">Depósito</span>`}

                <button class="btn-excluir" onclick="excluirTransacao(${t.id}, '${t.tipo}')">
                  <span class="material-symbols-outlined">delete_outline</span>
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
  const confirmou = await perguntarExcluir("Excluir Registro", "Deseja realmente apagar?");
  if (!confirmou) return;

  try {
    if (tipo === "receita") {
      await db.receitas.delete(id);
      notificarSucesso("Receita excluída!");
    } else {
      const despesa = await db.despesas.get(id);
      if (!despesa) return;

      // --- LOGICA DE EXCLUSÃO/ESTORNO ---
      
      // Se for Cartão de CRÉDITO (precisa devolver limite)
      if (despesa.formaPagamento === "cartao" && despesa.cartaoId) {
        let valorTotalEstorno = 0;

        if (despesa.grupoParcelas) {
          const idBusca = String(despesa.grupoParcelas);
          const todasDoGrupo = await db.despesas.where("grupoParcelas").equals(idBusca).toArray();
          valorTotalEstorno = todasDoGrupo.reduce((acc, d) => acc + Number(d.valor), 0);
          
          await db.despesas.bulkDelete(todasDoGrupo.map(d => d.id));
        } else {
          valorTotalEstorno = Number(despesa.valor);
          await db.despesas.delete(id);
        }

        // Devolve o limite apenas se for Crédito
        const cartao = await db.cartoes.get(despesa.cartaoId);
        if (cartao) {
          const novoLimiteEstornado = parseFloat((cartao.limiteAtual + valorTotalEstorno).toFixed(2));
          await db.cartoes.update(despesa.cartaoId, { 
            limiteAtual: novoLimiteEstornado
          });
        }
        notificarSucesso("Compra e limite estornados!");

      } else {
        // --- DÉBITO, PIX, FINANCIAMENTO OU DINHEIRO ---
        // (Não mexe no limite do cartão)
        if (despesa.grupoParcelas) {
           const idBusca = String(despesa.grupoParcelas);
           const todasDoGrupo = await db.despesas.where("grupoParcelas").equals(idBusca).toArray();
           await db.despesas.bulkDelete(todasDoGrupo.map(d => d.id));
        } else {
           await db.despesas.delete(id);
        }
        notificarSucesso("Registro removido.");
      }
    }

    // Atualização da UI
    await Promise.all([
      atualizarDashboard(),
      listarTransacoes(),
      carregarResumoCartoes(),
      carregarContasPendentes()
    ]);
    
  } catch (error) {
    console.error("❌ Erro na exclusão:", error);
    notificarSucesso("Erro ao excluir registro.", "erro");
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
          <option value="" disabled selected hidden>Selecione...</option>
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

      <hr>

      <div class="switch-group">
        <label>Pagar com Pix?</label>
        <input type="checkbox" id="togglePix">
      </div>

      <div id="pixOpcoesAdicionais" style="display:none; border-left: 3px solid #007bff; padding-left: 15px; margin: 10px 0;">
        <p>Tipo de Pix:</p>
        <div class="switch-group">
          <label>Já está pago?</label>
          <input type="checkbox" id="checkPagoPix">
        </div>
        <div class="switch-group">
          <label>É Financiamento?</label>
          <input type="checkbox" id="checkFinanciamento">
        </div>
        <div id="campoMesesFinanciamento" style="display:none;" class="form-group">
          <label>Duração (Meses)</label>
          <input type="number" id="qtdMesesFinanciamento" min="2" placeholder="Ex: 48">
        </div>
      </div>

      <div class="switch-group">
        <label>Cartão (Débito ou Crédito)?</label>
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
          <label>
            <input type="checkbox" id="checkDebito" name="tipoCartao" value="debito"> 
            Débito
          </label>
          <label>
            <input type="checkbox" id="checkCredito" name="tipoCartao" value="credito"> 
            Crédito
          </label>
        </div>

        <div id="areaCredito" style="display:none;">
          <div class="switch-group">
            <label>Parcelado?</label>
            <input type="checkbox" id="toggleParcelado">
          </div>
          <div id="parcelasExtra" style="display:none;">
            <div class="form-group">
              <label>Quantas Parcelas?</label>
              <input type="number" id="despesaParcelas" min="1" value="1">
            </div>
          </div>
        </div>
      </div>

      <button type="submit" class="save-btn">Salvar Despesa</button>
    </form>
  `);

  carregarCategorias();
  carregarPessoas();
  carregarCartoes();

  // --- ELEMENTOS PIX / FINANCIAMENTO ---
  const checkPix = document.getElementById("togglePix");
  const pixOpcoes = document.getElementById("pixOpcoesAdicionais");
  const checkPagoPix = document.getElementById("checkPagoPix");
  const checkFinan = document.getElementById("checkFinanciamento");
  const campoMesesFinan = document.getElementById("campoMesesFinanciamento");

  // --- ELEMENTOS CARTÃO ---
  const checkCartao = document.getElementById("toggleCartao");
  const cartaoExtra = document.getElementById("cartaoExtra");
  const checkDebito = document.getElementById("checkDebito");
  const checkCredito = document.getElementById("checkCredito");
  const areaCredito = document.getElementById("areaCredito");
  const toggleParcelado = document.getElementById("toggleParcelado");
  const parcelasExtra = document.getElementById("parcelasExtra");

  // LÓGICA PIX & FINANCIAMENTO (O que estava faltando!)
  checkPix.addEventListener("change", function() {
    pixOpcoes.style.display = this.checked ? "block" : "none";
    if (this.checked) {
      checkCartao.checked = false;
      cartaoExtra.style.display = "none";
    }
  });

  checkFinan.addEventListener("change", function() {
    campoMesesFinan.style.display = this.checked ? "block" : "none";
    if (this.checked) checkPagoPix.checked = false;
  });

  checkPagoPix.addEventListener("change", function() {
    if (this.checked) {
      checkFinan.checked = false;
      campoMesesFinan.style.display = "none";
    }
  });

  // LÓGICA CARTÃO (DÉBITO VS CRÉDITO)
  checkCartao.addEventListener("change", function() {
    cartaoExtra.style.display = this.checked ? "block" : "none";
    if (this.checked) {
      checkPix.checked = false;
      pixOpcoes.style.display = "none";
    }
  });

  checkDebito.addEventListener("change", function() {
    if (this.checked) {
      checkCredito.checked = false;
      areaCredito.style.display = "none";
      toggleParcelado.checked = false;
      parcelasExtra.style.display = "none";
    }
  });

  checkCredito.addEventListener("change", function() {
    if (this.checked) {
      checkDebito.checked = false;
      areaCredito.style.display = "block";
    } else {
      areaCredito.style.display = "none";
    }
  });

  toggleParcelado.addEventListener("change", function() {
    parcelasExtra.style.display = this.checked ? "block" : "none";
  });

  // CATEGORIA / SUBCATEGORIA
  document.getElementById("categoria").addEventListener("change", async function() {
    const grupoSub = document.getElementById("grupoSubcategoria");
    if (this.value) {
      grupoSub.style.display = "block";
      await carregarSubcategorias(this.value);
    }
  });

  // SALVAMENTO
  document.getElementById("formDespesa").addEventListener("submit", async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Salvando...";
    const sucesso = await salvarDespesa();
    if (!sucesso) {
      btn.disabled = false;
      btn.innerText = "Salvar Despesa";
    }
  });
}

// O coletor (pega os dados do formulario que é igual para todos).
function obterValoresCamposComuns() {
  return {
    valor: parseFloat(document.getElementById("despesaValor").value) || 0,
    data: document.getElementById("despesaData").value,
    descricao: document.getElementById("despesaDescricao").value,
    categoriaId: parseInt(document.getElementById("categoria").value),
    subcategoriaId: parseInt(document.getElementById("subcategoria").value) || null,
    pessoaId: parseInt(document.getElementById("pessoa").value),
  };
}
//A função principal (o Maestro).
async function salvarDespesa() {
  const formErro = "formErro";
  limparErro(formErro); // Limpa erros anteriores antes de validar novamente

  try {
    // 1. Validação de segurança: se algo estiver errado, o throw pula direto para o catch
    validarMetodoPagamento();

    // 2. Coleta de dados básicos do formulário
    const data = document.getElementById("despesaData").value;
    const valor = parseFloat(document.getElementById("despesaValor").value);
    const descricao = document.getElementById("despesaDescricao").value;
    const categoriaId = document.getElementById("categoria").value;
    const subcategoriaId = document.getElementById("subcategoria").value;
    const pessoaId = document.getElementById("pessoa").value;

    // Validação de campos obrigatórios
    if (!valor || !categoriaId || !pessoaId) {
      throw new Error("Preencha valor, categoria e pessoa!");
    }

    const dadosBase = {
      data,
      valor,
      descricao,
      categoriaId: parseInt(categoriaId),
      subcategoriaId: subcategoriaId ? parseInt(subcategoriaId) : null,
      pessoaId: parseInt(pessoaId),
      pago: 0 // Valor padrão inicial
    };

    const isPix = document.getElementById("togglePix").checked;
    const isCartao = document.getElementById("toggleCartao").checked;

    // 3. Execução do salvamento conforme o método escolhido
    if (isPix) {
      const isFinan = document.getElementById("checkFinanciamento").checked;
      const isPago = document.getElementById("checkPagoPix").checked;

      if (isFinan) {
        const meses = parseInt(document.getElementById("qtdMesesFinanciamento").value);
        await processarDespesaFinanciamento(dadosBase, meses); // Chama a função de parcelas de financiamento
      } else {
        await db.despesas.add({ 
          ...dadosBase, 
          formaPagamento: 'pix', 
          pago: isPago ? 1 : 0 
        });
      }
    } 
    else if (isCartao) {
      const cartaoId = document.getElementById("cartao").value;
      const tipoSelecionado = document.querySelector('input[name="tipoCartao"]:checked').value;

      if (tipoSelecionado === 'debito') {
        // Débito: Salva como pago e registra o cartão, mas sem parcelas ou alteração de limite
        await db.despesas.add({
          ...dadosBase,
          cartaoId: parseInt(cartaoId),
          formaPagamento: 'debito',
          pago: 1
        });
      } else {
        // Crédito: Processa parcelamento e atualiza o limite do cartão
        const isParcelado = document.getElementById("toggleParcelado").checked;
        const meses = isParcelado ? parseInt(document.getElementById("despesaParcelas").value) : 1;
        await processarDespesaCartaoCredito(dadosBase, meses, parseInt(cartaoId));
      }
    }

    // 4. Finalização e atualização da interface
    fecharModal();
    notificarSucesso("Despesa salva com sucesso!");
    
    await Promise.all([
      atualizarDashboard(),
      listarTransacoes(),
      carregarResumoCartoes(),
      carregarContasPendentes()
    ]);

    return true;

  } catch (error) {
    // Captura a mensagem do Error e exibe usando a sua função mostrarErro
    console.error("Erro no fluxo de salvamento:", error);
    mostrarErro(error.message, formErro); 
    return false;
  }
}

// Função auxiliar para o Crédito (para não poluir a principal)
async function processarDespesaCartaoCredito(dadosBase, qtd, cartaoId) {
  const grupoId = qtd > 1 ? `CARD-${Date.now()}` : null;
  
  // 🛠️ CORREÇÃO: Arredonda o valor da parcela para 2 casas decimais
  const valorParcela = parseFloat((dadosBase.valor / qtd).toFixed(2));
  
  // Ajuste da última parcela (para cobrir centavos perdidos no arredondamento)
  const diferencacentavos = parseFloat((dadosBase.valor - (valorParcela * qtd)).toFixed(2));

  const cartao = await db.cartoes.get(cartaoId);
  if (cartao) {
    // 🛠️ CORREÇÃO: Garante que a subtração do limite não gere dízimas
    const novoLimite = parseFloat((cartao.limiteAtual - dadosBase.valor).toFixed(2));
    await db.cartoes.update(cartaoId, { limiteAtual: novoLimite });
  }

  const promessas = [];
  for (let i = 1; i <= qtd; i++) {
    // Na última parcela, somamos a diferença dos centavos
    const valorFinalParcela = (i === qtd) ? (valorParcela + diferencacentavos) : valorParcela;

    promessas.push(db.despesas.add({
      ...dadosBase,
      valor: parseFloat(valorFinalParcela.toFixed(2)), // Força 2 casas no DB
      data: calcularProximaData(dadosBase.data, i - 1),
      cartaoId,
      parcelaAtual: i,
      parcelas: qtd,
      grupoParcelas: grupoId,
      formaPagamento: 'cartao',
      pago: 0
    }));
  }
  return await Promise.all(promessas);
}
// O segurança (impede salvar sem marcar Pix ou Cartão).
function validarMetodoPagamento() {
  const elPix = document.getElementById("togglePix");
  const elCartao = document.getElementById("toggleCartao");

  // 1. Validação Global: Garante que um dos dois métodos principais foi escolhido
  if (!elPix.checked && !elCartao.checked) {
    throw new Error("⚠️ Você precisa escolher entre PIX ou CARTÃO!");
  }

  // 2. Validação Específica do Pix
  if (elPix.checked) {
    const elFinan = document.getElementById("checkFinanciamento");
    // Se marcou financiamento, precisamos validar as parcelas
    if (elFinan && elFinan.checked) {
      const meses = document.getElementById("qtdMesesFinanciamento").value;
      if (!meses || meses < 2) {
        throw new Error("⚠️ Informe as parcelas do financiamento (mínimo 2).");
      }
    }
  }

  // 3. Validação Específica do Cartão
  if (elCartao.checked) {
    const elSeletorCartao = document.getElementById("cartao");
    const r_tipo = document.querySelector('input[name="tipoCartao"]:checked');

    // Valida se o cartão físico foi selecionado
    if (!elSeletorCartao || !elSeletorCartao.value) {
      throw new Error("⚠️ Selecione qual cartão foi utilizado.");
    }

    // Valida se o usuário marcou a bolinha de Débito ou Crédito
    if (!r_tipo) {
      throw new Error("⚠️ Informe se a operação é DÉBITO ou CRÉDITO.");
    }
    
    // Se for crédito e estiver parcelado, valida o número de parcelas
    if (r_tipo.value === 'credito') {
      const isParcelado = document.getElementById("toggleParcelado").checked;
      if (isParcelado) {
        const parcelas = document.getElementById("despesaParcelas").value;
        if (!parcelas || parcelas < 1) {
          throw new Error("⚠️ Informe um número válido de parcelas.");
        }
      }
    }
  }
}
// O distribuidor (decide se vai para comum ou financiamento).
async function processarSalvamentoPix(dadosBase) {
  const subtipo = identificarSubtipoPix();

  if (subtipo === 'financiamento') {
    return await processarDespesaFinanciamento(dadosBase);
  }

  // Se cair aqui, é o Pix Comum
  return await processarDespesaPixComum(dadosBase);
}

function identificarSubtipoPix() {
  const elFinan = document.getElementById("checkFinanciamento");
  
  // Segurança: Se o elemento não for achado, ele não tenta ler o .checked
  if (!elFinan) return 'comum'; 
  
  return elFinan.checked ? 'financiamento' : 'comum';
}
// O executor do Pix simples.
async function processarDespesaPixComum(dadosBase) {
  // Agora olha para o ID checkPagoPix que você definiu acima
  const isPago = document.getElementById("checkPagoPix").checked;
  return await db.despesas.add({
    ...dadosBase,
    formaPagamento: 'pix',
    pago: isPago ? 1 : 0
  });
}
// O executor do loop de parcelas (usa a calcularProximaData).
async function processarDespesaFinanciamento(dadosBase) {
  const qtdInput = document.getElementById("qtdMesesFinanciamento");
  const qtd = parseInt(qtdInput.value) || 2;
  
  // 1. Geramos o carimbo de tempo e CONVERTEMOS PARA STRING na hora
  // Isso garante que o valor seja tratado como um texto fixo
  const grupoIdFixo = "FIN-" + Date.now().toString(); 

  console.log("🚀 GRUPO GERADO (Deve ser igual para todas):", grupoIdFixo);

  const objetosParaSalvar = [];

  for (let i = 1; i <= qtd; i++) {
    // 2. Criamos a data da parcela
    const dataParcela = calcularProximaData(dadosBase.data, i - 1);
    
    // 3. Montamos o objeto (sem chamar funções no meio)
    const parcela = {
      ...dadosBase,
      data: dataParcela,
      parcelaAtual: i,
      parcelas: qtd,
      grupoParcelas: grupoIdFixo, // <--- Aqui usamos a String fixa
      formaPagamento: 'financiamento',
      pago: 0 
    };
    
    objetosParaSalvar.push(parcela);
  }

  // 4. Usamos bulkAdd para salvar tudo de uma vez. 
  // É mais rápido e garante a atomicidade do grupo.
  return await db.despesas.bulkAdd(objetosParaSalvar);
}
// O executor do cartão.
async function processarDespesaCartao(dadosBase) {
  const cartaoId = parseInt(document.getElementById("cartao").value);
  const tipoCartao = document.querySelector('input[name="tipoCartao"]:checked').value; // 'credito' ou 'debito'

  if (tipoCartao === 'debito') {
    // LÓGICA PARA DÉBITO
    return await db.despesas.add({
      ...dadosBase,
      cartaoId: cartaoId,
      formaPagamento: 'debito',
      pago: 1 // No débito, já está pago
    });
  } else {
    // LÓGICA PARA CRÉDITO (A que você já tinha)
    const isParcelado = document.getElementById("toggleParcelado").checked;
    const qtd = isParcelado ? parseInt(document.getElementById("despesaParcelas").value) : 1;
    const grupoId = qtd > 1 ? `CARD-${Date.now()}` : null;
    const valorTotalCompra = dadosBase.valor;
    const valorPorParcela = valorTotalCompra / qtd;

    const cartao = await db.cartoes.get(cartaoId);
    if (cartao) {
      const novoLimite = cartao.limiteAtual - valorTotalCompra;
      await db.cartoes.update(cartaoId, { limiteAtual: novoLimite });
    }

    const promessas = [];
    for (let i = 1; i <= qtd; i++) {
      promessas.push(db.despesas.add({
        ...dadosBase,
        valor: valorPorParcela,
        data: calcularProximaData(dadosBase.data, i - 1),
        cartaoId: cartaoId,
        parcelaAtual: i,
        parcelas: qtd,
        grupoParcelas: grupoId,
        formaPagamento: 'cartao', // Aqui você pode manter 'cartao' ou mudar para 'credito'
        pago: 0 
      }));
    }
    return await Promise.all(promessas);
  }
}
//Faz as datas pularem de mês em mês.
function calcularProximaData(dataString, mesesAdicionais) {
    // dataString: "2026-03-31"
    const partes = dataString.split("-").map(Number);
    const anoOriginal = partes[0];
    const mesOriginal = partes[1]; // 1-12
    const diaOriginal = partes[2];

    // Cria a data no mês alvo
    let dataAlvo = new Date(anoOriginal, (mesOriginal - 1) + mesesAdicionais, diaOriginal);

    // Se o dia da data gerada não for igual ao dia original, 
    // significa que o mês é mais curto (ex: 31 de Março virou 1 de Maio)
    if (dataAlvo.getDate() !== diaOriginal) {
        // Ajustamos para o último dia do mês anterior (que é o mês correto da parcela)
        dataAlvo.setDate(0); 
    }

    // Retorna no formato YYYY-MM-DD blindado
    const y = dataAlvo.getFullYear();
    const m = String(dataAlvo.getMonth() + 1).padStart(2, '0');
    const d = String(dataAlvo.getDate()).padStart(2, '0');
    
    return `${y}-${m}-${d}`;
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
