import { Children, cloneElement, useCallback, useEffect, useRef, useState } from 'react';

function drawArrowhead(ctx, fromX, fromY, toX, toY, radius = 15) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.translate(toX, toY);
  ctx.rotate(angle);
  ctx.moveTo(0, 0);
  ctx.lineTo(-radius, -radius / 1.5);
  ctx.lineTo(-radius, radius / 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Wraps the board and draws study arrows/circles.
 * Shapes format matches server: { type:'circle'|'arrow', startCol, startRow, endCol?, endRow? }
 */
export default function StudyDrawOverlay({
  children,
  shapes = [],
  orientation = 'white',
  enabled = false,
  onShapesChange,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const measureRef = useRef(null);
  const drawingRef = useRef({ active: false, start: null });
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const [boardWidth, setBoardWidth] = useState(null);

  const syncBoardWidth = useCallback(() => {
    const el = measureRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w > 0) setBoardWidth(Math.floor(w));
  }, []);

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
    const boardEl = measureRef.current;
    if (!canvas || !boardEl) return;

    const w = boardEl.offsetWidth;
    const h = boardEl.offsetHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const size = w / 8;

    shapesRef.current.forEach((s) => {
      ctx.lineWidth = 4;
      const start = getCanvasCoords(s.startCol, s.startRow, size);
      if (s.type === 'circle') {
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
        ctx.beginPath();
        ctx.arc(start.x, start.y, size * 0.35, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const end = getCanvasCoords(s.endCol, s.endRow, size);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        drawArrowhead(ctx, start.x, start.y, end.x, end.y, 18);
      }
    });
  }, [getCanvasCoords]);

  useEffect(() => {
    redraw();
  }, [shapes, orientation, redraw]);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      syncBoardWidth();
      redraw();
    });
    ro.observe(el);
    syncBoardWidth();
    return () => ro.disconnect();
  }, [redraw, syncBoardWidth]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !enabled) return;

    const onContextMenu = (e) => e.preventDefault();

    const onMouseDown = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const size = canvas.width / 8;
      if (!size) return;
      const gridPos = getCellCenter(e.clientX - rect.left, e.clientY - rect.top, size);

      if (e.button === 0) {
        if (shapesRef.current.length) onShapesChange?.([]);
      } else if (e.button === 2) {
        drawingRef.current = { active: true, start: gridPos };
      }
    };

    const onMouseUp = (e) => {
      if (!drawingRef.current.active || e.button !== 2) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const size = canvas.width / 8;
      const gridPos = getCellCenter(e.clientX - rect.left, e.clientY - rect.top, size);
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

    wrap.addEventListener('contextmenu', onContextMenu);
    wrap.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      wrap.removeEventListener('contextmenu', onContextMenu);
      wrap.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [enabled, getCellCenter, onShapesChange]);

  const boardChild =
    boardWidth != null
      ? cloneElement(Children.only(children), { boardWidth })
      : children;

  return (
    <div ref={wrapRef} className="study-draw-wrap">
      <div ref={measureRef} className="study-board-measure">
        {boardChild}
      </div>
      <canvas
        id="drawing-canvas"
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
    </div>
  );
}
