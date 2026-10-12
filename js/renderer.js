(function (BB) {
  'use strict';
  const { CONFIG } = BB;

  function rounded(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function brickIcon(ctx, type, x, y, hp) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#101820'; ctx.fillStyle = '#101820';
    ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (type === 'O') {
      ctx.beginPath(); ctx.arc(0, -1, 4.2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, 5.5); ctx.lineTo(-3.5, 7.5); ctx.moveTo(2, 5.5); ctx.lineTo(3.5, 7.5); ctx.stroke();
    } else if (type === 'X') {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8, r = i % 2 ? 3.1 : 7;
        const px = Math.cos(angle) * r, py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'D') {
      ctx.strokeRect(-6, -4, 12, 9);
      ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(7, -4); ctx.moveTo(0, -4); ctx.lineTo(0, 5);
      ctx.moveTo(0, -4); ctx.bezierCurveTo(-9, -9, -3, -12, 0, -4); ctx.bezierCurveTo(9, -9, 3, -12, 0, -4); ctx.stroke();
    } else if (type === 'H') {
      ctx.fillStyle = '#f1f4f8'; ctx.font = `600 ${CONFIG.visuals.fonts.durability}px ${CONFIG.visuals.fonts.family}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(hp), 0, 0);
      ctx.strokeStyle = '#b6c9da'; ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-14, 3); ctx.moveTo(14, -3); ctx.lineTo(14, 3); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBrick(ctx, brick, offset) {
    const y = brick.y + offset;
    if (y + brick.height < 0 || y > CONFIG.height) return;
    ctx.save();
    rounded(ctx, brick.x, y, brick.width, brick.height, 4); ctx.fillStyle = brick.color; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#ffffff12'; ctx.fillRect(brick.x, y, brick.width, 2);
    ctx.fillStyle = '#00000014'; ctx.fillRect(brick.x, y + brick.height - 3, brick.width, 3);
    if (brick.type === 'S') {
      ctx.strokeStyle = '#303945'; ctx.lineWidth = 2;
      for (let x = brick.x - brick.height; x < brick.x + brick.width; x += 8) {
        ctx.beginPath(); ctx.moveTo(x, y + brick.height); ctx.lineTo(x + brick.height, y); ctx.stroke();
      }
    } else brickIcon(ctx, brick.type, brick.x + brick.width / 2, y + brick.height / 2, brick.hp);
    ctx.restore();
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.resize();
      this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    }
    resize() {
      const scale = Math.min(window.devicePixelRatio || 1, 3);
      this.canvas.width = Math.round(CONFIG.width * scale);
      this.canvas.height = Math.round(CONFIG.height * scale);
      this.ctx.setTransform(this.canvas.width / CONFIG.width, 0, 0, this.canvas.height / CONFIG.height, 0, 0);
    }
    draw(game) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CONFIG.width, CONFIG.height);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
      for (const brick of game.bricks) if (!brick.destroyed) drawBrick(ctx, brick, game.descentOffset);
      for (const particle of game.particles) {
        ctx.globalAlpha = particle.remaining / CONFIG.visuals.particleLifetime;
        ctx.fillStyle = particle.color; ctx.fillRect(particle.x - 1.5, particle.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;
      for (const drop of game.drops) {
        const effect = CONFIG.powerups.effects[drop.type], size = CONFIG.powerups.size;
        rounded(ctx, drop.x - size / 2, drop.y - size / 2, size, size, 5);
        ctx.fillStyle = effect.negative ? '#302021' : '#16242b'; ctx.fill();
        ctx.strokeStyle = effect.negative ? '#d85b59' : '#75b4a2'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = effect.negative ? '#edaca9' : '#c0ded4';
        ctx.font = `${drop.type === 'shrink' ? CONFIG.visuals.fonts.compactPowerup : CONFIG.visuals.fonts.powerup}px ${CONFIG.visuals.fonts.family}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(effect.symbol, drop.x, drop.y);
      }
      ctx.fillStyle = CONFIG.visuals.paddle;
      rounded(ctx, game.paddle.x - game.paddle.width / 2, game.paddle.y, game.paddle.width, game.paddle.height, 5); ctx.fill();
      ctx.fillStyle = '#ffffff2b'; ctx.fillRect(game.paddle.x - 13, game.paddle.y + 3, 26, 2);
      ctx.fillStyle = game.effects.pierce ? '#e8be50' : CONFIG.visuals.ball;
      for (const ball of game.balls) { ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill(); }
      if (game.notice > 0) {
        ctx.globalAlpha = Math.min(1, game.notice * 2);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#a3a9b2'; ctx.font = `${CONFIG.visuals.fonts.levelNotice}px ${CONFIG.visuals.fonts.family}`;
        ctx.fillText(`LEVEL ${String(game.level).padStart(2, '0')}`, CONFIG.width / 2, 27);
        ctx.globalAlpha = 1;
      }
      if (game.state === 'waiting') {
        ctx.fillStyle = '#abb2bd'; ctx.textAlign = 'center'; ctx.font = `${CONFIG.visuals.fonts.waitingTitle}px ${CONFIG.visuals.fonts.family}`;
        ctx.fillText('準備好，開始下一次反彈', CONFIG.width / 2, 505);
        ctx.fillStyle = '#9097a3'; ctx.font = `${CONFIG.visuals.fonts.waitingHint}px ${CONFIG.visuals.fonts.family}`;
        ctx.fillText('方向鍵或觸控拖曳移動 · 按下發球', CONFIG.width / 2, 535);
      }
    }
  }

  Object.assign(BB, { Renderer });
})(globalThis.BlockBreaker);
