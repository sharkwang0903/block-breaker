(function (BB) {
  'use strict';
  const { CONFIG, Game, Renderer, Input, UI } = BB;

  const canvas = document.getElementById('game-canvas');
  const game = new Game();
  const renderer = new Renderer(canvas);
  let accumulator = 0, previousTime = null;
  let input, ui;

  const actions = {
    start(mode) { input.clear(); accumulator = 0; game.start(mode); ui.update(); },
    launch() { game.launch(); ui.update(); },
    resume() { accumulator = 0; game.resume(); ui.update(); },
    togglePause() {
      input.clear(); accumulator = 0;
      if (game.state === 'paused') {
        if (ui.dialogKind === 'confirm') ui.showPause(); else game.resume();
      } else game.pause();
      ui.update();
    },
    home() { input.clear(); accumulator = 0; game.home(); ui.update(); },
  };

  input = new Input(canvas, game, { launch: actions.launch, pause: actions.togglePause });
  ui = new UI(game, actions);
  ui.update();

  function frame(timestamp) {
    const delta = previousTime === null ? 0 : Math.min(CONFIG.maxFrameDelta, (timestamp - previousTime) / 1000);
    previousTime = timestamp;
    if (game.state === 'playing' || game.state === 'waiting') {
      accumulator += delta;
      while (accumulator >= CONFIG.fixedStep) {
        game.step(CONFIG.fixedStep, input.sample()); accumulator -= CONFIG.fixedStep;
        if (game.state === 'result') { accumulator = 0; break; }
      }
    } else accumulator = 0;
    if (game.state !== 'home') { renderer.draw(game); ui.update(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(globalThis.BlockBreaker);
