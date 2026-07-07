export function normalizeStudyFen(fen) {
  if (!fen || fen === 'start') {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  return fen;
}

/** Space for rank/file labels rendered outside the 8×8 grid. */
export const STUDY_BOARD_NOTATION_PAD = 22;

/** Fit board squares into the study board slot (notation sits outside boardWidth). */
export function measureStudyBoardSize(containerWidth, containerHeight) {
  const w = Math.max(0, containerWidth - 16);
  const h = Math.max(0, containerHeight - 16);
  const footprint = Math.floor(Math.min(w, h, 600));
  const size = footprint - STUDY_BOARD_NOTATION_PAD * 2;
  return Math.max(200, size);
}
