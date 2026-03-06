document.addEventListener("DOMContentLoaded", () => {

  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach(item => {
    item.addEventListener("click", () => {

      navItems.forEach(i => i.classList.remove("active"));

      if (!item.classList.contains("plus-button")) {
        item.classList.add("active");
      }

      const page = item.dataset.page;

      if (page) {
        trocarPagina(page);
      }
    });
  });

  const inputBackup = document.getElementById("inputImportarBackup");

  if (inputBackup) {
    inputBackup.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importarDados(file);
    });
  }

});

document.addEventListener("DOMContentLoaded", () => {

  const inputMes = document.getElementById("mesSelecionado");

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");

  inputMes.value = `${ano}-${mes}`;

  atualizarDashboard();

  inputMes.addEventListener("change", atualizarDashboard);
});

function trocarPagina(page) {

  document.querySelectorAll(".page")
    .forEach(p => p.classList.remove("active"));

  document.getElementById("page-" + page)
    .classList.add("active");

  if (page === "cartoes") listarCartoes();
  if (page === "categorias") listarCategorias();
  if (page === "transacoes") listarTransacoes(), configurarFiltros();
  if (page === "pessoas") listarPessoas();
  if (page === "historico") abrirHistorico();
}

function abrirModal(titulo, conteudoHTML) {
  limparErro();
  document.getElementById("modalTitle").textContent = titulo;
  document.getElementById("modalBody").innerHTML = conteudoHTML;

  document.getElementById("modalOverlay").classList.remove("hidden");

  // 🔥 trava scroll do fundo
  document.body.classList.add("modal-open");
}

function fecharModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
  limparErro();
}

function perguntarExcluir(titulo, mensagem) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-confirmacao");
    const btnConfirmar = document.getElementById("btn-confirmar");
    const btnCancelar = document.getElementById("btn-cancelar");
    document.getElementById("confirm-msg").innerText = mensagem;

    modal.style.display = "flex";

    const fechar = (resultado) => {
      modal.style.display = "none";
      resolve(resultado);
    };

    btnConfirmar.onclick = () => fechar(true);
    btnCancelar.onclick = () => fechar(false);
  });
}

function mostrarErro(mensagem, id = "formErro", autoHide = true, tipo = "erro") {
  const erroDiv = document.getElementById(id);
  if (!erroDiv) return;

  erroDiv.className = `form-erro ${tipo}`;
  erroDiv.innerText = mensagem;
  erroDiv.style.display = "block";

  if (autoHide) {
    setTimeout(() => limparErro(id), 3000);
  }
}

function limparErro(id = "formErro") {
  const erroDiv = document.getElementById(id);
  if (!erroDiv) return;

  erroDiv.innerText = "";
  erroDiv.style.display = "none";
}

let confirmCallback = null;

function confirmarAcao(mensagem, callback) {
  const overlay = document.getElementById("confirmOverlay");
  const msg = document.getElementById("confirmMensagem");
  const btn = document.getElementById("confirmBtn");

  msg.innerText = mensagem;
  overlay.style.display = "flex";

  confirmCallback = callback;

  btn.onclick = () => {
    if (confirmCallback) confirmCallback();
    fecharConfirm();
  };
}

function fecharConfirm() {
  document.getElementById("confirmOverlay").style.display = "none";
  confirmCallback = null;
}
