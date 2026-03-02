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

function mostrarErro(mensagem) {
  const erroDiv = document.getElementById("formErro");
  erroDiv.innerText = mensagem;
  erroDiv.style.display = "block";
}

function limparErro() {
  const erroDiv = document.getElementById("formErro");
  erroDiv.innerText = "";
  erroDiv.style.display = "none";
}

