(function (BB) {
  'use strict';
  const { CONFIG } = BB;

  class UI {
    constructor(game, actions) {
      this.game = game; this.actions = actions; this.signature = ''; this.dialogKind = null;
      this.companion = new BB.Companion();
      this.pickupToast = document.getElementById('pickup-toast');
      this.pickupText = document.getElementById('pickup-text');
      this.energyValue = document.getElementById('energy-value');
      this.energyMeter = document.getElementById('energy-meter');
      this.energyFill = document.getElementById('energy-fill');
      this.ultimateStatus = document.getElementById('ultimate-status');
      this.ultimateButton = document.getElementById('ultimate-button');
      this.ultimateButton.addEventListener('click', () => actions.cast());
      this.home = document.getElementById('home'); this.screen = document.getElementById('game-screen');
      this.overlay = document.getElementById('overlay'); this.dialog = this.overlay.querySelector('.dialog');
      this.productLink = document.getElementById('result-product-link');
      this.launch = document.getElementById('launch-button'); this.pause = document.getElementById('pause-button');
      document.getElementById('normal-mode').addEventListener('click', () => actions.start('normal'));
      document.getElementById('infinite-mode').addEventListener('click', () => actions.start('infinite'));
      this.launch.addEventListener('click', () => actions.launch());
      this.pause.addEventListener('click', () => actions.togglePause());
      this.overlay.addEventListener('keydown', event => {
        if (event.code === 'Space' && document.activeElement === this.productLink) {
          event.preventDefault();
          if (!event.repeat) this.productLink.click();
          return;
        }
        if (!['Tab', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
        const controls = [...this.dialog.querySelectorAll('button:not(:disabled), a[href]:not([hidden])')];
        if (event.code !== 'Tab') {
          event.preventDefault();
          const index = controls.indexOf(document.activeElement);
          const direction = event.code === 'ArrowDown' ? 1 : -1;
          const next = index < 0 ? (direction > 0 ? 0 : controls.length - 1) : (index + direction + controls.length) % controls.length;
          controls[next].focus();
          return;
        }
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });
    }

    update() {
      const g = this.game;
      this.companion.update(g);
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
      this.updateEnergy();
      const notice = g.pickupNotice;
      this.pickupToast.hidden = !(g.state === 'playing' && notice?.remaining > 0);
      if (notice && this.pickupSignature !== `${g.runId}:${notice.serial}`) {
        this.pickupSignature = `${g.runId}:${notice.serial}`;
        this.pickupText.textContent = notice.text;
        this.pickupToast.classList.toggle('negative', !!CONFIG.powerups.effects[notice.type].negative);
      }
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
          const product = CONFIG.powerups.products[effect.type];
          span.textContent = `${product ? product.name : spec.label} ${spec.symbol} ${Math.ceil(effect.remaining)}s`;
          span.title = `${product ? product.name + '｜' + product.label : spec.label}，剩餘 ${Math.ceil(effect.remaining)} 秒`;
          span.setAttribute('aria-label', span.title); effects.append(span);
        }
        if (!effects.children.length) { const span = document.createElement('span'); span.textContent = g.state === 'waiting' ? '按下發球開始' : '接住反彈，繼續挑戰'; effects.append(span); }
      }
      if (g.message) { document.getElementById('status').textContent = g.message; g.message = ''; }
    }

    updateEnergy() {
      const g = this.game, max = CONFIG.ultimate.energyMax;
      const signature = `${g.runId}:${g.state}:${g.energy}:${Math.ceil(g.ultimate?.remaining || 0)}:${g.ultimate?.budget.destroyed || 0}`;
      if (signature === this.energySignature) return;
      this.energySignature = signature;
      const ready = g.energy >= max && !g.ultimate && ['playing', 'waiting'].includes(g.state);
      this.companion.root.dataset.ready = String(ready);
      this.energyValue.textContent = `${g.energy} / ${max}`;
      this.energyMeter.setAttribute('aria-valuemax', String(max));
      this.energyMeter.setAttribute('aria-valuenow', String(g.energy));
      this.energyFill.style.width = `${g.energy / max * 100}%`;
      this.ultimateButton.disabled = g.state !== 'playing' || !ready;
      this.ultimateButton.querySelector('span').textContent = g.ultimate ? '電擊中' : '水母電擊';
      this.ultimateButton.setAttribute('aria-label', ready ? '發動水母電擊，空白鍵或點擊' : `水母電擊，能量 ${g.energy} / ${max}`);
      if (g.state === 'paused') this.ultimateStatus.textContent = '暫停中';
      else if (g.state === 'result') this.ultimateStatus.textContent = '下一場，再一起蓄力！';
      else if (g.ultimate) this.ultimateStatus.textContent = g.state === 'waiting' ? '發球後繼續電擊' : `電擊中 ${Math.ceil(g.ultimate.remaining)}s・${g.ultimate.budget.destroyed}/${CONFIG.ultimate.maxBricks}`;
      else if (ready) this.ultimateStatus.textContent = g.state === 'waiting' ? '能量已滿，發球後可施放' : '準備完成！空白鍵發動';
      else this.ultimateStatus.textContent = '回擊＋1・商品＋5';
    }

    setDialog(kind, tag, title, description, buttons, stats = null) {
      this.dialogKind = kind; this.overlay.hidden = false;
      this.productLink.hidden = kind !== 'result';
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
      if (kind === 'result') actions.append(this.productLink);
      actions.firstElementChild.focus({ preventScroll: true });
    }

    showPause() {
      this.setDialog('pause', 'TAKE A BREATH', '遊戲暫停', '球、磚塊、道具與大招計時已暫停。', [
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
