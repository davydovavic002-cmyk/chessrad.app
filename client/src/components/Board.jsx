import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Thin wrapper around react-chessboard (v5 options API).
 * onDrop(source, target) => true | false | 'snapback'
 */
export default function Board({
  id = 'board',
  fen = 'start',
  position,
  orientation = 'white',
  onDrop,
  onSquareClick,
  canDragPiece,
  squareStyles,
  arrows,
  allowDragging = true,
  allowDragOffBoard = false,
  boardWidth,
  showAnimations = true,
  allowDrawingArrows = true,
  showNotation = true,
}) {
  const resolvedPosition = useMemo(() => {
    if (position) return position;
    return fen === 'start' ? START_FEN : fen;
  }, [position, fen]);

  const options = useMemo(
    () => ({
      id,
      position: resolvedPosition,
      boardOrientation: orientation,
      allowDragging,
      allowDragOffBoard,
      showAnimations,
      animationDurationInMs: showAnimations ? 300 : 0,
      allowDrawingArrows,
      showNotation,
      squareStyles,
      arrows,
      canDragPiece,
      draggingPieceGhostStyle: { opacity: 0 },
      onPieceDrop: ({ sourceSquare, targetSquare }) => {
        if (!onDrop) return false;
        if (!targetSquare && allowDragOffBoard) {
          const result = onDrop(sourceSquare, null);
          return result === true || result === undefined;
        }
        if (!targetSquare) return false;
        const result = onDrop(sourceSquare, targetSquare);
        return result === true || result === undefined;
      },
      onSquareClick: onSquareClick
        ? ({ square, piece }) => onSquareClick(square, piece)
        : undefined,
      boardStyle: boardWidth
        ? { width: boardWidth, height: boardWidth }
        : { width: '100%', aspectRatio: '1 / 1', height: 'auto' },
    }),
    [
      id,
      resolvedPosition,
      orientation,
      onDrop,
      onSquareClick,
      canDragPiece,
      squareStyles,
      arrows,
      allowDragging,
      allowDragOffBoard,
      boardWidth,
      showAnimations,
      allowDrawingArrows,
      showNotation,
    ]
  );

  return <Chessboard options={options} />;
}
