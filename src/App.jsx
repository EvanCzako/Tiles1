import { useEffect, useCallback, useReducer, useState, useRef } from 'react'
import {
  ROWS, COLS, PENDING_SIZE, TOP_PENDING_SIZE, PENDING_ROW_START, PENDING_COL_START,
  createInitialGrid, createInitialPending, createInitialTopPending,
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
    topPending:   createInitialTopPending(),
  };
}

function reducer(state, action) {
  if (action.type === 'APPLY') return { ...state, ...action.payload };
  if (action.type === 'RESET') return initState();
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
function Tile({ value, size = CELL, flashing = false, flashRed = false, disabled = false }) {
  const { bg, text } = disabled
    ? { bg: '#4a1c1c', text: '#c06060' }
    : getTileColor(value);
  return (
    <div
      className={`tile ${value > 0 && !disabled ? 'tile--filled' : ''} ${flashing ? 'tile--flash' : ''} ${flashRed ? 'tile--flash-red' : ''} ${disabled ? 'tile--disabled' : ''}`}
      style={{ width: size, height: size, background: bg, color: text, fontSize: size * 0.35 }}
    >
      {value > 0 && !disabled ? value : ''}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch]     = useReducer(reducer, null, initState);
  const [score, setScore]     = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [flyingTiles, setFlyingTiles] = useState([]);
  const [flyingSource, setFlyingSource] = useState(null); // 'left'|'right'|'top'|null
  const [flashSet, setFlashSet] = useState(new Set());
  const [redFlashSet, setRedFlashSet] = useState(new Set()); // pending slot indices flashing red
  const [redFlashSource, setRedFlashSource] = useState(null); // which pending key owns the red flash
  const [collapsingCells, setCollapsingCells] = useState(new Set());
  const [disabledLeft, setDisabledLeft]   = useState(new Set());
  const [disabledRight, setDisabledRight] = useState(new Set());
  const [disabledTop, setDisabledTop]     = useState(new Set());
  const [gameOver, setGameOver]           = useState(false);
  const pendingCommit = useRef(null); // stores { payload, mergedCells, pushScore }

  const handleKey = useCallback((e) => {
    if (animating || gameOver) return;

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

    const disabled = pendingKey === 'leftPending' ? disabledLeft
                   : pendingKey === 'rightPending' ? disabledRight
                   : disabledTop;
    const filteredPending = pendingArg.map((v, i) => disabled.has(i) ? 0 : v);

    const result = pushFn(state.grid, filteredPending);
    const { landings, mergedCells, score: pushScore, blockedIndices } = result;

    if (blockedIndices.length > 0) {
      setMissCount(prev => prev + blockedIndices.length);
      setRedFlashSet(new Set(blockedIndices));
      setRedFlashSource(pendingKey);
    }

    // Store state to commit after animation
    pendingCommit.current = {
      payload: { grid: result.grid, [pendingKey]: result.pending },
      mergedCells,
      pushScore,
      blockedIndices,
      pendingKey,
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
      const newDL = pendingKey === 'leftPending'  ? new Set([...disabledLeft,  ...blockedIndices]) : disabledLeft;
      const newDR = pendingKey === 'rightPending' ? new Set([...disabledRight, ...blockedIndices]) : disabledRight;
      const newDT = pendingKey === 'topPending'   ? new Set([...disabledTop,   ...blockedIndices]) : disabledTop;
      if (blockedIndices.length > 0) {
        if (pendingKey === 'leftPending')  setDisabledLeft(newDL);
        if (pendingKey === 'rightPending') setDisabledRight(newDR);
        if (pendingKey === 'topPending')   setDisabledTop(newDT);
        setTimeout(() => { setRedFlashSet(new Set()); setRedFlashSource(null); }, FLASH_MS);
      }
      const g0 = pendingCommit.current.payload.grid;
      const rowAct0 = i => g0[PENDING_ROW_START + i].some(v => v !== 0);
      if (Array.from({length: PENDING_SIZE},     (_, i) => i).every(i => !rowAct0(i) || newDL.has(i)) &&
          Array.from({length: PENDING_SIZE},     (_, i) => i).every(i => !rowAct0(i) || newDR.has(i)) &&
          Array.from({length: TOP_PENDING_SIZE}, (_, i) => i).every(i => newDT.has(i))) setGameOver(true);
      return;
    }

    const sourceKey = pendingKey.replace('Pending', ''); // 'left'|'right'|'top'
    setFlyingTiles(flying);
    setFlyingSource(sourceKey);
    setAnimating(true);

    setTimeout(() => {
      const { payload, mergedCells, pushScore, blockedIndices: blocked, pendingKey: pKey } = pendingCommit.current;

      // Update score
      setScore(prev => prev + pushScore);

      // Flash merged cells
      if (mergedCells.length > 0) {
        const keys = new Set(mergedCells.map(([r, c]) => `${r},${c}`));
        setFlashSet(keys);
        setTimeout(() => setFlashSet(new Set()), FLASH_MS);
      }

      // Update disabled sets for any newly blocked tiles
      const newDL = pKey === 'leftPending'  ? new Set([...disabledLeft,  ...blocked]) : disabledLeft;
      const newDR = pKey === 'rightPending' ? new Set([...disabledRight, ...blocked]) : disabledRight;
      const newDT = pKey === 'topPending'   ? new Set([...disabledTop,   ...blocked]) : disabledTop;
      if (blocked.length > 0) {
        if (pKey === 'leftPending')  setDisabledLeft(newDL);
        if (pKey === 'rightPending') setDisabledRight(newDR);
        if (pKey === 'topPending')   setDisabledTop(newDT);
      }

      // Clear push animation artifacts
      setFlyingTiles([]);
      setFlyingSource(null);
      setRedFlashSet(new Set());
      setRedFlashSource(null);

      // Check for collapses in the post-push grid
      const { grid: collapsedGrid, moves } = collapseGrid(payload.grid);

      // Helper: check game-over given the final settled grid and updated disabled sets
      const isGameOver = (finalGrid) => {
        const rowAct = i => finalGrid[PENDING_ROW_START + i].some(v => v !== 0);
        return (
          Array.from({length: PENDING_SIZE},     (_, i) => i).every(i => !rowAct(i) || newDL.has(i)) &&
          Array.from({length: PENDING_SIZE},     (_, i) => i).every(i => !rowAct(i) || newDR.has(i)) &&
          Array.from({length: TOP_PENDING_SIZE}, (_, i) => i).every(i => newDT.has(i))
        );
      };

      if (moves.length === 0) {
        dispatch({ type: 'APPLY', payload });
        if (isGameOver(payload.grid)) setGameOver(true);
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
          if (isGameOver(collapsedGrid)) setGameOver(true);
          setAnimating(false);
        }, ANIM_MS + 30);
      }));
    }, ANIM_MS + 30);

  }, [animating, state, gameOver, disabledLeft, disabledRight, disabledTop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET' });
    setScore(0);
    setMissCount(0);
    setAnimating(false);
    setFlyingTiles([]);
    setFlyingSource(null);
    setFlashSet(new Set());
    setRedFlashSet(new Set());
    setRedFlashSource(null);
    setCollapsingCells(new Set());
    setDisabledLeft(new Set());
    setDisabledRight(new Set());
    setDisabledTop(new Set());
    setGameOver(false);
    pendingCommit.current = null;
  }, []);

  const { grid, leftPending, rightPending, topPending } = state;

  return (
    <div className="app">
      <h1 className="title">TILES</h1>
      <div className="scoreboard">
        <p className="score">Score: {score}</p>
        <p className="misses">Misses: {missCount}</p>
      </div>
      <p className="hint">← → push tiles in &nbsp;|&nbsp; ↓ drop from top</p>
      <div className="arena" style={{ width: CONTAINER_W, height: CONTAINER_H }}>

        {gameOver && (
          <div className="game-over-overlay">
            <div className="game-over-box">
              <h2>GAME OVER</h2>
              <p>Score: {score}</p>
              <button onClick={handleRestart}>Play Again</button>
            </div>
          </div>
        )}

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

        {/* Left pending column */}
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

        {/* Right pending column */}
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
  );
}
