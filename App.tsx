import React, { useState, useEffect } from "react";
import "./App.css";

type Line = { from: [number, number]; to: [number, number] };

const GRID_SIZE = 7;

export default function App() {
  const [lines, setLines] = useState<Line[]>([]);
  const [boxes, setBoxes] = useState<{ [key: string]: string }>({});
  const [turn, setTurn] = useState<"player" | "ai">("player");
  const [scores, setScores] = useState({ player: 0, ai: 0 });
  const [lastLine, setLastLine] = useState<Line | null>(null);
  
  // Calculate total possible lines in the grid
  const maxLines = 2 * GRID_SIZE * (GRID_SIZE - 1);
  const gameOver = lines.length === maxLines;
  
  const winner = gameOver
    ? scores.player > scores.ai
      ? "player"
      : scores.ai > scores.player
      ? "ai"
      : "tie"
    : null;

  const isLineDrawnIn = (line: Line, lineSet: Line[]) =>
    lineSet.some(
      (l) =>
        (l.from[0] === line.from[0] &&
          l.from[1] === line.from[1] &&
          l.to[0] === line.to[0] &&
          l.to[1] === line.to[1]) ||
        (l.from[0] === line.to[0] &&
          l.from[1] === line.to[1] &&
          l.to[0] === line.from[0] &&
          l.to[1] === line.from[1])
    );

  const isLineDrawn = (line: Line) => isLineDrawnIn(line, lines);

  const linesEqual = (a: Line, b: Line) =>
    (a.from[0] === b.from[0] &&
      a.from[1] === b.from[1] &&
      a.to[0] === b.to[0] &&
      a.to[1] === b.to[1]) ||
    (a.from[0] === b.to[0] &&
      a.from[1] === b.to[1] &&
      a.to[0] === b.from[0] &&
      a.to[1] === b.from[1]);

  const isRecent = (line: Line) => (lastLine ? linesEqual(line, lastLine) : false);

  const checkCompletedBoxes = (
    line: Line,
    newLines: Line[],
    existingBoxes: { [key: string]: string }
  ) => {
    const completed: string[] = [];
    for (let r = 0; r < GRID_SIZE - 1; r++) {
      for (let c = 0; c < GRID_SIZE - 1; c++) {
        const top: Line = { from: [r, c] as [number, number], to: [r, c + 1] as [number, number] };
        const bottom: Line = { from: [r + 1, c] as [number, number], to: [r + 1, c + 1] as [number, number] };
        const left: Line = { from: [r, c] as [number, number], to: [r + 1, c] as [number, number] };
        const right: Line = { from: [r, c + 1] as [number, number], to: [r + 1, c + 1] as [number, number] };


        const boxLines = [top, bottom, left, right];
        const key = `${r}-${c}`;
        if (boxLines.every((l) => isLineDrawnIn(l, newLines)) && !existingBoxes[key]) {
          completed.push(key);
        }
      }
    }
    return completed;
  };

  const makeMove = (move: Line, player: "player" | "ai") => {
    if (isLineDrawn(move)) return false;

    const newLines = [...lines, move];
    const completedBoxes = checkCompletedBoxes(move, newLines, boxes);
    const newBoxes = { ...boxes };

    if (completedBoxes.length > 0) {
      completedBoxes.forEach((b) => (newBoxes[b] = player));
      setBoxes(newBoxes);
      setScores((prev) => ({
        ...prev,
        [player]: prev[player] + completedBoxes.length,
      }));
      setLines(newLines);
      setLastLine(move);
      return true; // got box, same turn
    } else {
      setLines(newLines);
      setLastLine(move);
      setTurn(player === "player" ? "ai" : "player");
      return false;
    }
  };

  const availableMoves = (lineSet: Line[] = lines) => {
    const moves: Line[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (c < GRID_SIZE - 1) moves.push({ from: [r, c], to: [r, c + 1] });
        if (r < GRID_SIZE - 1) moves.push({ from: [r, c], to: [r + 1, c] });
      }
    }
    return moves.filter((m) => !isLineDrawnIn(m, lineSet));
  };

  // 🎯 Minimax with α–β pruning
  const minimax = (
    depth: number,
    alpha: number,
    beta: number,
    isAITurn: boolean,
    tempLines: Line[],
    tempBoxes: { [key: string]: string }
  ): number => {
    if (depth === 0 || Object.keys(tempBoxes).length === (GRID_SIZE - 1) ** 2) {
      const aiScore = Object.values(tempBoxes).filter((v) => v === "ai").length;
      const playerScore = Object.values(tempBoxes).filter((v) => v === "player").length;
      return aiScore - playerScore;
    }

    const moves = availableMoves(tempLines).slice(0, 15); // limit branching

    if (isAITurn) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const simLines = [...tempLines, move];
        const completed = checkCompletedBoxes(move, simLines, tempBoxes);
        const newBoxes = { ...tempBoxes };
        completed.forEach((b) => (newBoxes[b] = "ai"));
        const evalScore = minimax(
          depth - 1,
          alpha,
          beta,
          completed.length > 0,
          simLines,
          newBoxes
        );
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const simLines = [...tempLines, move];
        const completed = checkCompletedBoxes(move, simLines, tempBoxes);
        const newBoxes = { ...tempBoxes };
        completed.forEach((b) => (newBoxes[b] = "player"));
        const evalScore = minimax(
          depth - 1,
          alpha,
          beta,
          !(completed.length > 0),
          simLines,
          newBoxes
        );
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  };

  const aiMove = (): boolean => {
    const moves = availableMoves();
    let bestScore = -Infinity;
    let bestMove: Line | null = null;

    // Priority 1: take any move that completes a box immediately
    for (const move of moves) {
      const simLines = [...lines, move];
      const completedNow = checkCompletedBoxes(move, simLines, boxes);
      if (completedNow.length > 0) {
        bestMove = move;
        break;
      }
    }

    // Otherwise fallback to minimax evaluation
    if (!bestMove) {
      for (const move of moves) {
        const simLines = [...lines, move];
        const completed = checkCompletedBoxes(move, simLines, boxes);
        const newBoxes = { ...boxes };
        completed.forEach((b) => (newBoxes[b] = "ai"));
        const score = minimax(2, -Infinity, Infinity, false, simLines, newBoxes);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }
    if (bestMove) {
      return makeMove(bestMove, "ai");
    }
    return false;
  };

  useEffect(() => {
    if (turn !== "ai") return;
    const t = setTimeout(() => {
      aiMove();
    }, 250);
    return () => clearTimeout(t);
  }, [turn, lines.length, Object.keys(boxes).length]);

  const handleClick = (from: [number, number], to: [number, number]) => {
    if (turn !== "player" || gameOver) return;
    makeMove({ from, to }, "player");
  };

  return (
    <div className="game-container">
      <h1>Dots and Boxes 🤖</h1>
      <div className="scoreboard">
        <span>🧍 Player: {scores.player}</span>
        <span>🤖 AI: {scores.ai}</span>
      </div>
      
      {gameOver && (
        <div className="winner-message">
          {winner === "player" && <h2>🎉 You Win! 🎉</h2>}
          {winner === "ai" && <h2>🤖 AI Wins! 🤖</h2>}
          {winner === "tie" && <h2>🤝 It's a Tie! 🤝</h2>}
          <p>Final Score: Player {scores.player} - {scores.ai} AI</p>
        </div>
      )}

      <div className="grid">
        {Array.from({ length: GRID_SIZE }).map((_, r) => (
          <div key={r} className="row">
            {Array.from({ length: GRID_SIZE }).map((_, c) => (
              <div key={c} className="cell">
                <div className="dot" />
                {c < GRID_SIZE - 1 && (
                  <div
                    className={`h-line ${isLineDrawn({
                      from: [r, c],
                      to: [r, c + 1],
                    }) ? "drawn" : ""} ${isRecent({ from: [r, c], to: [r, c + 1] }) ? "recent" : ""}`}
                    onClick={() => handleClick([r, c], [r, c + 1])}
                  ></div>
                )}
                {r < GRID_SIZE - 1 && (
                  <div
                    className={`v-line ${isLineDrawn({
                      from: [r, c],
                      to: [r + 1, c],
                    }) ? "drawn" : ""} ${isRecent({ from: [r, c], to: [r + 1, c] }) ? "recent" : ""}`}
                    onClick={() => handleClick([r, c], [r + 1, c])}
                  ></div>
                )}
                {r < GRID_SIZE - 1 && c < GRID_SIZE - 1 && (
                  <div
                    className={`box ${boxes[`${r}-${c}`]
                        ? boxes[`${r}-${c}`] === "player"
                          ? "player-box"
                          : "ai-box"
                        : ""
                      }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
