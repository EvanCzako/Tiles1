import { useEffect, useCallback, useReducer, useState, useRef } from 'react'
import {
  ROWS, COLS, PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START,
  createInitialGrid, createInitialPending,
  pushFromLeft, pushFromRight, pushFromTop,
  collapseGrid, getTileColor, isDeadCell,
} from './gameLogic'
import './App.css'

const CELL = 52;
const GAP  = 4;
const ANIM_MS  = 220;
const FLASH_MS = 320;

// ── Layout (all module-level so position helpers don't need the component) ──
const sideOffset    = CELL + GAP * 4;                             // 68
const gridPx        = COLS * CELL + (COLS - 1) * GAP;             // 500
const gridTopOffset = 3 * (CELL + GAP);                           // 168
const gridBottom    = gridTopOffset + ROWS * (CELL + GAP) - GAP;  // 668
const pendingColTop = gridBottom - PENDING_SIZE * (CELL + GAP) + GAP; // 392
const topPendingLeft = PENDING_COL_START * (CELL + GAP);          // 112
const CONTAINER_H   = gridTopOffset + ROWS * (CELL + GAP);
const CONTAINER_W   = gridPx + 2 * (CELL + GAP * 4);

// Pixel position of a grid cell's top-left corner in the arena
const cellPos = (r, c) => ({
  x: sideOffset + c * (CELL + GAP),
  y: gridTopOffset + r * (CELL + GAP),
});

// Pixel position of each pending tile
const leftPendingPos  = i => ({ x: 0,                                    y: pendingColTop + i * (CELL + GAP) });
const rightPendingPos = i => ({ x: sideOffset + gridPx + GAP * 4,        y: pendingColTop + i * (CELL + GAP) });
const topPendingPos   = i => ({ x: sideOffset + topPendingLeft + i * (CELL + GAP), y: 0 });

// ── State ──────────────────────────────────────────────────────────────────
function initState() {
  return {
    grid: createInitialGrid(),
    leftPending:  createInitialPending(),
    rightPending: createInitialPending(),
    topPending:   createInitialPending(),
  };
}

function reducer(state, action) {
  if (action.type === 'APPLY') return { ...state, ...action.payload };
  return state;
}

// ── FlyingTile ─────────────────────────────────────────────────────────────
// Sits at `to` position in the arena, starts offset by (from - to), then
// transitions to (0,0) — creating the sliding-in effect.
function FlyingTile({ value, fromX, fromY, toX, toY, flyThrough = false }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Double-RAF ensures initial offset renders before transition starts
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
      boxShadow: '0 2px 14px rgba(0,0,0,0.55)',
    }}>
      {value}
    </div>
  );
}

