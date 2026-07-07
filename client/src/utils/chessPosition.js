export function normalizeStudyFen(fen) {
  if (!fen || fen === 'start') {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  return fen;
}

/** Fit the 8×8 board into the study board slot (a–h / 1–8 labels render on corner squares). */
export function measureStudyBoardSize(containerWidth, containerHeight) {
  const w = Math.max(0, containerWidth - 16);
  const h = Math.max(0, containerHeight - 16);
  return Math.max(200, Math.floor(Math.min(w, h, 600)));
}
