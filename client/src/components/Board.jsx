import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const alphaNotationStyle = {
  fontSize: '13px',
  fontWeight: 700,
  position: 'absolute',
  bottom: 2,
  right: 4,
  userSelect: 'none',
  zIndex: 5,
  pointerEvents: 'none',
  lineHeight: 1,
};

const numericNotationStyle = {
  fontSize: '13px',
  fontWeight: 700,
  position: 'absolute',
  top: 2,
  left: 3,
  userSelect: 'none',
  zIndex: 5,
  pointerEvents: 'none',
  lineHeight: 1,
};

const lightSquareNotationStyle = {
  color: '#6d4c35',
};

const darkSquareNotationStyle = {
  color: '#f2e3c6',
};

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
      alphaNotationStyle,
      numericNotationStyle,
      lightSquareNotationStyle,
      darkSquareNotationStyle,
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
      alphaNotationStyle,
      numericNotationStyle,
      lightSquareNotationStyle,
      darkSquareNotationStyle,
    ]
  );

  return <Chessboard options={options} />;
}