// ── Static Tile ────────────────────────────────────────────────────────────
function Tile({ value, size = CELL, flashing = false }) {
  const { bg, text } = getTileColor(value);
  return (
    <div
      className={`tile ${value > 0 ? 'tile--filled' : ''} ${flashing ? 'tile--flash' : ''}`}
      style={{ width: size, height: size, background: bg, color: text, fontSize: size * 0.35 }}
    >
      {value > 0 ? value : ''}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch]     = useReducer(reducer, null, initState);
  const [animating, setAnimating] = useState(false);
  const [flyingTiles, setFlyingTiles] = useState([]);
  const [flyingSource, setFlyingSource] = useState(null); // 'left'|'right'|'top'|null
  const [flashSet, setFlashSet] = useState(new Set());
  const [collapsingCells, setCollapsingCells] = useState(new Set());
  const pendingCommit = useRef(null); // stores { payload, mergedCells }

  const handleKey = useCallback((e) => {
    if (animating) return;

    let pushFn, pendingArg, pendingKey, getPendingPos;

    if (e.key === 'ArrowLeft') {
      pushFn = pushFromLeft;  pendingArg = state.leftPending;
      pendingKey = 'leftPending';  getPendingPos = leftPendingPos;
    } else if (e.key === 'ArrowRight') {
      pushFn = pushFromRight; pendingArg = state.rightPending;
      pendingKey = 'rightPending'; getPendingPos = rightPendingPos;
    } else if (e.key === 'ArrowDown') {
      pushFn = pushFromTop;   pendingArg = state.topPending;
      pendingKey = 'topPending';   getPendingPos = topPendingPos;
    } else {
      return;
    }

    e.preventDefault();

    const result = pushFn(state.grid, pendingArg);
    const { landings, mergedCells } = result;

    // Store state to commit after animation
    pendingCommit.current = {
      payload: { grid: result.grid, [pendingKey]: result.pending },
      mergedCells,
    };

    // Build flying tile list from landings
    // Skip fly-through animation for left/right slots whose row has no tiles (they're hidden)
    const rowIsVisible = (pendingIdx) => {
      if (pendingKey === 'topPending') return true;
      const row = PENDING_ROW_START + pendingIdx;
      return state.grid[row].some(v => v !== 0);
    };

    const flying = landings.filter(land => !land.flyThrough || rowIsVisible(land.pendingIdx)).map((land, idx) => {
      const from = getPendingPos(land.pendingIdx);
      let to, flyThrough;
      if (land.flyThrough) {
        flyThrough = true;
        if (pendingKey === 'leftPending')       to = { x: CONTAINER_W + CELL, y: from.y };
        else if (pendingKey === 'rightPending') to = { x: -CELL * 2,          y: from.y };
        else                                    to = { x: from.x, y: CONTAINER_H + CELL };
      } else {
        flyThrough = false;
        to = cellPos(land.row, land.col);
      }
      return { id: idx, value: pendingArg[land.pendingIdx], from, to, flyThrough };
    });

    if (flying.length === 0) {
      // Nothing landed — commit immediately, no animation
      dispatch({ type: 'APPLY', payload: pendingCommit.current.payload });
      return;
    }

    const sourceKey = pendingKey.replace('Pending', ''); // 'left'|'right'|'top'
    setFlyingTiles(flying);
    setFlyingSource(sourceKey);
    setAnimating(true);

    setTimeout(() => {
      const { payload, mergedCells } = pendingCommit.current;

      // Flash merged cells
      if (mergedCells.length > 0) {
        const keys = new Set(mergedCells.map(([r, c]) => `${r},${c}`));
        setFlashSet(keys);
        setTimeout(() => setFlashSet(new Set()), FLASH_MS);
      }

      // Clear push animation artifacts
      setFlyingTiles([]);
      setFlyingSource(null);

      // Check for collapses in the post-push grid
      const { grid: collapsedGrid, moves } = collapseGrid(payload.grid, sourceKey);

      if (moves.length === 0) {
        dispatch({ type: 'APPLY', payload });
        setAnimating(false);
        return;
      }

      // Commit post-push state (holes visible), then animate collapse
      dispatch({ type: 'APPLY', payload });

      requestAnimationFrame(() => requestAnimationFrame(() => {
        const collapseTiles = moves.map((m, idx) => ({
          id: `collapse-${idx}`,
          value: m.value,
          from: cellPos(m.fromRow, m.fromCol),
          to:   cellPos(m.toRow,   m.toCol),
          flyThrough: false,
        }));
        setFlyingTiles(collapseTiles);
        setCollapsingCells(new Set(moves.map(m => `${m.fromRow},${m.fromCol}`)));

        setTimeout(() => {
          dispatch({ type: 'APPLY', payload: { grid: collapsedGrid } });
          setFlyingTiles([]);
          setCollapsingCells(new Set());
          setAnimating(false);
        }, ANIM_MS + 30);
      }));
    }, ANIM_MS + 30);

  }, [animating, state]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const { grid, leftPending, rightPending, topPending } = state;

  return (
    <div className="app">
      <h1 className="title">TILES</h1>
      <p className="hint">← → push tiles in &nbsp;|&nbsp; ↓ drop from top</p>
      <div className="arena" style={{ width: CONTAINER_W, height: CONTAINER_H }}>

        {/* Flying tile overlays */}
        {flyingTiles.map(ft => (
          <FlyingTile
            key={ft.id}
            value={ft.value}
            fromX={ft.from.x} fromY={ft.from.y}
            toX={ft.to.x}   toY={ft.to.y}
            flyThrough={ft.flyThrough}
          />
        ))}

        {/* Top pending row */}
        <div className="pending-row" style={{ left: sideOffset + topPendingLeft, top: 0 }}>
          {topPending.map((val, i) => (
            <Tile key={i} value={flyingSource === 'top' ? 0 : val} />
          ))}
        </div>

        {/* Left pending column */}
        <div className="pending-col" style={{ left: 0, top: pendingColTop }}>
          {leftPending.map((val, i) => {
            const rowActive = grid[PENDING_ROW_START + i].some(v => v !== 0);
            return rowActive
              ? <Tile key={i} value={flyingSource === 'left' ? 0 : val} />
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

        {/* Right pending column */}
        <div className="pending-col" style={{ left: sideOffset + gridPx + GAP * 4, top: pendingColTop }}>
          {rightPending.map((val, i) => {
            const rowActive = grid[PENDING_ROW_START + i].some(v => v !== 0);
            return rowActive
              ? <Tile key={i} value={flyingSource === 'right' ? 0 : val} />
              : <div key={i} className="tile tile--dead" style={{ width: CELL, height: CELL }} />;
          })}
        </div>

      </div>
    </div>
  );
}
