import { useMemo } from 'react';
import { STUDY_COORD_GUTTER } from '../utils/chessPosition';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

/**
 * Lichess-style coordinate gutter: ranks left, files under the board.
 */
export default function StudyBoardFrame({ boardSize, orientation = 'white', children }) {
  const files = useMemo(
    () => (orientation === 'white' ? FILES : [...FILES].reverse()),
    [orientation]
  );
  const ranks = useMemo(
    () => (orientation === 'white' ? RANKS : [...RANKS].reverse()),
    [orientation]
  );

  return (
    <div
      className="study-board-frame"
      style={{
        '--study-board-size': `${boardSize}px`,
        '--study-coord-size': `${STUDY_COORD_GUTTER}px`,
      }}
    >
      <div className="study-board-coords-ranks" aria-hidden>
        {ranks.map((rank) => (
          <span key={rank} className="study-board-coord study-board-coord--rank">
            {rank}
          </span>
        ))}
      </div>
      <div className="study-board-cell">{children}</div>
      <div className="study-board-coords-corner" aria-hidden />
      <div className="study-board-coords-files" aria-hidden>
        {files.map((file) => (
          <span key={file} className="study-board-coord study-board-coord--file">
            {file}
          </span>
        ))}
      </div>
    </div>
  );
}
