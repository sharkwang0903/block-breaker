(function (BB) {
  'use strict';
  const { CONFIG, dropPowerup } = BB;

  // Complete the whole damage queue before the engine considers a level clear.
  // Mark a destroyed brick before enqueueing neighbors, so cyclic explosions
  // cannot score twice or spawn duplicate balls / items.
  function damageBrick(game, target, offset = game.descentOffset, budget = null) {
    const queue = [target];
    const cells = new Map(game.bricks.map(brick => [`${brick.row}:${brick.col}`, brick]));
    for (let i = 0; i < queue.length; i++) {
      if (budget && budget.remaining <= 0) break;
      const brick = queue[i];
      if (!brick || brick.destroyed || brick.type === 'S') continue;
      if (budget && brick === target) brick.hp = 0; // Direct lightning also defeats reinforced bricks.
      else brick.hp--;
      if (brick.hp > 0) continue;
      brick.destroyed = true;
      if (budget) { budget.remaining--; budget.destroyed++; }
      game.score += CONFIG.pointsPerBrick;
      game.destroyedCount++;
      game.addFragments(brick, offset);
      if (brick.type === 'O') game.releaseHiddenBall(brick, offset);
      if (brick.type === 'D') dropPowerup(game, brick, offset);
      if (brick.type === 'X') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (dr || dc) queue.push(cells.get(`${brick.row + dr}:${brick.col + dc}`));
        }
      }
    }
  }

  function isLevelClear(game) { return game.bricks.every(b => b.type === 'S' || b.destroyed); }

  Object.assign(BB, { damageBrick, isLevelClear });
})(globalThis.BlockBreaker);
