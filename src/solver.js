// src/solver.js
export const GOAL = [1,2,3,4,5,6,7,8,0];

const dirs = [
  [-1, 0], [1, 0], [0, -1], [0, 1] // up, down, left, right
];

function manhattan(board) {
  let dist = 0;
  for (let i = 0; i < 9; i++) {
    const v = board[i];
    if (v === 0) continue;
    const gi = GOAL.indexOf(v);
    dist += Math.abs(Math.floor(i/3) - Math.floor(gi/3)) +
            Math.abs((i%3) - (gi%3));
  }
  return dist;
}

function neighbors(board) {
  const res = [];
  const z = board.indexOf(0);
  const r = Math.floor(z / 3), c = z % 3;

  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
    const ni = nr * 3 + nc;
    const next = [...board];
    [next[z], next[ni]] = [next[ni], next[z]];
    res.push(next);
  }
  return res;
}

export function astar(start, maxNodes = 20000) {
  const startKey = start.join(",");
  const goalKey = GOAL.join(",");

  const open = new Map(); // key -> { board, g, f, parent }
  const pq = []; // simple priority queue array (ok for 8-puzzle scale)

  const h0 = manhattan(start);
  const node0 = { board: start, g: 0, f: h0, parent: null };
  open.set(startKey, node0);
  pq.push(node0);

  const closed = new Set();
  let expanded = 0;

  while (pq.length && expanded < maxNodes) {
    // pop min f
    pq.sort((a, b) => a.f - b.f);
    const cur = pq.shift();
    const key = cur.board.join(",");

    if (key === goalKey) {
      // reconstruct path
      const path = [];
      let n = cur;
      while (n) {
        path.push(n.board);
        n = n.parent;
      }
      return { path: path.reverse(), expanded };
    }

    closed.add(key);
    expanded++;

    for (const nb of neighbors(cur.board)) {
      const nbKey = nb.join(",");
      if (closed.has(nbKey)) continue;

      const g = cur.g + 1;
      const h = manhattan(nb);
      const f = g + h;

      const existing = open.get(nbKey);
      if (!existing || g < existing.g) {
        const node = { board: nb, g, f, parent: cur };
        open.set(nbKey, node);
        pq.push(node);
      }
    }
  }

  return null; // not found within limit
}