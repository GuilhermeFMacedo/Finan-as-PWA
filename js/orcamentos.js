async function listarOrcamentos() {
  const container = document.getElementById("container-orcamentos");
  const mesFiltro = document.getElementById("mesOrcamento").value;
  const pessoaFiltro = document.getElementById("filtroPessoaOrcamento").value;

  try {
    const [todasCategorias, todosOrcamentos, todasDespesas] = await Promise.all([
      db.categorias.toArray(),
      db.orcamentos.toArray(),
      db.despesas.where("data").startsWith(mesFiltro).toArray()
    ]);

    container.innerHTML = "";

    todasCategorias.forEach(cat => {
      // 1. Lógica de Herança de Meta
      let orc = todosOrcamentos.find(o => Number(o.categoriaId) === cat.id && o.mesAno === mesFiltro);
      if (!orc) {
        orc = todosOrcamentos
          .filter(o => Number(o.categoriaId) === cat.id && o.mesAno < mesFiltro)
          .sort((a, b) => b.mesAno.localeCompare(a.mesAno))[0];
      }

      const limite = orc ? Number(orc.valorLimite) : 0;
      const ehHerdada = orc && orc.mesAno !== mesFiltro;

      // 2. Cálculos de Gasto (Casa vs Pessoa)
      const despesasDaCategoria = todasDespesas.filter(d => Number(d.categoriaId) === cat.id);
      const gastoTotalCasa = despesasDaCategoria.reduce((sum, d) => sum + Number(d.valor), 0);
      
      let gastoParaExibir = gastoTotalCasa;
      if (pessoaFiltro !== "todas") {
        gastoParaExibir = despesasDaCategoria
          .filter(d => String(d.pessoaId) === pessoaFiltro)
          .reduce((sum, d) => sum + Number(d.valor), 0);
      }

      const restante = limite - gastoTotalCasa;
      const percentTotal = limite > 0 ? (gastoTotalCasa / limite) * 100 : 0;
      const larguraBarraVisual = Math.min(percentTotal, 100);

      // 3. Definição de Cores e Status
      let corBarra = cat.cor; 

      if (percentTotal >= 90) {
        corBarra = "var(--danger)";
      } else if (percentTotal >= 75) {
        corBarra = "#f1c40f";
      } else if (percentTotal >= 50) {
        corBarra = "#f1c40f";
      }

      const labelAviso = percentTotal >= 100 ? `<span class="badge-erro">⚠️ Estourou</span>` : "";

      // 4. Lógica do Texto de Saldo
      let htmlSaldo = "";
      if (limite > 0) {
        if (restante > 0) {
          htmlSaldo = `<span style="color: var(--success)">● Disponível: ${formatarMoeda(restante)}</span>`;
        } else if (restante < 0) {
          htmlSaldo = `<span style="color: var(--danger)">● Excedido: ${formatarMoeda(Math.abs(restante))}</span>`;
        } else {
          htmlSaldo = `<span style="color: var(--text-secondary)">● No limite</span>`;
        }
      }

      // 5. Criação do Elemento (Apenas uma declaração aqui)
      const card = document.createElement("div");
      card.className = `card-orcamento-l`;
      card.setAttribute("data-estouro-real", percentTotal >= 100);

      card.onclick = () => abrirDetalhesCategoria(cat.id, cat.nome);
      
      card.innerHTML = `
        <div class="orc-info">
          <div class="orc-detalhe">
            <span class="material-symbols-outlined" style="background:${cat.cor}22; color:${cat.cor}; padding:8px; border-radius:50%">${cat.icone}</span>
            <div>
              <div style="display:flex; align-items:center; gap:5px;">
                <strong>${cat.nome}</strong>
                ${labelAviso}
              </div>
              <p>
                ${formatarMoeda(gastoParaExibir)} de ${formatarMoeda(limite)}
                ${pessoaFiltro !== "todas" ? '<small style="opacity:0.6"> (sua parte)</small>' : ''}
              </p>
            </div>
          </div>
          <button class="btn-edit-orc" onclick="event.stopPropagation(); abrirModalMetaUnica(${cat.id}, ${limite}, '${cat.nome}')">
            <span class="material-symbols-outlined">${limite > 0 ? 'edit' : 'add_circle'}</span>
          </button>
        </div>

        ${limite > 0 ? `
          <div class="progress-container">
            <div class="progress-bar" style="width: ${larguraBarraVisual}%; background: ${corBarra};"></div>
          </div>
          <div class="orc-footer-info">
            <span style="color: ${percentTotal >= 100 ? 'var(--danger)' : 'inherit'}; font-weight: 600;">
                ${percentTotal.toFixed(0)}% consumido
            </span>
            <div class="saldo-info">
               ${htmlSaldo}
            </div>
          </div>
          ${ehHerdada ? `<div class="meta-herdada-aviso">* Meta repetida de ${orc.mesAno}</div>` : ''}
        ` : '<p class="msg-sem-meta">Toque no + para definir uma meta</p>'}
      `;
      
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao listar orçamentos:", error);
  }
}

function abrirModalMetaUnica(catId, valorAtual, nomeCat) {
  const html = `
    <div class="form-group" style="margin-bottom: 20px;">
      <label style="display:block; margin-bottom: 10px;">Definir meta mensal para <strong>${nomeCat}</strong></label>
      <input type="number" id="novoValorMeta" step="0.01" value="${valorAtual || ''}" 
             placeholder="R$ 0,00" style="width:100%; padding:12px; border: 1px solid #ddd; border-radius: 8px;">
    </div>
    <div style="display:flex; gap: 10px; flex-direction: column;">
      <button onclick="salvarMetaIndividual(${catId})" class="save-btn" style="padding: 12px; background: #27ae60; color: white; border: none; border-radius: 8px; cursor: pointer;">
        Confirmar Meta
      </button>
      ${valorAtual > 0 ? `
        <button onclick="removerMeta(${catId})" class="btn-delete-link" style="background: transparent; color: #e74c3c; border: none; padding: 8px; cursor: pointer; font-size: 13px;">
          Remover meta desta categoria
        </button>
      ` : ''}
    </div>
  `;
  
  abrirModal(`Ajustar Meta`, html);
  setTimeout(() => {
    const input = document.getElementById("novoValorMeta");
    if (input) { input.focus(); input.select(); }
  }, 200);
}

async function salvarMetaIndividual(categoriaId) {
  const input = document.getElementById("novoValorMeta");
  const valor = Number(input.value);
  const mesAtivo = document.getElementById("mesOrcamento").value;
  const idCat = Number(categoriaId);

  if (isNaN(valor) || valor < 0) {
    return notificarErro("Insira um valor válido.");
  }

  try {
    // Busca registro existente para o par Categoria + Mês
    const existente = await db.orcamentos
      .where({ categoriaId: idCat, mesAno: mesAtivo })
      .first();

    if (existente) {
      await db.orcamentos.update(existente.id, { valorLimite: valor });
    } else {
      await db.orcamentos.add({ 
        categoriaId: idCat, 
        mesAno: mesAtivo, 
        valorLimite: valor 
      });
    }

    fecharModal();
    notificarSucesso(`Meta de ${mesAtivo} salva!`);
    listarOrcamentos();
  } catch (err) {
    console.error("Erro ao salvar:", err);
    notificarErro("Erro ao guardar no banco.");
  }
}

async function removerMeta(categoriaId) {
  const mesAtivo = document.getElementById("mesOrcamento").value;
  const idCat = Number(categoriaId);
  
  const confirmado = await perguntarExcluir(
    "Remover Meta", 
    `Pretende apagar a meta de ${mesAtivo}?`
  );

  if (!confirmado) return;

  try {
    // Deleta especificamente a meta deste mês
    const deletados = await db.orcamentos
      .where({ categoriaId: idCat, mesAno: mesAtivo })
      .delete();

    if (deletados > 0) {
      fecharModal();
      notificarSucesso("Meta removida.");
      listarOrcamentos();
    } else {
      notificarErro("Nenhuma meta encontrada para este mês.");
    }
  } catch (err) {
    console.error("Erro ao remover:", err);
    notificarErro("Erro ao excluir registro.");
  }
}

let chartSub = null;

async function abrirDetalhesCategoria(catId, nomeCat) {
    // 1. Navegação
    trocarPagina('detalhe-categoria');
    
    const tituloEl = document.getElementById("titulo-detalhe-cat");
    if (tituloEl) tituloEl.textContent = nomeCat;

    // 2. Captura filtros da tela de origem
    const mes = document.getElementById("mesOrcamento").value;
    const pessoaId = document.getElementById("filtroPessoaOrcamento").value;

    await renderizarGraficoSubcategorias(catId, mes, pessoaId);
}

async function renderizarGraficoSubcategorias(catId, mes, pessoaId) {
    const canvas = document.getElementById('graficoSubcategorias');
    if (!canvas) return;

    try {
        const categoriaPai = await db.categorias.get(Number(catId));
        const corBase = categoriaPai ? categoriaPai.cor : '#3498db';

        const subcats = await db.subcategorias.where("categoriaId").equals(Number(catId)).toArray();
        let despesas = await db.despesas
            .where("data").startsWith(mes)
            .filter(d => Number(d.categoriaId) === Number(catId))
            .toArray();

        if (pessoaId !== "todas") {
            despesas = despesas.filter(d => String(d.pessoaId) === String(pessoaId));
        }

        const dadosGrafico = subcats.map(s => {
            const total = despesas
                .filter(d => Number(d.subcategoriaId) === s.id)
                .reduce((sum, d) => sum + Number(d.valor), 0);
            return { nome: s.nome, total };
        }).filter(item => item.total > 0).sort((a, b) => b.total - a.total);

        const ctx = canvas.getContext('2d');
        if (chartSub) chartSub.destroy();

        chartSub = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dadosGrafico.map(d => d.nome),
                datasets: [{
                    data: dadosGrafico.map(d => d.total),
                    backgroundColor: corBase + 'cc', // Cor da categoria com transparência
                    borderRadius: 6,
                    barThickness: 24 // Barras um pouco mais grossas para facilitar a leitura
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { right: 65, left: 5 } // Espaço extra na direita para o valor R$
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false } // Desnecessário clicar/passar o mouse
                },
                scales: {
                    x: { display: false }, // Remove o eixo de baixo para limpar
                    y: {
                        grid: { display: false, drawBorder: false },
                        ticks: { 
                            color: '#fff', 
                            font: { size: 11, weight: '500' },
                            padding: 5
                        }
                    }
                },
                animation: {
                    onComplete: function() {
                        const chartCtx = this.ctx;
                        chartCtx.font = "bold 13px sans-serif";
                        chartCtx.fillStyle = "#fff";
                        chartCtx.textAlign = "left";
                        chartCtx.textBaseline = "middle";

                        this.data.datasets.forEach((dataset, i) => {
                            const meta = this.getDatasetMeta(i);
                            meta.data.forEach((bar, index) => {
                                const val = dataset.data[index];
                                const texto = formatarMoeda(val); // Usa sua função global de formatar
                                chartCtx.fillText(texto, bar.x + 8, bar.y);
                              });
                        });
                    }
                }
            }
        });

    } catch (error) {
        console.error("Erro no gráfico:", error);
    }
}