(function (BB) {
  'use strict';

  // All adjustable game values live here. Distances use the 480 × 640 logical canvas.
  const CONFIG = Object.freeze({
    width: 480, height: 640,
    fixedStep: 1 / 120, maxFrameDelta: 0.1,
    initialLives: 3, maxLives: 5, pointsPerBrick: 50,
    ball: { radius: 9, speed: 310, launchAngle: -0.22, hiddenAngle: 0.42, minVerticalRatio: 0.18 },
    paddle: { width: 100, height: 11, y: 598, speed: 520, maxAngle: Math.PI / 3 },
    bricks: { columns: 8, rows: 7, left: 20, top: 62, width: 50, height: 22, gapX: 6, gapY: 7, descentDuration: 0.7, spawnGap: 14 },
    physics: { epsilon: 0.00001, separation: 0.04 },
    ultimate: { energyMax: 25, paddleEnergy: 1, productEnergy: 5, duration: 3, maxBricks: 10, strikeInterval: .3, firstStrikeDelay: .1, boltLifetime: .24 },
    powerups: {
      positiveChance: 0.8, fallSpeed: 125, size: 22,
      productSize: 64,
      // PNGs use square transparent frames. Pickup bounds follow each package,
      // rather than treating the transparent margins as part of the item.
      products: {
        extend: { name: 'BF01+1', image: 'assets/products/bf01-plus1-sample-v1.png', label: '球拍加長', hitbox: { width: 46, height: 60 } },
        slow: { name: 'PPA', image: 'assets/products/ppa-sample-v1.png', label: '球速減慢', hitbox: { width: 25, height: 60 } },
        pierce: { name: 'QCC', image: 'assets/products/qcc-sample-v1.png', label: '穿透啟動', hitbox: { width: 33, height: 58 } },
        life: { name: 'SIRT+10', image: 'assets/products/sirt-plus10-sample-v1.png', label: '生命＋1', hitbox: { width: 33, height: 58 } },
      },
      positive: ['extend', 'slow', 'pierce', 'life'], negative: ['shrink', 'fast'],
      effects: {
        extend: { duration: 10, factor: 1.5, group: 'paddle', label: '延長', symbol: '↔' },
        shrink: { duration: 8, factor: 0.7, group: 'paddle', label: '縮短', symbol: '↦↤', negative: true },
        slow: { duration: 8, factor: 0.7, group: 'speed', label: '減速', symbol: '−' },
        fast: { duration: 6, factor: 1.25, group: 'speed', label: '加速', symbol: '+', negative: true },
        pierce: { duration: 5, group: 'pierce', label: '穿透', symbol: '⇧' },
        life: { group: 'instant', label: '生命', symbol: '♥' },
      },
    },
    visuals: {
      // Canvas text sizes are logical pixels; HTML/CSS text is in style.css.
      fonts: { family: '"Segoe UI", Arial', durability: 17, powerup: 18, compactPowerup: 14,
        levelNotice: 20, waitingTitle: 22, waitingHint: 18 },
      colors: ['#3989D4', '#E8BE50', '#D85B59', '#42A987'], reinforced: '#547CA4', obstacle: '#576272',
      ball: '#eeeef0', paddle: '#d7dce3', particleLifetime: 0.28, particleCount: 4, particleSpeed: 50,
      levelNoticeDuration: 1.5, maxParticles: 160,
    },
  });

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  Object.assign(BB, { CONFIG, clamp });
})(globalThis.BlockBreaker ||= {});
