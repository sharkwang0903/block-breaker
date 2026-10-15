(function (BB) {
  'use strict';
  const POSES = {
    idle: 'assets/pink/pink-idle.png',
    cheer: 'assets/pink/pink-cheer.png',
    oops: 'assets/pink/pink-oops.png',
    cast: 'assets/pink/pink-cast.png',
  };

  // Reads game progress for presentation only; never changes the simulation.
  class Companion {
    constructor(root = document.getElementById('companion')) {
      this.root = root;
      this.image = root.querySelector('.companion-image');
      this.message = root.querySelector('.companion-message');
      this.mood = null;
      this.until = 0;
      this.previous = null;
      this.cheeredAt = 0;
      this.preloads = Object.values(POSES).map(src => { const image = new Image(); image.src = src; return image; });
      this.image.addEventListener('error', () => {
        const fallback = 'assets/pink/pink-wave.png';
        if (this.image.getAttribute('src') !== fallback) this.image.src = fallback;
      });
    }

    react(mood, text, duration = 0, now = performance.now()) {
      if (this.mood !== mood) {
        this.mood = mood;
        this.root.dataset.mood = mood;
        this.image.src = POSES[mood];
      }
      if (this.message.textContent !== text) this.message.textContent = text;
      this.until = duration ? now + duration : 0;
    }

    update(game, now = performance.now()) {
      const snapshot = {
        runId: game.runId, state: game.state, level: game.level,
        lives: game.lives, destroyed: game.destroyedCount,
        pickupSerial: game.pickupSerial,
      };
      const previous = this.previous;
      this.previous = snapshot;
      this.root.dataset.paused = String(game.state === 'paused');
      if (game.state === 'home') { this.previous = null; return; }
      if (!previous || previous.runId !== game.runId) {
        this.cheeredAt = game.destroyedCount;
        this.react('idle', '準備好了嗎？一起加油！');
        return;
      }
      if (game.state === 'paused') {
        this.react('idle', '休息一下，我在這裡等你。');
        return;
      }
      if (game.state === 'result') {
        this.react(game.won ? 'cheer' : 'oops', game.won ? '全部過關！你太棒了！' : '辛苦了！下次再一起挑戰。');
        return;
      }
      if (game.ultimate) {
        this.root.dataset.paused = String(game.state === 'waiting');
        this.react('cast', game.state === 'waiting' ? '先發球，電擊會繼續！' : '水母電擊！一起突破！');
        return;
      }
      if (game.lives < previous.lives) {
        this.cheeredAt = game.destroyedCount;
        this.react('oops', '沒關係，再接再厲！', 2200, now);
      } else if (game.level > previous.level) {
        this.cheeredAt = game.destroyedCount;
        this.react('cheer', '過關了！繼續一起向前！', 2600, now);
      } else if (game.pickupSerial !== previous.pickupSerial && BB.CONFIG.powerups.products[game.pickupNotice?.type]) {
        this.react('cheer', `接到 ${BB.CONFIG.powerups.products[game.pickupNotice.type].name}，太棒了！`, 2000, now);
      } else if (this.until && now < this.until) {
        return;
      } else if (game.energy >= BB.CONFIG.ultimate.energyMax) {
        this.react('cheer', game.state === 'waiting' ? '能量滿了！發球後就能幫忙！' : '準備好了！按空白鍵召喚電擊！');
      } else if (game.destroyedCount - this.cheeredAt >= 4) {
        this.cheeredAt = game.destroyedCount;
        this.react('cheer', '打得漂亮！繼續加油！', 1600, now);
      } else {
        this.react('idle', game.state === 'waiting' ? '準備好了就發球吧！' : '接住這一球，我幫你加油！');
      }
    }
  }

  Object.assign(BB, { Companion });
})(globalThis.BlockBreaker);
