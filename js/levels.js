(function (BB) {
  'use strict';
  const { CONFIG } = BB;

  const LEVELS = [
    { name: '初次爆破', rows: ['........', '........', '..BBBB..', '.BBXXBB.', '..BOBB..', '...BB...', '........'] },
    { name: '連鎖狂歡', rows: ['........', '.BBBBBB.', 'BBXBBXBB', 'BBBBBBBB', 'BBXBBXBB', '.BBOBBB.', '........'] },
    { name: '解放小球', rows: ['........', '.BBBBBB.', 'BOBBBOBB', 'BBBBBBBB', 'BBXBBXBB', '.BBOBBB.', '........'] },
    { name: '堅固防線', rows: ['..HHHH..', '.BBBBBB.', 'BBXBBXBB', 'BBBBBBBB', 'BBBOBBBB', '........', '........'] },
    { name: '道具驚喜', rows: ['........', '.BBHHBB.', 'BBDBBDBB', 'BBBBBBBB', 'BBXBBXBB', '.BBOBBB.', '........'] },
    { name: '鋼鐵障礙', rows: ['........', 'BBSSSSBB', 'BBBBBBBB', 'BBXBBXBB', 'BBBOBBBB', '........', '........'] },
    { name: '爆破迷宮', rows: ['HHHHHHHH', 'BBSSSSBB', 'BBXBBXBB', 'SBBBBBBS', 'BBBOBBBB', '........', '........'] },
    { name: '多球派對', rows: ['.BBBBBB.', 'BOBBBOBB', 'BBXBBXBB', 'BDBBBDBB', 'BOBBBOBB', 'BBBBBBBB', '........'] },
    { name: '最後防線', rows: ['HHHHHHHH', 'BBSSSSBB', 'BBHBBHBB', 'BSXBBXSB', 'BBDBBDBB', 'BBBOBBBB', '........'] },
    { name: '最終挑戰', rows: ['HHHHHHHH', 'BBXSSXBB', 'BBHBBHBB', 'SBOBBOBS', 'BBXBBXBB', 'BDBBBDBB', 'HHBBBBHH'] },
  ];

  function templateFor(level) { return LEVELS[(level - 1) % LEVELS.length]; }

  function createBricks(level) {
    const layout = CONFIG.bricks;
    const bricks = [];
    templateFor(level).rows.forEach((row, r) => [...row].forEach((type, c) => {
      if (type === '.') return;
      bricks.push({
        id: `${level}:${r}:${c}`, row: r, col: c, type,
        x: layout.left + c * (layout.width + layout.gapX),
        y: layout.top + r * (layout.height + layout.gapY),
        width: layout.width, height: layout.height,
        hp: type === 'S' ? Infinity : type === 'H' ? 2 : 1, destroyed: false,
        color: type === 'S' ? CONFIG.visuals.obstacle : type === 'H' ? CONFIG.visuals.reinforced : CONFIG.visuals.colors[(r + c) % 4],
      });
    }));
    return bricks;
  }

  function initialDescentOffset() {
    const b = CONFIG.bricks;
    return -(b.top + (b.rows - 1) * (b.height + b.gapY) + b.height + b.spawnGap);
  }

  Object.assign(BB, { LEVELS, templateFor, createBricks, initialDescentOffset });
})(globalThis.BlockBreaker);
