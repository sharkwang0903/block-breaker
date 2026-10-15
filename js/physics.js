(function (BB) {
  'use strict';
  const { CONFIG, clamp, damageBrick } = BB;

  const EPS = CONFIG.physics.epsilon;

  function circleOverlapsRect(ball, rect, padding = 0) {
    const x = clamp(ball.x, rect.x, rect.x + rect.width);
    const y = clamp(ball.y, rect.y, rect.y + rect.height);
    return (ball.x - x) ** 2 + (ball.y - y) ** 2 <= (ball.radius + padding) ** 2;
  }

  // Exact continuous circle/AABB collision: four offset faces and four circular
  // corners. An expanded square alone would cause false hits near brick corners.
  // vx / vy are relative to the surface, and time is measured in seconds.
  function sweepCircleRect(ball, rect, vx, vy, maxTime) {
    let best = null;
    const take = (time, nx, ny) => {
      if (time < -EPS || time > maxTime + EPS || vx * nx + vy * ny >= -EPS) return;
      time = Math.max(0, Math.min(maxTime, time));
      if (!best || time < best.time) best = { time, nx, ny };
    };
    const left = rect.x, right = left + rect.width, top = rect.y, bottom = top + rect.height;
    const r = ball.radius;
    const closestX = clamp(ball.x, left, right), closestY = clamp(ball.y, top, bottom);
    const dx = ball.x - closestX, dy = ball.y - closestY;
    const dist = Math.hypot(dx, dy);
    if (dist > EPS && dist < r - EPS) take(0, dx / dist, dy / dist);
    else if (dist <= EPS) {
      const sides = [{ d: ball.x - left, nx: -1, ny: 0 }, { d: right - ball.x, nx: 1, ny: 0 },
        { d: ball.y - top, nx: 0, ny: -1 }, { d: bottom - ball.y, nx: 0, ny: 1 }];
      sides.sort((a, b) => a.d - b.d);
      take(0, sides[0].nx, sides[0].ny);
    }
    if (vx > EPS) {
      const t = (left - r - ball.x) / vx, y = ball.y + vy * t;
      if (y >= top - EPS && y <= bottom + EPS) take(t, -1, 0);
    } else if (vx < -EPS) {
      const t = (right + r - ball.x) / vx, y = ball.y + vy * t;
      if (y >= top - EPS && y <= bottom + EPS) take(t, 1, 0);
    }
    if (vy > EPS) {
      const t = (top - r - ball.y) / vy, x = ball.x + vx * t;
      if (x >= left - EPS && x <= right + EPS) take(t, 0, -1);
    } else if (vy < -EPS) {
      const t = (bottom + r - ball.y) / vy, x = ball.x + vx * t;
      if (x >= left - EPS && x <= right + EPS) take(t, 0, 1);
    }
    const a = vx * vx + vy * vy;
    if (a > EPS) {
      for (const [cx, cy, sx, sy] of [[left, top, -1, -1], [right, top, 1, -1], [left, bottom, -1, 1], [right, bottom, 1, 1]]) {
        const ox = ball.x - cx, oy = ball.y - cy;
        const b = 2 * (ox * vx + oy * vy), c = ox * ox + oy * oy - r * r;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) continue;
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        const x = ball.x + vx * t - cx, y = ball.y + vy * t - cy;
        if (x * sx >= -EPS && y * sy >= -EPS) {
          const length = Math.hypot(x, y);
          if (length > EPS) take(t, x / length, y / length);
        }
      }
    }
    return best;
  }

  function reflectAtSurface(ball, nx, ny, surfaceVX = 0, surfaceVY = 0) {
    const speed = Math.hypot(ball.vx, ball.vy);
    const rx = ball.vx - surfaceVX, ry = ball.vy - surfaceVY;
    const dot = rx * nx + ry * ny;
    let vx = rx - 2 * dot * nx + surfaceVX;
    let vy = ry - 2 * dot * ny + surfaceVY;
    const length = Math.hypot(vx, vy);
    if (length <= EPS) { vx = nx * speed; vy = ny * speed; }
    else { vx *= speed / length; vy *= speed / length; }
    // All balls preserve their effect-controlled speed even on a moving brick.
    // Keep a small vertical component to avoid a permanent horizontal orbit.
    if (Math.abs(vy) < speed * CONFIG.ball.minVerticalRatio) {
      vy = (vy < 0 ? -1 : 1) * speed * CONFIG.ball.minVerticalRatio;
      vx = (vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, speed * speed - vy * vy));
    }
    ball.vx = vx; ball.vy = vy;
  }

  function nextCollision(game, ball, horizon, elapsed, offsetStart, descentVelocity, paddleStart, paddleVelocity) {
    let best = null;
    const take = event => {
      if (!event || event.time < -EPS || event.time > horizon + EPS) return;
      if (!best || event.time < best.time - EPS) best = { ...event, time: Math.max(0, Math.min(horizon, event.time)), ball };
    };
    if (ball.vx < -EPS) take({ time: (ball.radius - ball.x) / ball.vx, kind: 'wall', nx: 1, ny: 0 });
    if (ball.vx > EPS) take({ time: (CONFIG.width - ball.radius - ball.x) / ball.vx, kind: 'wall', nx: -1, ny: 0 });
    if (ball.vy < -EPS) take({ time: (ball.radius - ball.y) / ball.vy, kind: 'wall', nx: 0, ny: 1 });
    if (ball.vy > EPS) take({ time: (CONFIG.height + ball.radius - ball.y) / ball.vy, kind: 'lost' });

    const paddleX = paddleStart + paddleVelocity * elapsed;
    const paddle = { x: paddleX - game.paddle.width / 2, y: game.paddle.y, width: game.paddle.width, height: game.paddle.height };
    if (ball.vy > 0 && ball.y <= paddle.y + EPS) {
      const hit = sweepCircleRect(ball, paddle, ball.vx - paddleVelocity, ball.vy, horizon);
      if (hit && hit.ny < 0) take({ ...hit, kind: 'paddle' });
    }
    const offset = offsetStart + descentVelocity * elapsed;
    for (const brick of game.bricks) {
      if (brick.destroyed) continue;
      const rect = { x: brick.x, y: brick.y + offset, width: brick.width, height: brick.height };
      if (ball.ignored.has(brick.id) || ball.contacts.has(brick.id)) {
        if (circleOverlapsRect(ball, rect, CONFIG.physics.separation)) continue;
        ball.ignored.delete(brick.id); ball.contacts.delete(brick.id);
      }
      const endX = ball.x + ball.vx * horizon, endY = ball.y + (ball.vy - descentVelocity) * horizon;
      if (Math.max(ball.x, endX) + ball.radius < rect.x || Math.min(ball.x, endX) - ball.radius > rect.x + rect.width ||
          Math.max(ball.y, endY) + ball.radius < rect.y || Math.min(ball.y, endY) - ball.radius > rect.y + rect.height) continue;
      const hit = sweepCircleRect(ball, rect, ball.vx, ball.vy - descentVelocity, horizon);
      if (hit) take({ ...hit, kind: 'brick', brick });
    }
    return best;
  }

  // Resolve events chronologically across all balls. A hidden ball joins the
  // remaining time slice immediately. There is deliberately no ball-count cap.
  function updatePhysics(game, dt, paddleStart, paddleEnd, offsetStart, descentVelocity = 0) {
    let elapsed = 0;
    const paddleVelocity = (paddleEnd - paddleStart) / dt;
    while (elapsed < dt - EPS) {
      const remaining = dt - elapsed;
      let next = null;
      for (const ball of game.balls) {
        const hit = nextCollision(game, ball, remaining, elapsed, offsetStart, descentVelocity, paddleStart, paddleVelocity);
        if (hit && (!next || hit.time < next.time - EPS)) next = hit;
      }
      const advance = next ? next.time : remaining;
      for (const ball of game.balls) { ball.x += ball.vx * advance; ball.y += ball.vy * advance; }
      elapsed += advance;
      if (!next) break;
      const ball = next.ball;
      if (next.kind === 'lost') {
        game.balls = game.balls.filter(b => b !== ball);
        continue;
      }
      if (next.kind === 'paddle') {
        game.chargeEnergy(CONFIG.ultimate.paddleEnergy);
        const center = paddleStart + paddleVelocity * elapsed;
        const relative = clamp((ball.x - center) / (game.paddle.width / 2), -1, 1);
        const angle = relative * CONFIG.paddle.maxAngle;
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.sin(angle) * speed; ball.vy = -Math.cos(angle) * speed;
        ball.y = game.paddle.y - ball.radius - CONFIG.physics.separation;
      } else {
        if (next.kind === 'brick') {
          ball.contacts.add(next.brick.id);
          const offset = offsetStart + descentVelocity * elapsed;
          damageBrick(game, next.brick, offset);
          if (next.brick.type !== 'S' && game.effects.pierce) continue;
        }
        reflectAtSurface(ball, next.nx, next.ny, 0, next.kind === 'brick' ? descentVelocity : 0);
        ball.x += next.nx * CONFIG.physics.separation;
        ball.y += next.ny * CONFIG.physics.separation;
      }
    }
  }

  Object.assign(BB, { circleOverlapsRect, sweepCircleRect, reflectAtSurface, updatePhysics });
})(globalThis.BlockBreaker);
