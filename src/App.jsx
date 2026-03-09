import { useEffect, useRef, useState } from "react";
import "./App.css";
import { astar } from "./solver";

const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0];

function canMoveIdx(i, zero) {
  const r1 = Math.floor(i / 3), c1 = i % 3;
  const r2 = Math.floor(zero / 3), c2 = zero % 3;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function scrambleByDepth(depth) {
  let board = [...GOAL];
  let zero = board.indexOf(0);
  for (let k = 0; k < depth; k++) {
    const moves = [];
    for (let i = 0; i < 9; i++) if (canMoveIdx(i, zero)) moves.push(i);
    const pick = moves[Math.floor(Math.random() * moves.length)];
    [board[pick], board[zero]] = [board[zero], board[pick]];
    zero = pick;
  }
  return board;
}

function isSolved(board) {
  return board.every((v, i) => v === GOAL[i]);
}

export default function App() {
  const [screen, setScreen] = useState("game");
  const [showComparison, setShowComparison] = useState(false);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [initialBoard, setInitialBoard] = useState(() => scrambleByDepth(25));
  const [board, setBoard] = useState(initialBoard);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [theme, setTheme] = useState("dark");
  const [solving, setSolving] = useState(false);
  const [gameStatus, setGameStatus] = useState("playing"); // playing | ended

  const MAX_HINTS = 3;
  const HINT_COOLDOWN = 10;
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [hintCooldown, setHintCooldown] = useState(0);

  const [soundOn, setSoundOn] = useState(true);
  const moveAudioRef = useRef(null);
  const winAudioRef = useRef(null);

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem("stats");
    return saved
      ? JSON.parse(saved)
      : { gamesPlayed: 0, bestTime: null, bestMoves: null };
  });

  const [shakeIndex, setShakeIndex] = useState(null);
  const [hintFrom, setHintFrom] = useState(null);
  const [optimalMoves, setOptimalMoves] = useState(null);

  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem("seenTutorial");
  });

  function closeTutorial() {
    localStorage.setItem("seenTutorial", "1");
    setShowTutorial(false);
  }
  useEffect(() => {
  reshuffle();
}, [difficulty]);

  useEffect(() => {
    localStorage.setItem("stats", JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    moveAudioRef.current = new Audio("/sounds/move.wav");
    winAudioRef.current = new Audio("/sounds/win.wav");
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (hintCooldown <= 0) return;
    const id = setInterval(() => setHintCooldown((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [hintCooldown]);

  function playMove() {
    if (!soundOn || !moveAudioRef.current) return;
    moveAudioRef.current.currentTime = 0;
    moveAudioRef.current.play().catch(() => {});
  }

  function playWin() {
    if (!soundOn || !winAudioRef.current) return;
    winAudioRef.current.currentTime = 0;
    winAudioRef.current.play().catch(() => {});
  }

 function updateStatsOnWin(time, movesCount) {
  let isNewBest = false;

  setStats((s) => {
    const bestTime = s.bestTime === null ? time : Math.min(s.bestTime, time);
    const bestMoves = s.bestMoves === null ? movesCount : Math.min(s.bestMoves, movesCount);

    if (time < (s.bestTime ?? Infinity) || movesCount < (s.bestMoves ?? Infinity)) {
      isNewBest = true;
    }

    return {
      gamesPlayed: s.gamesPlayed + 1,
      bestTime,
      bestMoves,
    };
  });

  return isNewBest;
}
  function moveTile(i) {
    if (solving || gameStatus === "ended") return;
    const zero = board.indexOf(0);
    if (!canMoveIdx(i, zero)) {
      setShakeIndex(i);
      setTimeout(() => setShakeIndex(null), 200);
      return;
    }

    if (!running) setRunning(true);
    setHistory((h) => [...h, board]);

    const next = [...board];
    [next[i], next[zero]] = [next[zero], next[i]];
    setBoard(next);
    setMoves((m) => m + 1);
    playMove();

    if (isSolved(next)) {
      setRunning(false);
      playWin();
      const best = updateStatsOnWin(seconds, moves + 1);
      setIsNewBest(best);
      setShowWinPopup(true);
      setGameStatus("ended");
    }
  }

  function undo() {
    if (solving || !history.length || gameStatus === "ended") return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoard(prev);
    setMoves((m) => Math.max(0, m - 1));
    playMove();
  }

  function reshuffle() {
    const depth = difficulty === "easy" ? 10 : difficulty === "medium" ? 25 : 40;
    const fresh = scrambleByDepth(depth);

    setInitialBoard(fresh);
    setBoard(fresh);
    setMoves(0);
    setSeconds(0);
    setRunning(false);
    setHistory([]);
    setHintsLeft(MAX_HINTS);
    setHintCooldown(0);
    setShowComparison(false);
    setOptimalMoves(null);
    setGameStatus("playing");
  }

  function hint() {
    if (solving || hintCooldown > 0 || hintsLeft <= 0 || gameStatus === "ended") return;
    const res = astar(board);
    if (!res || res.path.length < 2) return;

    const next = res.path[1];
    const from = next.findIndex((v, idx) => v !== board[idx] && v !== 0);

    setHintFrom(from);
    setTimeout(() => setHintFrom(null), 800);

    if (!running) setRunning(true);
    setHistory((h) => [...h, board]);

    setBoard(next);
    setMoves((m) => m + 1);
    playMove();

    if (isSolved(next)) {
      setRunning(false);
      playWin();
      updateStatsOnWin(seconds, moves + 1);
      setGameStatus("ended");
    }

    setHintsLeft((h) => h - 1);
    setHintCooldown(HINT_COOLDOWN);
  }

  async function showOptimal() {
    const res = astar(initialBoard);
    if (!res) return;

    setOptimalMoves(res.path.length - 1);
    setSolving(true);
    setShowComparison(false);
    for (const state of res.path) {
      await new Promise((r) => setTimeout(r, 900));
      setBoard(state);
      playMove();
    }

    setSolving(false);
    setShowComparison(true); 
  }

  
  return (
    <div className={`app ${theme === "light" ? "light" : ""}`}>
     

      <div className="container">
        {screen === "game" && (
          <div className="card" style={{ position: "relative" }}>
            <div className="card-actions">
            
            <button className="card-icon" onClick={() => setScreen("settings")}>⚙️</button>
          </div>
            {showTutorial && (
              <div className="tutorial-overlay">
                <div className="tutorial-card">
                  <h4>👋 Welcome to 8 Puzzle</h4>
                   <p>Slide tiles into the empty space to arrange them correctly.</p>
                   <p>Match the board with the goal shown above.</p>
                   <p>Use hints wisely — fewer moves lead to better results!</p>
                  <button className="btn" onClick={closeTutorial}>Got it!</button>
                </div>
              </div>
            )}

             <div className="topbar">8 Puzzle</div>

            <div className="game-stats">
              <div>Moves: <b>{moves}</b></div>
              <div>Time: <b>{seconds}s</b></div>
              <div>Hints left: <b>{hintsLeft}</b></div>
            </div>

            <div className="goal-preview">
              <div className="goal-title">Goal</div>
              <div className="goal-grid">
                {GOAL.map((v, i) => (
                  <div
                  key={i}
                  className={`goal-tile ${v === 0 ? "blank" : ""}`}
                  style={{
                    background: v === 0 ? "" : `hsl(${v * 40}, 65%, 60%)`,
                    color: v === 0 ? "" : `hsl(${v * 40}, 70%, 30%)`,
                  }}
                >
                  {v || ""}
                </div>
                ))}
              </div>
              <div className="goal-hint">Arrange tiles to match this goal</div>
            </div>

            

          
            <div className="board">
              {board.map((v, i) => {
                const zero = board.indexOf(0);
                const isMovable = v !== 0 && canMoveIdx(i, zero) && !solving && gameStatus === "playing";
                const isShaking = shakeIndex === i;
                const isHint = hintFrom === i;

                return (
                  <button
                    key={i}
                    className={`tile ripple ${v === 0 ? "blank" : `c${v}`} ${isMovable ? "movable" : ""} ${isShaking ? "shake" : ""}`}
                    onClick={() => moveTile(i)}
                    disabled={solving || gameStatus === "ended"}
                  >
                    {v || ""}
                    {isHint && <span className="hint-arrow">➡️</span>}
                  </button>
                );
              })}
            </div>
              
            {showWinPopup && (
  <div className="win-overlay">
    <div className="win-popup">
      <div className="confetti">
  {Array.from({ length: 200 }).map((_, i) => (
    <i key={i} style={{ left: `${Math.random()*100}%`, background: `hsl(${Math.random()*360},80%,60%)`, animationDelay: `${Math.random()*0.4}s` }} />
  ))}
</div>
      <h2 className="win-title">🏆 Puzzle Solved!</h2>

      <p>⏱ Time: <b>{seconds}s</b></p>
      <p>🎯 Moves: <b>{moves}</b></p>

      {isNewBest && <div className="badge">🏆 New Best Score!</div>}

      <button className="btn" onClick={() => {
        setShowWinPopup(false);
        showOptimal();
      }}>
       👀 See Best Moves
      </button>
      
            
            

      <button className="btn secondary" onClick={() => {
        setShowWinPopup(false);
        reshuffle();
      }}>
         🔄Play Again
      </button>
    </div>
  </div>
)}

<div className="actions icons">
  <button
    className="icon-btn"
    onClick={reshuffle}
    disabled={solving}
    title="Shuffle"
  >
  🔀
  <span>Shuffle</span>
  </button>

  <button
    className="icon-btn secondary"
    onClick={undo}
    disabled={solving || !history.length || gameStatus === "ended"}
    title="Undo last move"
  >
  ↩️
  <span>Undo</span>
  </button>

  <button
    className="icon-btn"
    onClick={hint}
    disabled={solving || hintCooldown > 0 || hintsLeft <= 0 || gameStatus === "ended"}
    title="Hint (A*)"
  >
  💡
  <span>
  Hint {hintCooldown > 0 && <small>({hintCooldown}s)</small>}
  </span>
  </button>
  </div>
  {/* 🔥 PLACE IT HERE */}
{showComparison && (
  <div className="optimal-result">
    Your moves: <b>{moves}</b>, Best moves: <b>{optimalMoves}</b>
  </div>
)}
</div>
        )}

       
        {screen === "settings" && (
          <div className="card settings-card">
            <h3 style={{ textAlign: "center", margin: 0 }}>Settings</h3>
            <div className="settings">
              <div>
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                 
   
              </div>

              

              <div>
                <label>Sound</label>
                <select value={soundOn ? "on" : "off"} onChange={(e) => setSoundOn(e.target.value === "on")}>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>
            </div>
            <br></br>
              <button className="back-btn" onClick={() => setScreen("game")}>
                ⬅️
              </button>
          </div>
        )}
      </div>

      {/* <div className="bottom-nav"> */}
        {/* <button className={screen === "game" ? "active" : ""} onClick={() => setScreen("game")}>🔢 Game</button> */}
        {/* <button className={screen === "stats" ? "active" : ""} onClick={() => setScreen("stats")}>📊 Stats</button> */}
        {/* <button className={screen === "settings" ? "active" : ""} onClick={() => setScreen("settings")}>⚙️ Settings</button> */}
      {/* </div> */}
    </div>
  );
}