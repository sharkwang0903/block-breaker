(function (BB) {
  'use strict';
  const { CONFIG, clamp } = BB;

  class Input {
    constructor(canvas, game, { launch, pause }) {
      this.keys = new Set(); this.pointerId = null; this.targetX = null; this.dragOffset = 0;
      this.canvas = canvas; this.game = game;
      window.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Space', 'Escape'].includes(event.code)) return;
        if (game.state === 'home' || game.state === 'result') return;
        // Leave keyboard activation of dialog buttons to the browser.
        if (event.code === 'Space' && game.state === 'paused') return;
        if ((event.code === 'ArrowLeft' || event.code === 'ArrowRight') && game.state === 'paused') return;
        event.preventDefault();
        if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
          this.targetX = null; this.keys.add(event.code);
        }
        if (!event.repeat && event.code === 'Space') launch();
        if (!event.repeat && event.code === 'Escape') pause();
      });
      window.addEventListener('keyup', event => this.keys.delete(event.code));
      window.addEventListener('blur', () => { this.clear(); if (game.state === 'playing' || game.state === 'waiting') pause(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clear(); if (game.state === 'playing' || game.state === 'waiting') pause(); } });
      canvas.addEventListener('pointerdown', event => {
        if (!['playing', 'waiting'].includes(game.state) || this.pointerId !== null) return;
        event.preventDefault(); this.pointerId = event.pointerId;
        canvas.setPointerCapture(event.pointerId);
        // Relative dragging avoids covering the paddle with the player's finger.
        this.dragOffset = this.logicalX(event.clientX) - game.paddle.x;
        this.targetX = game.paddle.x; this.keys.clear();
      });
      canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== this.pointerId) return;
        event.preventDefault(); this.targetX = clamp(this.logicalX(event.clientX) - this.dragOffset, 0, CONFIG.width);
      });
      const release = event => { if (event.pointerId === this.pointerId) { this.pointerId = null; this.targetX = null; } };
      canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
    }
    logicalX(clientX) { const bounds = this.canvas.getBoundingClientRect(); return (clientX - bounds.left) / bounds.width * CONFIG.width; }
    sample() { return { axis: Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft')), targetX: this.targetX }; }
    clear() { this.keys.clear(); this.targetX = null; this.pointerId = null; }
  }

  Object.assign(BB, { Input });
})(globalThis.BlockBreaker);
