document.getElementById('btn-restart').onclick = () => {
  location.reload();
};

document.getElementById('btn-menu').onclick = () => {
  // Exemplo: voltar para menu inicial
  location.reload();
};

function showWinScreen() {
  document.getElementById('win-overlay').classList.remove('hidden');

  // Pausar jogo
  gamePaused = true;

  // Soltar mouse (PointerLock)
  document.exitPointerLock();
}
