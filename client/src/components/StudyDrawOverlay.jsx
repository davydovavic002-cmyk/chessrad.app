import { useCallback, useEffect, useRef } from 'react';

const GREEN = 'rgba(46, 204, 113, 0.95)';
const RED = 'rgba(231, 76, 60, 0.95)';

function drawArrow(ctx, fromX, fromY, toX, toY, color, lineWidth) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 6) return;

  const angle = Math.atan2(dy, dx);
  const headLen = Math.min(Math.max(12, lineWidth * 2.4), len * 0.45);
  const shaftEndX = toX - headLen * Math.cos(angle);
  const shaftEndY = toY - headLen * Math.sin(angle);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6.5),
    toY - headLen * Math.sin(angle - Math.PI / 6.5)
  );
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6.5),
    toY - headLen * Math.sin(angle + Math.PI / 6.5)
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws study arrows/circles over the chessboard.
 * Drawing input is enabled only when drawTool !== 'off' (teacher-only in StudyPage).
 */
export default function StudyDrawOverlay({
  boardId = 'study-board',
  shapes = [],
  orientation = 'white',
  drawTool = 'off',
  onShapesChange,
}) {
  const canvasRef = useRef(null);
  const shellRef = useRef(null);
  const drawingRef = useRef({ active: false, start: null });
  const shapesRef = useRef(shapes);
  const drawToolRef = useRef(drawTool);
  shapesRef.current = shapes;
  drawToolRef.current = drawTool;

  const drawEnabled = drawTool !== 'off';

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
        const isGreen = s.color === 'green';
        drawArrow(
          ctx,
          start.x,
          start.y,
          end.x,
          end.y,
          isGreen ? GREEN : RED,
          isGreen ? 10 : 4
        );
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

      const tool = drawToolRef.current;
      const sameCell = start.col === gridPos.col && start.row === gridPos.row;
      let nextShape = null;

      if (tool === 'arrow-green' || tool === 'arrow-red') {
        if (sameCell) {
          nextShape = { type: 'circle', startCol: start.col, startRow: start.row };
        } else if (tool === 'arrow-green') {
          nextShape = {
            type: 'arrow',
            color: 'green',
            startCol: start.col,
            startRow: start.row,
            endCol: gridPos.col,
            endRow: gridPos.row,
          };
        } else {
          nextShape = {
            type: 'arrow',
            color: 'red',
            startCol: start.col,
            startRow: start.row,
            endCol: gridPos.col,
            endRow: gridPos.row,
          };
        }
      }

      if (nextShape) onShapesChange?.([...shapesRef.current, nextShape]);
    };

    boardEl.addEventListener('contextmenu', onContextMenu);
    boardEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      boardEl.removeEventListener('contextmenu', onContextMenu);
      boardEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [drawEnabled, drawTool, getBoardEl, getCellCenter, onShapesChange]);

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
