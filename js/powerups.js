(function (BB) {
  'use strict';
  const { CONFIG, clamp } = BB;

  function choosePowerup(random = Math.random) {
    const p = CONFIG.powerups;
    const pool = random() < p.positiveChance ? p.positive : p.negative;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  }

  function dropPowerup(game, brick, offset = game.descentOffset) {
    game.drops.push({ type: brick.guaranteedPowerup ?? choosePowerup(game.random), x: brick.x + brick.width / 2, y: brick.y + offset + brick.height / 2 });
  }

  function currentSpeed(game) {
    const kind = game.effects.speed?.type;
    return CONFIG.ball.speed * (kind ? CONFIG.powerups.effects[kind].factor : 1);
  }

  function syncEffects(game) {
    const kind = game.effects.paddle?.type;
    game.paddle.width = CONFIG.paddle.width * (kind ? CONFIG.powerups.effects[kind].factor : 1);
    game.paddle.x = clamp(game.paddle.x, game.paddle.width / 2, CONFIG.width - game.paddle.width / 2);
    const speed = currentSpeed(game);
    for (const ball of game.balls) {
      const length = Math.hypot(ball.vx, ball.vy);
      if (length > 0) { ball.vx *= speed / length; ball.vy *= speed / length; }
    }
  }

  function applyPowerup(game, type) {
    const effect = CONFIG.powerups.effects[type];
    const product = CONFIG.powerups.products[type];
    const lifeFull = type === 'life' && game.lives >= CONFIG.maxLives;
    if (type === 'life') game.lives = Math.min(CONFIG.maxLives, game.lives + 1);
    else game.effects[effect.group] = { type, remaining: effect.duration };
    syncEffects(game);
    const text = product ? `${product.name}｜${lifeFull ? '生命已滿' : product.label}` : `${effect.label}生效`;
    game.pickupNotice = { type, text, remaining: 2.4, serial: ++game.pickupSerial };
    game.message = text;
    if (product) game.chargeEnergy(CONFIG.ultimate.productEnergy);
  }

  function tickEffects(game, dt) {
    if (game.pickupNotice) game.pickupNotice.remaining = Math.max(0, game.pickupNotice.remaining - dt);
    let changed = false;
    for (const [group, effect] of Object.entries(game.effects)) {
      effect.remaining -= dt;
      if (effect.remaining <= 0) { delete game.effects[group]; changed = true; }
    }
    if (changed) syncEffects(game);
  }

  function clearEffects(game) { game.effects = {}; game.pickupNotice = null; syncEffects(game); }

  function dropHitbox(type) {
    return CONFIG.powerups.products[type]?.hitbox || { width: CONFIG.powerups.size, height: CONFIG.powerups.size };
  }

  function updateDrops(game, dt, paddleStartX, paddleEndX) {
    // Solve the interval of vertical overlap, then compare horizontal ranges over
    // that interval. This also catches a fast keyboard sweep under a falling item.
    game.drops = game.drops.filter(drop => {
      const { width, height } = dropHitbox(drop.type);
      const oldY = drop.y;
      drop.y += CONFIG.powerups.fallSpeed * dt;
      const dy = drop.y - oldY;
      const enter = clamp((game.paddle.y - height / 2 - oldY) / dy, 0, 1);
      const exit = clamp((game.paddle.y + game.paddle.height + height / 2 - oldY) / dy, 0, 1);
      const crosses = drop.y + height / 2 >= game.paddle.y && oldY - height / 2 <= game.paddle.y + game.paddle.height;
      const x1 = paddleStartX + (paddleEndX - paddleStartX) * enter;
      const x2 = paddleStartX + (paddleEndX - paddleStartX) * exit;
      const half = (game.paddle.width + width) / 2;
      if (crosses && drop.x >= Math.min(x1, x2) - half && drop.x <= Math.max(x1, x2) + half) {
        applyPowerup(game, drop.type);
        return false;
      }
      return drop.y - height / 2 <= CONFIG.height;
    });
  }

  Object.assign(BB, { choosePowerup, dropPowerup, currentSpeed, syncEffects, applyPowerup, tickEffects, clearEffects, updateDrops, dropHitbox });
})(globalThis.BlockBreaker);
