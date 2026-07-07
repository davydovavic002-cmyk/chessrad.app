export function normalizeStudyFen(fen) {
  if (!fen || fen === 'start') {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  return fen;
}

/** Fit board into the study board slot between status and controls. */
export function measureStudyBoardSize(containerWidth, containerHeight) {
  const w = Math.max(0, containerWidth - 16);
  const h = Math.max(0, containerHeight - 16);
  const size = Math.floor(Math.min(w, h, 560));
  return Math.max(220, size);
}
