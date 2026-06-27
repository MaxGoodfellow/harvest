// PF2e level-based DC table — CLAUDE.md §8.1
const DC_BY_LEVEL = [
  [-1, 13], [0, 14], [1, 15], [2, 16], [3, 18], [4, 19], [5, 20], [6, 22],
  [7, 23], [8, 24], [9, 26], [10, 27], [11, 28], [12, 30], [13, 31], [14, 32],
  [15, 34], [16, 35], [17, 36], [18, 38], [19, 39], [20, 40],
];

async function seed(conn) {
  for (const [level, dc] of DC_BY_LEVEL) {
    await conn.query(
      'INSERT INTO dc_by_level (level, dc) VALUES (?, ?) ON DUPLICATE KEY UPDATE dc = ?',
      [level, dc, dc]
    );
  }
}

module.exports = seed;
