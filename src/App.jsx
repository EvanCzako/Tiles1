import { useEffect, useLayoutEffect, useCallback, useState, useRef } from 'react'
import useGameStore, {
  CONTAINER_W, CONTAINER_H, CELL, GAP, ANIM_MS,
  sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft,
} from './store'
import { PENDING_ROW_START, isDeadCell, getTileColor } from './gameLogic'
import './App.css'

// Height consumed by title + scoreboard + hint + gaps + app padding (both sides).
// Used to compute available arena height from window.innerHeight without
// measuring DOM elements (avoids BoundingClientRect race conditions on resize).
const HEADER_H = 140;

const isTouch = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// ── FlyingTile ──────────────────────────────────────────────────────────────
function FlyingTile({ value, fromX, fromY, toX, toY, flyThrough = false }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setActive(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const { bg, text } = getTileColor(value);
  const dx = fromX - toX;
  const dy = fromY - toY;

  return (
    <div style={{
      position: 'absolute',
      left: toX, top: toY,
      width: CELL, height: CELL,
      background: bg, color: text,
      fontSize: CELL * 0.35, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 6,
      transform: active ? 'translate(0,0)' : `translate(${dx}px,${dy}px)`,
      opacity: active && flyThrough ? 0 : 1,
      transition: active
        ? `transform ${ANIM_MS}ms ease-in${flyThrough ? `, opacity ${ANIM_MS * 0.5}ms ease-in ${ANIM_MS * 0.5}ms` : ', opacity 0s'}`
        : 'none',
      pointerEvents: 'none',
      zIndex: 20,
    }}>
      {value}
    </div>
  );
}

// ── Static Tile ─────────────────────────────────────────────────────────────
function Tile({ value, size = CELL, flashing = false, flashRed = false, disabled = false }) {
  const { bg, text } = disabled
    ? { bg: '#4a1c1c', text: '#c06060' }
    : getTileColor(value);
  return (
    <div
      className={`tile${value > 0 && !disabled ? ' tile--filled' : ''}${flashing ? ' tile--flash' : ''}${flashRed ? ' tile--flash-red' : ''}${disabled ? ' tile--disabled' : ''}`}
      style={{ width: size, height: size, background: bg, color: text, fontSize: size * 0.35 }}
    >
      {value > 0 && !disabled ? value : ''}
    </div>
  );
}

// ── Scale calculation (pure — no DOM measurement) ───────────────────────────
function computeScale() {
  const availW = window.innerWidth  - 32;       // 16px padding each side
  const availH = window.innerHeight - HEADER_H;
  return Math.max(0.28, Math.min(1, availW / CONTAINER_W, availH / CONTAINER_H));
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    grid, leftPending, rightPending, topPending,
    score, missCount, gameOver,
    flyingTiles, flyingSource,
    flashSet, redFlashSet, redFlashSource,
    collapsingCells, disabledLeft, disabledRight, disabledTop,
    triggerPush, reset,
  } = useGameStore();

  const [scale, setScale] = useState(() =>
    typeof window === 'undefined' ? 1 : computeScale()
  );

  const touchStart = useRef(null);

  // ── Responsive scale ───────────────────────────────────────────────────────
  useLayoutEffect(() => {
    let rafId = null;
    const update = () => setScale(computeScale());
    const defer  = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(update); };

    const ro = new ResizeObserver(defer);
    ro.observe(document.documentElement);
    window.addEventListener('resize', defer);
    window.visualViewport?.addEventListener('resize', defer);
    update();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', defer);
      window.visualViewport?.removeEventListener('resize', defer);
    };
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const handleKey = useCallback((e) => {
    if (e.key === 'ArrowLeft')       { e.preventDefault(); triggerPush('left');  }
    else if (e.key === 'ArrowRight') { e.preventDefault(); triggerPush('right'); }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); triggerPush('down');  }
  }, [triggerPush]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // ── Touch / swipe ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onStart = e => {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onEnd = e => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      touchStart.current = null;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
      if (Math.abs(dx) >= Math.abs(dy)) triggerPush(dx < 0 ? 'left' : 'right');
      else if (dy > 0) triggerPush('down');
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend',   onEnd);
    };
  }, [triggerPush]);

  return (
    <div className="app">
      <h1 className="title">TILES</h1>
      <div className="scoreboard">
        <p className="score">Score: {score}</p>
        <p className="misses">Misses: {missCount}</p>
      </div>
      <p className="hint">
        {isTouch
          ? 'swipe ← → to push  ·  swipe ↓ to drop'
          : '← → push tiles in  ·  ↓ drop from top'}
      </p>
      <div className="arena-container">
        <div style={{ width: CONTAINER_W * scale, height: CONTAINER_H * scale, overflow: 'hidden', flexShrink: 0, marginTop: Math.max(0, window.innerHeight - HEADER_H - CONTAINER_H * scale) / 4 }}>
          <div className="arena" style={{ width: CONTAINER_W, height: CONTAINER_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>

            {gameOver && (
              <div className="game-over-overlay">
                <div className="game-over-box">
                  <h2>GAME OVER</h2>
                  <p>Score: {score}</p>
                  <button onClick={reset}>Play Again</button>
                </div>
              </div>
            )}

            {flyingTiles.map(ft => (
              <FlyingTile
                key={ft.id}
                value={ft.value}
                fromX={ft.from.x} fromY={ft.from.y}
                toX={ft.to.x}     toY={ft.to.y}
                flyThrough={ft.flyThrough}
              />
            ))}

            {/* Top pending */}
            <div className="pending-row" style={{ left: sideOffset + topPendingLeft, top: 0 }}>
              {topPending.map((val, i) => {
                const isDisabled = disabledTop.has(i);
                const isBlocked  = redFlashSource === 'topPending' && redFlashSet.has(i);
                return (
                  <Tile key={i}
                    value={flyingSource === 'top' && !isBlocked && !isDisabled ? 0 : val}
                    flashRed={isBlocked}
                    disabled={isDisabled}
                  />
                );
              })}
            </div>

            {/* Left pending */}
            <div className="pending-col" style={{ left: 0, top: pendingColTop }}>
              {leftPending.map((val, i) => {
                const rowActive  = grid[PENDING_ROW_START + i].some(v => v !== 0);
                const isDisabled = disabledLeft.has(i);
                const isBlocked  = redFlashSource === 'leftPending' && redFlashSet.has(i);
                return rowActive
                  ? <Tile key={i}
                      value={flyingSource === 'left' && !isBlocked && !isDisabled ? 0 : val}
                      flashRed={isBlocked}
                      disabled={isDisabled}
                    />
                  : <div key={i} className="tile tile--dead" style={{ width: CELL, height: CELL }} />;
              })}
            </div>

            {/* Grid */}
            <div className="grid" style={{ left: sideOffset, top: gridTopOffset, width: gridPx }}>
              {grid.map((row, r) =>
                row.map((val, c) => (
                  isDeadCell(r, c)
                    ? <div key={`${r}-${c}`} className="tile tile--dead" style={{ width: CELL, height: CELL }} />
                    : <Tile
                        key={`${r}-${c}`}
                        value={collapsingCells.has(`${r},${c}`) ? 0 : val}
                        flashing={flashSet.has(`${r},${c}`)}
                      />
                ))
              )}
            </div>

            {/* Right pending */}
            <div className="pending-col" style={{ left: sideOffset + gridPx + GAP * 4, top: pendingColTop }}>
              {rightPending.map((val, i) => {
                const rowActive  = grid[PENDING_ROW_START + i].some(v => v !== 0);
                const isDisabled = disabledRight.has(i);
                const isBlocked  = redFlashSource === 'rightPending' && redFlashSet.has(i);
                return rowActive
                  ? <Tile key={i}
                      value={flyingSource === 'right' && !isBlocked && !isDisabled ? 0 : val}
                      flashRed={isBlocked}
                      disabled={isDisabled}
                    />
                  : <div key={i} className="tile tile--dead" style={{ width: CELL, height: CELL }} />;
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
