(function (BB) {
  'use strict';
  const { CONFIG } = BB;

  const LEVELS = [
    { name: '初次爆破', rows: ['........', '........', '..DBBD..', '.DBXXBD.', '..DOBD..', '...BB...', '........'] },
    { name: '連鎖狂歡', rows: ['........', '.DBBBBD.', 'BBXBBXBB', 'BDBBBBDB', 'BBXBBXBB', '.BDOBDB.', '........'] },
    { name: '解放小球', rows: ['........', '.DBBBBD.', 'BOBBBOBB', 'BBDBBDBB', 'BBXBBXBB', '.DBOBBD.', '........'] },
    { name: '堅固防線', rows: ['..HHHH..', '.DBBBBD.', 'DBXBBXBD', 'BBBBBBBB', 'BDBOBBDB', '........', '........'] },
    { name: '道具驚喜', rows: ['........', '.DBHHBD.', 'BBDBBDBB', 'BBBBBBBB', 'DBXBBXBD', '.BBOBBB.', '........'] },
    { name: '鋼鐵障礙', rows: ['........', 'DBSSSSBD', 'BBDBBDBB', 'BBXBBXBB', 'BDBOBBDB', '........', '........'] },
    { name: '爆破迷宮', rows: ['HHHHHHHH', 'DBSSSSBD', 'BDXBBXDB', 'SBDBBDBS', 'BBBOBBBB', '........', '........'] },
    { name: '多球派對', rows: ['.DBBBBD.', 'BOBBBOBB', 'DBXBBXBD', 'BDBBBDBB', 'BOBBBOBB', 'BBBBBBBB', '........'] },
    { name: '最後防線', rows: ['HHHHHHHH', 'DBSSSSBD', 'BBHBBHBB', 'BSXDDXSB', 'BBDBBDBB', 'BBBOBBBB', '........'] },
    { name: '最終挑戰', rows: ['HHHHHHHH', 'DBXSSXBD', 'BDHBBHDB', 'SBOBBOBS', 'BBXBBXBB', 'BDBBBDBB', 'HHBBBBHH'] },
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
    // Each template has six D bricks. Spread one guaranteed drop of each
    // product through the layout; the other two keep the usual random pool.
    const itemBricks = bricks.filter(brick => brick.type === 'D');
    const products = CONFIG.powerups.positive;
    for (let index = 0; index < products.length; index++) {
      const slot = Math.round(index * (itemBricks.length - 1) / (products.length - 1));
      itemBricks[slot].guaranteedPowerup = products[(index + level - 1) % products.length];
    }
    return bricks;
  }

  function initialDescentOffset() {
    const b = CONFIG.bricks;
    return -(b.top + (b.rows - 1) * (b.height + b.gapY) + b.height + b.spawnGap);
  }

  Object.assign(BB, { LEVELS, templateFor, createBricks, initialDescentOffset });
})(globalThis.BlockBreaker);
