(function (BB) {
  'use strict';
  const { CONFIG } = BB;

  class UI {
    constructor(game, actions) {
      this.game = game; this.actions = actions; this.signature = ''; this.dialogKind = null;
      this.home = document.getElementById('home'); this.screen = document.getElementById('game-screen');
      this.overlay = document.getElementById('overlay'); this.dialog = this.overlay.querySelector('.dialog');
      this.launch = document.getElementById('launch-button'); this.pause = document.getElementById('pause-button');
      document.getElementById('normal-mode').addEventListener('click', () => actions.start('normal'));
      document.getElementById('infinite-mode').addEventListener('click', () => actions.start('infinite'));
      this.launch.addEventListener('click', () => actions.launch());
      this.pause.addEventListener('click', () => actions.togglePause());
      this.overlay.addEventListener('keydown', event => {
        if (event.code !== 'Tab') return;
        const buttons = [...this.overlay.querySelectorAll('button')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    }

    update() {
      const g = this.game;
      const signature = `${g.runId}:${g.state}`;
      if (signature !== this.signature) {
        this.signature = signature;
        this.home.hidden = g.state !== 'home'; this.screen.hidden = g.state === 'home';
        this.overlay.hidden = !['paused', 'result'].includes(g.state);
        this.pause.disabled = g.state === 'result';
        if (g.state === 'paused') this.showPause();
        else if (g.state === 'result') this.showResult();
        else {
          this.dialogKind = null;
          if (g.state === 'home') document.getElementById('normal-mode').focus({ preventScroll: true });
          else document.getElementById('game-canvas').focus({ preventScroll: true });
        }
      }
      if (g.state === 'home') return;
      const hudSignature = `${g.mode}:${g.level}:${g.score}:${g.lives}`;
      if (hudSignature !== this.hudSignature) {
        this.hudSignature = hudSignature;
        document.getElementById('mode-label').textContent = g.mode === 'normal' ? '正常模式' : '無限模式';
        const level = document.getElementById('level-value');
        level.setAttribute('aria-label', `LEVEL ${g.level}${g.mode === 'normal' ? ' / 10' : ''}`);
        level.replaceChildren(document.createTextNode(String(g.level).padStart(2, '0')));
        if (g.mode === 'normal') { const small = document.createElement('small'); small.textContent = ' / 10'; level.append(small); }
        document.getElementById('score-value').textContent = String(g.score).padStart(6, '0');
        const lives = document.getElementById('lives-value'); lives.textContent = '● '.repeat(g.lives).trim(); lives.setAttribute('aria-label', `${g.lives} 條生命`);
      }
      this.launch.hidden = g.state !== 'waiting';
      const effects = document.getElementById('effects');
      const effectSignature = `${g.state}:${Object.values(g.effects).map(e => `${e.type}:${Math.ceil(e.remaining)}`).join(',')}`;
      if (effectSignature !== this.effectSignature) {
        this.effectSignature = effectSignature; effects.replaceChildren();
        for (const effect of Object.values(g.effects)) {
          const spec = CONFIG.powerups.effects[effect.type]; const span = document.createElement('span');
          span.className = `effect-chip${spec.negative ? ' negative' : ''}`;
          span.textContent = `${spec.symbol} ${spec.label} ${Math.ceil(effect.remaining)}s`; effects.append(span);
        }
        if (!effects.children.length) { const span = document.createElement('span'); span.textContent = g.state === 'waiting' ? '按下發球開始' : '接住反彈，繼續挑戰'; effects.append(span); }
      }
      if (g.message) { document.getElementById('status').textContent = g.message; g.message = ''; }
    }

    setDialog(kind, tag, title, description, buttons, stats = null) {
      this.dialogKind = kind; this.overlay.hidden = false;
      document.getElementById('dialog-tag').textContent = tag;
      document.getElementById('dialog-title').textContent = title;
      document.getElementById('dialog-description').textContent = description;
      const list = document.getElementById('result-stats'); list.hidden = !stats; list.replaceChildren();
      if (stats) for (const [label, value] of stats) {
        const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; list.append(dt, dd);
      }
      const actions = document.getElementById('dialog-actions'); actions.replaceChildren();
      buttons.forEach(({ label, action }, i) => {
        const button = document.createElement('button'); button.textContent = label; if (!i) button.className = 'primary';
        button.addEventListener('click', action); actions.append(button);
      });
      actions.firstElementChild.focus({ preventScroll: true });
    }

    showPause() {
      this.setDialog('pause', 'TAKE A BREATH', '遊戲暫停', '球、磚塊與道具計時已暫停。', [
        { label: '繼續遊戲', action: () => this.actions.resume() },
        { label: '重新開始', action: () => this.confirm('restart') },
        { label: '回到首頁', action: () => this.confirm('home') },
      ]);
    }

    confirm(kind) {
      this.setDialog('confirm', 'START FRESH?', kind === 'restart' ? '重新開始這一場？' : '回到首頁？', '當次關卡、分數與遊戲進度將會丟失。', [
        { label: '取消，保留進度', action: () => this.showPause() },
        { label: kind === 'restart' ? '確認重新開始' : '確認回到首頁', action: () => kind === 'restart' ? this.actions.start(this.game.mode) : this.actions.home() },
      ]);
    }

    showResult() {
      const g = this.game;
      this.setDialog('result', g.won ? 'ALL BRICKS, ALL CLEAR.' : 'ONE MORE TRY?', g.won ? '通關成功' : '挑戰結束', g.won ? '十個關卡完成。每一次反彈，都算數。' : '下一場，從新的反彈開始。', [
        { label: '再來一次', action: () => this.actions.start(g.mode) },
        { label: '回到首頁', action: () => this.actions.home() },
      ], [['抵達關卡', String(g.level)], ['最終分數', g.score.toLocaleString('zh-TW')], ['破壞磚塊', String(g.destroyedCount)]]);
    }
  }

  Object.assign(BB, { UI });
})(globalThis.BlockBreaker);
