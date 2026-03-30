import { useEffect, useLayoutEffect, useCallback, useState, useRef } from 'react'
import useGameStore, { CELL, GAP, ANIM_MS } from './store'
import { isDeadCell, getTileColor } from './gameLogic'
import './App.css'

// Vertical space consumed by title + score + hint + gaps + app padding in portrait/desktop.
const HEADER_H = 180;
// Width of the left label panel and right swipe zone in small landscape mode.
const LANDSCAPE_PANEL_W = 100;

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
function Tile({ value, size = CELL, flashing = false, flashRed = false, flashAnnihilate = false, disabled = false }) {
  const { bg, text } = disabled
    ? { bg: '#4a1c1c', text: '#c06060' }
    : getTileColor(value);
  return (
    <div
      className={`tile${value > 0 && !disabled ? ' tile--filled' : ''}${flashing ? ' tile--flash' : ''}${flashRed ? ' tile--flash-red' : ''}${flashAnnihilate ? ' tile--flash-annihilate' : ''}${disabled ? ' tile--disabled' : ''}`}
      style={{ width: size, height: size, background: bg, color: text, fontSize: size * 0.35 }}
    >
      {value > 0 && !disabled ? value : ''}
    </div>
  );
}

// ── Scale calculation (pure — no DOM measurement) ───────────────────────────
function computeScale(containerW, containerH) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  // Small landscape = phone on its side (not a tablet)
  const smallLandscape = vw > vh && vh <= 500;
  const availW = vw - 32 - (smallLandscape ? LANDSCAPE_PANEL_W * 2 : 0);
  const availH = vh - (smallLandscape ? 32 : HEADER_H);
  return Math.max(0.28, Math.min(1, availW / containerW, availH / containerH));
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const {
    grid, leftPending, rightPending, topPending,
    score, gameOver, animating, frozenPendingRows,
    flyingTiles, flyingSource,
    flashSet, redFlashSet, redFlashSource, annihilateSet,
    collapsingCells, disabledLeft, disabledRight, disabledTop,
    triggerPush, reset, cfg, layout,
  } = useGameStore();

  const { sideOffset, gridPx, gridTopOffset, pendingColTop, topPendingLeft,
          CONTAINER_W, CONTAINER_H } = layout;
  const { PENDING_ROW_START } = cfg;

  const [scale, setScale] = useState(() =>
    typeof document === 'undefined' ? 1 : computeScale(CONTAINER_W, CONTAINER_H)
  );

  const touchStart = useRef(null);
  const layoutRef  = useRef(layout);
  layoutRef.current = layout;

  // ── Scale update when grid mode changes ────────────────────────────────────────
  useEffect(() => {
    setScale(computeScale(CONTAINER_W, CONTAINER_H));
  }, [CONTAINER_W, CONTAINER_H]);

  // ── Responsive scale ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    let rafId = null;
    const update = () => setScale(computeScale(layoutRef.current.CONTAINER_W, layoutRef.current.CONTAINER_H));
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
      <div className="game-header">
        <h1 className="title">TILES</h1>
        <p className="score">Score: {score}</p>
        <p className="hint">
          {isTouch
            ? 'swipe ← → to push  ·  swipe ↓ to drop'
            : '← → push tiles in  ·  ↓ drop from top'}
        </p>
      </div>
      <div className="arena-container">
        <div style={{ width: CONTAINER_W * scale, height: CONTAINER_H * scale, overflow: 'hidden', flexShrink: 0, maxWidth: '100%' }}>
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
                const rowActive  = frozenPendingRows ? frozenPendingRows.left[i] : grid[PENDING_ROW_START + i].some(v => v !== 0);
                const isDisabled = disabledLeft.has(i);
                const isBlocked  = redFlashSource === 'leftPending' && redFlashSet.has(i);
                return rowActive
                  ? <Tile key={i}
                      value={flyingSource === 'left' && !isBlocked && !isDisabled ? 0 : val}
                      flashRed={isBlocked}
                      disabled={isDisabled}
                    />
                  : <Tile key={i} value={0} />;
              })}
            </div>

            {/* Grid */}
            <div className="grid" style={{ left: sideOffset, top: gridTopOffset, width: gridPx, gridTemplateColumns: `repeat(${cfg.COLS}, ${CELL}px)` }}>
              {grid.map((row, r) =>
                row.map((val, c) => (
                  isDeadCell(r, c)
                    ? <div key={`${r}-${c}`} className="tile tile--dead" style={{ width: CELL, height: CELL }} />
                    : <Tile
                        key={`${r}-${c}`}
                        value={collapsingCells.has(`${r},${c}`) ? 0 : val}
                        flashing={flashSet.has(`${r},${c}`)}
                        flashAnnihilate={annihilateSet.has(`${r},${c}`)}
                      />
                ))
              )}
            </div>

            {/* Right pending */}
            <div className="pending-col" style={{ left: sideOffset + gridPx + GAP * 4, top: pendingColTop }}>
              {rightPending.map((val, i) => {
                const rowActive  = frozenPendingRows ? frozenPendingRows.right[i] : grid[PENDING_ROW_START + i].some(v => v !== 0);
                const isDisabled = disabledRight.has(i);
                const isBlocked  = redFlashSource === 'rightPending' && redFlashSet.has(i);
                return rowActive
                  ? <Tile key={i}
                      value={flyingSource === 'right' && !isBlocked && !isDisabled ? 0 : val}
                      flashRed={isBlocked}
                      disabled={isDisabled}
                    />
                  : <Tile key={i} value={0} />;
              })}
            </div>

          </div>
        </div>
      </div>
      <div className="swipe-zone" />
    </div>
  );
}
