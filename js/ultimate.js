(function (BB) {
  'use strict';
  const { CONFIG, clamp, damageBrick } = BB;

  function chargeEnergy(game, amount) {
    if (game.state !== 'playing') return;
    const before = game.energy;
    game.energy = clamp(game.energy + amount, 0, CONFIG.ultimate.energyMax);
    if (before < CONFIG.ultimate.energyMax && game.energy === CONFIG.ultimate.energyMax) {
      game.message = game.ultimate ? '能量已滿，大招結束後可再次施放' : '水母能量已滿，按空白鍵發動水母電擊';
    }
  }

  function endUltimate(game) { game.ultimate = null; game.ultimateBolts = []; }

  function castUltimate(game) {
    if (game.state !== 'playing' || game.ultimate || game.energy < CONFIG.ultimate.energyMax ||
        !game.bricks.some(brick => !brick.destroyed && brick.type !== 'S')) return false;
    game.energy = 0;
    game.ultimateSerial++;
    game.ultimate = { remaining: CONFIG.ultimate.duration, nextStrike: CONFIG.ultimate.firstStrikeDelay,
      budget: { remaining: CONFIG.ultimate.maxBricks, destroyed: 0 } };
    game.ultimateBolts = [];
    game.message = 'Pink 發動水母電擊！';
    return true;
  }

  function tickUltimate(game, dt) {
    game.ultimateBolts = game.ultimateBolts.filter(bolt => (bolt.remaining -= dt) > 0);
    const cast = game.ultimate;
    if (!cast) return;
    const activeTime = Math.min(dt, cast.remaining);
    cast.nextStrike -= activeTime;
    while (cast.nextStrike <= CONFIG.physics.epsilon) {
      if (cast.budget.remaining <= 0) break;
      const targets = game.bricks.filter(brick => !brick.destroyed && brick.type !== 'S' &&
        brick.y + game.descentOffset + brick.height > 0 && brick.y + game.descentOffset < CONFIG.height);
      if (targets.length) {
        const target = targets[Math.min(targets.length - 1, Math.floor(game.random() * targets.length))];
        game.ultimateBolts.push({ x: target.x + target.width / 2, y: target.y + game.descentOffset + target.height / 2,
          remaining: CONFIG.ultimate.boltLifetime });
        damageBrick(game, target, game.descentOffset, cast.budget);
      }
      cast.nextStrike += CONFIG.ultimate.strikeInterval;
    }
    cast.remaining = Math.max(0, cast.remaining - activeTime);
    if (cast.remaining <= CONFIG.physics.epsilon) game.ultimate = null;
  }

  Object.assign(BB, { chargeEnergy, castUltimate, tickUltimate, endUltimate });
})(globalThis.BlockBreaker);
