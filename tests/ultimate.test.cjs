const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
for (const name of ['config', 'levels', 'powerups', 'bricks', 'physics', 'ultimate', 'game']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', 'js', name + '.js'), 'utf8'), context);
}
const BB = context.BlockBreaker;
function game(level = 1) {
  const g = new BB.Game({random: () => 0}); g.start('normal'); g.level = level;
  g.bricks = BB.createBricks(level); g.launch(); return g;
}

test('real paddle returns add one energy each, with no repeated contact, wall or launch charge', () => {
  const g = new BB.Game(); g.start('normal');
  g.launch(); assert.equal(g.energy, 0);
  const ball = g.balls[0];
  ball.x = g.paddle.x; ball.y = g.paddle.y - ball.radius - .5;
  ball.vx = 0; ball.vy = 310;
  g.step(.01); assert.equal(g.energy, 1); assert(ball.vy < 0);
  g.step(.01); assert.equal(g.energy, 1);
  ball.x = ball.radius + .5; ball.y = 400; ball.vx = -310; ball.vy = 0;
  g.step(.01); assert.equal(g.energy, 1);
  const extra = g.makeBall(g.paddle.x, g.paddle.y - ball.radius - .5, 0, 310);
  ball.x = g.paddle.x; ball.y = extra.y - .1; ball.vx = 0; ball.vy = 310;
  g.step(.01); assert.equal(g.energy, 3);
});

test('positive item catches add five, negatives add zero, energy is capped at 25', () => {
  const g = game();
  for (const type of BB.CONFIG.powerups.positive) {
    g.drops = [{type, x: g.paddle.x, y: g.paddle.y - BB.dropHitbox(type).height / 2}];
    BB.updateDrops(g, .01, g.paddle.x, g.paddle.x);
  }
  assert.equal(g.energy, 20);
  BB.applyPowerup(g, 'fast'); assert.equal(g.energy, 20);
  g.lives = 5; BB.applyPowerup(g, 'life'); assert.equal(g.energy, 25);
  BB.applyPowerup(g, 'extend'); assert.equal(g.energy, 25);
});

test('casting requires full energy and active play, drains once, and cannot overlap', () => {
  const g = game(2);
  g.energy = 24; assert.equal(g.castUltimate(), false);
  g.energy = 25; g.state = 'waiting'; assert.equal(g.castUltimate(), false);
  g.launch(); assert.equal(g.energy, 25);
  assert.equal(g.castUltimate(), true); assert.equal(g.energy, 0);
  assert.equal(g.ultimateSerial, 1); assert.equal(g.ultimate.remaining, 3);
  g.chargeEnergy(25); assert.equal(g.energy, 25);
  assert.equal(g.castUltimate(), false); assert.equal(g.energy, 25);
  BB.tickUltimate(g, 3); assert.equal(g.ultimate, null);
  assert.equal(g.castUltimate(), true); assert.equal(g.energy, 0);
});

test('three-second lightning hits at most ten bricks, with no automatic energy gain', () => {
  const g = game(3); g.energy = 25; g.castUltimate();
  BB.tickUltimate(g, .09); assert.equal(g.destroyedCount, 0);
  for (let i = 0; i < 291; i++) BB.tickUltimate(g, .01);
  assert.equal(g.ultimate, null);
  assert(g.destroyedCount > 0 && g.destroyedCount <= 10);
  assert.equal(g.energy, 0);
  assert.equal(g.score, g.destroyedCount * 50);
});

test('explosion chains share the ten-brick budget and normal ball damage remains independent', () => {
  const g = game();
  g.bricks = Array.from({length: 20}, (_, i) => ({id: 'x' + i, row: Math.floor(i / 5), col: i % 5,
    x: 20 + i % 5 * 56, y: 80 + Math.floor(i / 5) * 29, width: 50, height: 22,
    type: 'X', hp: 1, color: '#d85b59', destroyed: false}));
  g.energy = 25; g.castUltimate(); const budget = g.ultimate.budget;
  BB.tickUltimate(g, .1);
  assert.equal(budget.destroyed, 10); assert.equal(budget.remaining, 0);
  assert.equal(g.destroyedCount, 10); assert.equal(g.score, 500);
  BB.tickUltimate(g, 2.9); assert.equal(g.destroyedCount, 10);
  BB.damageBrick(g, g.bricks.find(b => !b.destroyed));
  assert(g.destroyedCount > 10); assert.equal(budget.destroyed, 10);
});

test('lightning defeats reinforced bricks, preserves obstacles, drops products and releases hidden balls', () => {
  const g = game(10); const budget = {remaining: 10, destroyed: 0};
  const h = g.bricks.find(b => b.type === 'H');
  BB.damageBrick(g, h, 0, budget); assert(h.destroyed);
  const s = g.bricks.find(b => b.type === 'S');
  BB.damageBrick(g, s, 0, budget); assert(!s.destroyed); assert.equal(budget.destroyed, 1);
  const d = g.bricks.find(b => b.type === 'D' && b.guaranteedPowerup);
  BB.damageBrick(g, d, 0, budget);
  assert.equal(g.drops.length, 1); assert.equal(g.drops[0].type, d.guaranteedPowerup);
  const ballCount = g.balls.length;
  BB.damageBrick(g, g.bricks.find(b => b.type === 'O'), 0, budget);
  assert.equal(g.balls.length, ballCount + 1); assert.equal(budget.destroyed, 3);
  assert.equal(g.energy, 0);
});

test('losing the last ball preserves energy; waiting and pause freeze the active skill', () => {
  const g = game(); g.energy = 25; g.castUltimate(); g.chargeEnergy(7);
  g.balls = []; g.step(.01);
  assert.equal(g.state, 'waiting'); assert.equal(g.energy, 7);
  const remaining = g.ultimate.remaining;
  g.step(.5); assert.equal(g.ultimate.remaining, remaining);
  g.pause(); g.step(.5); assert.equal(g.ultimate.remaining, remaining);
  g.resume(); g.launch(); assert.equal(g.energy, 7);
  g.step(.01); assert(g.ultimate.remaining < remaining);
  g.advanceLevel(); assert.equal(g.energy, 7); assert.equal(g.ultimate, null);
});

test('an ultimate clear ends the cast before the next level and preserves rebuilt energy', () => {
  const g = game(); g.bricks = [g.bricks.find(b => b.type === 'B')];
  g.energy = 25; g.castUltimate(); g.chargeEnergy(6);
  g.step(.11);
  assert.equal(g.level, 2); assert.equal(g.ultimate, null);
  assert.equal(g.ultimateBolts.length, 0); assert.equal(g.energy, 6);
  assert(g.bricks.every(b => !b.destroyed));
});

test('result, home and restart cannot leave a cast running; a new run starts with zero energy', () => {
  const g = game(); g.energy = 25; g.castUltimate(); g.chargeEnergy(9);
  g.finish(false); assert.equal(g.ultimate, null); assert.equal(g.castUltimate(), false);
  g.start('infinite'); assert.equal(g.energy, 0); assert.equal(g.ultimateSerial, 0);
  g.launch(); g.chargeEnergy(25); g.castUltimate(); g.home();
  assert.equal(g.ultimate, null); assert.equal(g.ultimateBolts.length, 0);
  assert.equal(g.castUltimate(), false);
});
