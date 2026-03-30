export default function GameOverOverlay({ score, onReset }) {
  return (
    <div className="game-over-overlay">
      <div className="game-over-box">
        <h2>GAME OVER</h2>
        <p>Score: {score}</p>
        <button onClick={onReset}>Play Again</button>
      </div>
    </div>
  );
}
