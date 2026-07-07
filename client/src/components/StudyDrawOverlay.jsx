import { useCallback, useEffect, useRef } from 'react';

const GREEN = 'rgba(46, 204, 113, 0.95)';
const RED = 'rgba(231, 76, 60, 0.95)';

function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = Math.max(14, Math.min(22, ctx.lineWidth * 3));
  const lineEndX = toX - headLen * 0.55 * Math.cos(angle);
  const lineEndY = toY - headLen * 0.55 * Math.sin(angle);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 7),
    toY - headLen * Math.sin(angle - Math.PI / 7)
  );
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 7),
    toY - headLen * Math.sin(angle + Math.PI / 7)
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws study arrows/circles over the chessboard.
 */
export default function StudyDrawOverlay({
  boardId = 'study-board',
  shapes = [],
  orientation = 'white',
  drawEnabled = false,
  onShapesChange,
}) {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const drawingRef = useRef({ active: false, start: null });
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;

  const getBoardEl = useCallback(() => {
    return document.getElementById(`${boardId}-board`);
  }, [boardId]);

  const getCellCenter = useCallback(
    (pixelX, pixelY, size) => {
      const col = Math.min(7, Math.max(0, Math.floor(pixelX / size)));
      const row = Math.min(7, Math.max(0, Math.floor(pixelY / size)));
      const isBlack = orientation === 'black';
      return {
        col: isBlack ? 7 - col : col,
        row: isBlack ? 7 - row : row,
      };
    },
    [orientation]
  );

  const getCanvasCoords = useCallback(
    (col, row, size) => {
      let finalCol = col;
      let finalRow = row;
      if (orientation === 'black') {
        finalCol = 7 - col;
        finalRow = 7 - row;
      }
      return { x: finalCol * size + size / 2, y: finalRow * size + size / 2 };
    },
    [orientation]
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    const boardEl = getBoardEl();
    if (!canvas || !shell || !boardEl) return;

    const shellRect = shell.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const w = Math.round(boardRect.width);
    const h = Math.round(boardRect.height);
    if (!w || !h) return;

    canvas.style.left = `${boardRect.left - shellRect.left}px`;
    canvas.style.top = `${boardRect.top - shellRect.top}px`;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const size = w / 8;

    shapesRef.current.forEach((s) => {
      const start = getCanvasCoords(s.startCol, s.startRow, size);
      if (s.type === 'circle') {
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(start.x, start.y, size * 0.38, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const end = getCanvasCoords(s.endCol, s.endRow, size);
        drawArrow(ctx, start.x, start.y, end.x, end.y, RED);
      }
    });
  }, [getBoardEl, getCanvasCoords]);

  useEffect(() => {
    redraw();
  }, [shapes, orientation, redraw]);

  useEffect(() => {
    const boardEl = getBoardEl();
    const shell = shellRef.current;
    if (!shell) return;
    const ro = new ResizeObserver(() => redraw());
    if (boardEl) ro.observe(boardEl);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [getBoardEl, redraw]);

  useEffect(() => {
    const boardEl = getBoardEl();
    if (!boardEl || !drawEnabled) return;

    const onContextMenu = (e) => e.preventDefault();

    const onMouseDown = (e) => {
      const boardRect = boardEl.getBoundingClientRect();
      const size = boardRect.width / 8;
      if (!size) return;
      const gridPos = getCellCenter(
        e.clientX - boardRect.left,
        e.clientY - boardRect.top,
        size
      );

      if (e.button === 0) {
        if (shapesRef.current.length) onShapesChange?.([]);
      } else if (e.button === 2) {
        drawingRef.current = { active: true, start: gridPos };
      }
    };

    const onMouseUp = (e) => {
      if (!drawingRef.current.active || e.button !== 2) return;
      const boardRect = boardEl.getBoundingClientRect();
      const size = boardRect.width / 8;
      const gridPos = getCellCenter(
        e.clientX - boardRect.left,
        e.clientY - boardRect.top,
        size
      );
      const start = drawingRef.current.start;
      drawingRef.current = { active: false, start: null };
      if (!start) return;

      const nextShape =
        start.col === gridPos.col && start.row === gridPos.row
          ? { type: 'circle', startCol: start.col, startRow: start.row }
          : {
              type: 'arrow',
              startCol: start.col,
              startRow: start.row,
              endCol: gridPos.col,
              endRow: gridPos.row,
            };

      onShapesChange?.([...shapesRef.current, nextShape]);
    };

    boardEl.addEventListener('contextmenu', onContextMenu);
    boardEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      boardEl.removeEventListener('contextmenu', onContextMenu);
      boardEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [drawEnabled, getBoardEl, getCellCenter, onShapesChange]);

  return (
    <canvas
      id="drawing-canvas"
      ref={(node) => {
        canvasRef.current = node;
        shellRef.current = node?.parentElement ?? null;
      }}
      className="study-draw-canvas"
      aria-hidden
    />
  );
}
