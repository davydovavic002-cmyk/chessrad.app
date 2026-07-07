import { useLayoutEffect, useRef, useState } from 'react';
import StudyBoardFrame from './StudyBoardFrame';
import { measureStudyBoardSize } from '../utils/chessPosition';

/**
 * Study-style board slot: Lichess coords + responsive sizing.
 * variant "mini" uses a fixed square size for mosaic thumbnails.
 */
export default function GroupBoardArena({
  children,
  orientation = 'white',
  variant = 'main',
  miniSize = 132,
  toolbar = null,
  className = '',
}) {
  const slotRef = useRef(null);
  const [boardSize, setBoardSize] = useState(variant === 'mini' ? miniSize : 320);

  useLayoutEffect(() => {
    if (variant === 'mini') {
      setBoardSize(miniSize);
      return undefined;
    }
    const el = slotRef.current;
    if (!el) return undefined;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = measureStudyBoardSize(el.clientWidth, el.clientHeight);
        setBoardSize((prev) => (prev === next ? prev : next));
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [variant, miniSize]);

  const board = (
    <StudyBoardFrame boardSize={boardSize} orientation={orientation}>
      {children(boardSize)}
    </StudyBoardFrame>
  );

  if (variant === 'mini') {
    return <div className={`group-board-arena group-board-arena--mini ${className}`.trim()}>{board}</div>;
  }

  return (
    <div className={`group-board-arena ${className}`.trim()}>
      <div ref={slotRef} className="group-board-arena__slot">
        {board}
      </div>
      {toolbar ? <div className="group-board-toolbar">{toolbar}</div> : null}
    </div>
  );
}
