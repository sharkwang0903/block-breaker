(function (BB) {
  'use strict';
  const { CONFIG, clamp, createBricks, initialDescentOffset, LEVELS, circleOverlapsRect, updatePhysics, isLevelClear, clearEffects, currentSpeed, tickEffects, updateDrops } = BB;

  class Game {
    constructor({ random = Math.random } = {}) {
      this.random = random;
      this.state = 'home';
      this.balls = []; this.bricks = []; this.drops = []; this.effects = {}; this.particles = [];
      this.message = ''; this.runId = 0;
      this.pickupSerial = 0; this.pickupNotice = null;
      this.energy = 0; this.ultimate = null; this.ultimateBolts = []; this.ultimateSerial = 0;
    }

    start(mode) {
      this.runId++;
      this.mode = mode; this.level = 1; this.score = 0; this.destroyedCount = 0;
      this.lives = CONFIG.initialLives;
      this.paddle = { x: CONFIG.width / 2, y: CONFIG.paddle.y, width: CONFIG.paddle.width, height: CONFIG.paddle.height };
      this.balls = []; this.drops = []; this.effects = {}; this.particles = [];
      this.nextBallId = 1; this.hiddenSerial = 0; this.message = '';
      this.pickupSerial = 0; this.pickupNotice = null;
      this.energy = 0; this.ultimate = null; this.ultimateBolts = []; this.ultimateSerial = 0;
      this.bricks = createBricks(1); this.descentOffset = 0;
      this.notice = CONFIG.visuals.levelNoticeDuration;
      this.state = 'waiting'; this.makeWaitingBall();
    }

    makeBall(x, y, vx, vy) {
      const ball = { id: this.nextBallId++, x, y, vx, vy, radius: CONFIG.ball.radius, ignored: new Set(), contacts: new Set() };
      this.balls.push(ball);
      return ball;
    }

    chargeEnergy(amount) { BB.chargeEnergy(this, amount); }
    castUltimate() { return BB.castUltimate(this); }

    makeWaitingBall() {
      this.makeBall(this.paddle.x, this.paddle.y - CONFIG.ball.radius - 3, 0, 0);
      this.markSpawnOverlaps(this.descentOffset);
    }

    launch() {
      if (this.state !== 'waiting') return;
      const speed = currentSpeed(this);
      for (const ball of this.balls) {
        ball.vx = Math.sin(CONFIG.ball.launchAngle) * speed;
        ball.vy = -Math.cos(CONFIG.ball.launchAngle) * speed;
      }
      this.state = 'playing'; this.message = '已發球';
    }

    releaseHiddenBall(brick, offset) {
      const speed = currentSpeed(this);
      const sign = this.hiddenSerial++ % 2 === 0 ? 1 : -1;
      const angle = CONFIG.ball.hiddenAngle * sign;
      const ball = this.makeBall(brick.x + brick.width / 2 + sign * CONFIG.ball.radius,
        brick.y + offset + brick.height / 2, Math.sin(angle) * speed, Math.cos(angle) * speed);
      this.markSpawnOverlaps(offset, [ball]);
    }

    markSpawnOverlaps(offset, balls = this.balls) {
      for (const ball of balls) for (const brick of this.bricks) {
        if (!brick.destroyed && circleOverlapsRect(ball, { ...brick, y: brick.y + offset })) ball.ignored.add(brick.id);
      }
    }

    addFragments(brick, offset) {
      const v = CONFIG.visuals;
      // Only decorative particles are bounded; ball simulation never is.
      for (let i = 0; i < v.particleCount && this.particles.length < v.maxParticles; i++) {
        const angle = (i + 0.5) * Math.PI * 2 / v.particleCount;
        this.particles.push({ x: brick.x + brick.width / 2, y: brick.y + offset + brick.height / 2,
          vx: Math.cos(angle) * v.particleSpeed, vy: Math.sin(angle) * v.particleSpeed,
          color: brick.color, remaining: v.particleLifetime });
      }
    }

    pause() {
      if (this.state !== 'playing' && this.state !== 'waiting') return;
      this.resumeState = this.state; this.state = 'paused';
    }
    resume() { if (this.state === 'paused') this.state = this.resumeState; }
    home() { BB.endUltimate(this); this.state = 'home'; }

    advanceLevel() {
      BB.endUltimate(this);
      if (this.mode === 'normal' && this.level === LEVELS.length) { this.finish(true); return; }
      this.level++;
      this.bricks = createBricks(this.level); // Removes every old obstacle.
      this.descentOffset = initialDescentOffset();
      for (const ball of this.balls) { ball.contacts.clear(); ball.ignored.clear(); }
      this.markSpawnOverlaps(this.descentOffset);
      this.notice = CONFIG.visuals.levelNoticeDuration;
      this.message = `第 ${this.level} 關`;
    }

    finish(won) { BB.endUltimate(this); this.won = won; this.state = 'result'; this.message = won ? '通關成功' : '挑戰結束'; }

    step(dt, input = {}) {
      if (this.state !== 'playing' && this.state !== 'waiting') return;
      const wasPlaying = this.state === 'playing';
      if (wasPlaying) tickEffects(this, dt);
      const startX = this.paddle.x;
      const wantedX = input.targetX ?? (startX + (input.axis || 0) * CONFIG.paddle.speed * dt);
      this.paddle.x = clamp(wantedX, this.paddle.width / 2, CONFIG.width - this.paddle.width / 2);

      // Split at the exact instant descent ends. Both substeps have a constant
      // surface velocity, rather than averaging the motion over a full frame.
      const descentSpeed = -initialDescentOffset() / CONFIG.bricks.descentDuration;
      const movingTime = this.descentOffset < 0 ? Math.min(dt, -this.descentOffset / descentSpeed) : 0;
      const oldOffset = this.descentOffset;
      if (wasPlaying) {
        if (movingTime > CONFIG.physics.epsilon) {
          const middleX = startX + (this.paddle.x - startX) * movingTime / dt;
          updatePhysics(this, movingTime, startX, middleX, oldOffset, descentSpeed);
          this.descentOffset = Math.min(0, oldOffset + descentSpeed * movingTime);
          if (dt - movingTime > CONFIG.physics.epsilon) updatePhysics(this, dt - movingTime, middleX, this.paddle.x, 0, 0);
        } else updatePhysics(this, dt, startX, this.paddle.x, 0, 0);
        updateDrops(this, dt, startX, this.paddle.x);
      }
      this.descentOffset = Math.min(0, oldOffset + descentSpeed * movingTime);
      if (wasPlaying) BB.tickUltimate(this, dt);
      if (!wasPlaying) for (const ball of this.balls) { ball.x = this.paddle.x; ball.y = this.paddle.y - ball.radius - 3; }

      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.remaining -= dt; }
      this.particles = this.particles.filter(p => p.remaining > 0);
      this.notice = Math.max(0, this.notice - dt);

      // Collision → full chain / spawns / scoring → clear → life. A transition
      // never creates a ball. A same-step clear + loss still deducts one life.
      if (isLevelClear(this)) this.advanceLevel();
      if (this.state === 'result') return;
      if (this.balls.length === 0) {
        this.lives--;
        clearEffects(this);
        if (this.lives <= 0) { this.finish(false); return; }
        this.state = 'waiting';
        this.makeWaitingBall();
        this.message = '失去一條生命，準備重新發球';
      }
    }
  }

  Object.assign(BB, { Game });
})(globalThis.BlockBreaker);
