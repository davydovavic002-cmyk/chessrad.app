export function normalizeStudyFen(fen) {
  if (!fen || fen === 'start') {
    return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }
  return fen;
}

/** Lichess-style coord strip width/height (px). */
export const STUDY_COORD_GUTTER = 17;

/** Maximize the 8×8 board inside the study slot (coords sit outside the grid). */
export function measureStudyBoardSize(containerWidth, containerHeight) {
  const w = Math.max(0, containerWidth - STUDY_COORD_GUTTER);
  const h = Math.max(0, containerHeight - STUDY_COORD_GUTTER);
  return Math.max(200, Math.floor(Math.min(w, h)));
}
