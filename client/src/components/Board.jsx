import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';

/**
 * Thin wrapper around react-chessboard (v5 options API).
 * onDrop(source, target) => true | false | 'snapback'
 */
export default function Board({
  id = 'board',
  fen = 'start',
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
}) {
  const options = useMemo(
    () => ({
      id,
      position:
        fen === 'start'
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : fen,
      boardOrientation: orientation,
      allowDragging,
      allowDragOffBoard,
      showAnimations,
      squareStyles,
      arrows,
      canDragPiece,
      onPieceDrop: ({ sourceSquare, targetSquare }) => {
        if (!onDrop) return false;
        // drop off board
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
      draggingPieceStyle: { transform: 'scale(1.05)' },
    }),
    [
      id,
      fen,
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
    ]
  );

  return <Chessboard options={options} />;
}
