export function normalizeStudyFen(fen) {
  if (!fen || fen === 'start') {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  return fen;
}

export function calcStudyBoardSize() {
  return Math.floor(
    Math.min(560, Math.max(280, window.innerWidth - 500), Math.max(280, window.innerHeight - 280))
  );
}
