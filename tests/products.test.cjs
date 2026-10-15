const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
for (const name of ['config', 'levels', 'powerups', 'bricks', 'physics', 'ultimate', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', `${name}.js`), 'utf8'), context);
}
const BB = context.BlockBreaker;
const { CONFIG, Game, applyPowerup, updateDrops, tickEffects, dropHitbox } = BB;
function game() { const g = new Game(); g.start('normal'); g.launch(); return g; }

test('all four positive drops have local product PNGs; negative drops retain small hitboxes', () => {
  const names = [];
  for (const type of CONFIG.powerups.positive) {
    const product = CONFIG.powerups.products[type];
    assert(fs.existsSync(path.join(root, product.image)));
    names.push(product.name);
  }
  assert.deepEqual(names.sort(), ['BF01+1', 'PPA', 'QCC', 'SIRT+10'].sort());
  for (const type of CONFIG.powerups.negative) {
    assert.equal(CONFIG.powerups.products[type], undefined);
    assert.equal(dropHitbox(type).width, 22);
    assert.equal(dropHitbox(type).height, 22);
  }
});

test('product catches apply the existing effects, speed to all balls, and product notices', () => {
  const g = game();
  g.makeBall(100, 300, 0, -CONFIG.ball.speed);
  applyPowerup(g, 'extend');
  assert.equal(g.paddle.width, 150);
  assert.equal(g.effects.paddle.remaining, 10);
  assert.match(g.message, /BF01\+1.*球拍加長/);
  applyPowerup(g, 'slow');
  assert.equal(g.effects.speed.remaining, 8);
  for (const ball of g.balls) assert(Math.abs(Math.hypot(ball.vx, ball.vy) - 217) < 1e-8);
  assert.match(g.message, /PPA.*球速減慢/);
  applyPowerup(g, 'pierce');
  assert.equal(g.effects.pierce.remaining, 5);
  assert.match(g.message, /QCC.*穿透啟動/);
  applyPowerup(g, 'life');
  assert.equal(g.lives, 4);
  assert.match(g.message, /SIRT\+10.*生命＋1/);
  assert.equal(g.pickupSerial, 4);
});

test('first level offers six item bricks; random slots still follow the normal drop path', () => {
  const g = game();
  assert.equal(g.bricks.length, 16);
  const bricks = g.bricks.filter(b => b.type === 'D');
  assert.equal(bricks.length, 6);
  const rolls = [0, .3]; g.random = () => rolls.shift();
  BB.damageBrick(g, bricks.find(brick => !brick.guaranteedPowerup));
  assert.equal(g.drops.length, 1);
  assert.equal(g.drops[0].type, 'slow');
  assert.equal(g.score, 50);
});

test('every normal and repeating infinite level guarantees all four products under worst-case random rolls', () => {
  for (let level = 1; level <= 30; level++) {
    const g = game(); g.level = level; g.bricks = BB.createBricks(level);
    g.random = () => .99; // Every random slot becomes a negative item.
    assert.equal(g.bricks.filter(b => b.type === 'D').length, 6, `level ${level}`);
    const guaranteed = g.bricks.filter(b => b.guaranteedPowerup);
    assert.equal(guaranteed.length, 4);
    assert.deepEqual(Array.from(guaranteed, b => b.guaranteedPowerup).sort(), [...CONFIG.powerups.positive].sort());
    // Includes explosion chains, repeated damage, reinforced bricks and obstacles.
    for (const brick of g.bricks) {
      if (brick.type === 'S') continue;
      BB.damageBrick(g, brick); BB.damageBrick(g, brick);
    }
    assert.equal(g.drops.length, 6, `level ${level}: each item brick drops exactly once`);
    assert.equal(g.drops.filter(d => CONFIG.powerups.positive.includes(d.type)).length, 4);
    assert.equal(g.drops.filter(d => CONFIG.powerups.negative.includes(d.type)).length, 2);
    assert(BB.isLevelClear(g));
  }
});

test('life is capped and full-life pickup feedback does not claim another life', () => {
  const g = game(); g.lives = CONFIG.maxLives;
  applyPowerup(g, 'life');
  assert.equal(g.lives, 5);
  assert.equal(g.pickupNotice.text, 'SIRT+10｜生命已滿');
});

for (const type of CONFIG.powerups.positive) {
  test(`${type}: touching the package catches it, transparent side padding does not`, () => {
    const hitbox = dropHitbox(type);
    const miss = game();
    miss.drops = [{ type, x: miss.paddle.x + (miss.paddle.width + hitbox.width) / 2 + 1,
      y: miss.paddle.y - hitbox.height / 2 - 1 }];
    updateDrops(miss, .02, miss.paddle.x, miss.paddle.x);
    assert.equal(miss.drops.length, 1);
    assert.equal(miss.pickupSerial, 0);
    const catchGame = game();
    catchGame.drops = [{ type, x: catchGame.paddle.x + (catchGame.paddle.width + hitbox.width) / 2 - 1,
      y: catchGame.paddle.y - hitbox.height / 2 - 1 }];
    updateDrops(catchGame, .02, catchGame.paddle.x, catchGame.paddle.x);
    assert.equal(catchGame.drops.length, 0);
    assert.equal(catchGame.pickupSerial, 1);
    assert.equal(catchGame.pickupNotice.type, type);
  });
}

test('moving paddle can catch a product between frame endpoints', () => {
  const g = game(); g.paddle.x = 400;
  g.drops = [{type: 'pierce', x: 240, y: g.paddle.y - dropHitbox('pierce').height / 2 - 20}];
  updateDrops(g, .4, 80, 400);
  assert.equal(g.drops.length, 0);
  assert.equal(g.effects.pierce.type, 'pierce');
});

test('product refresh and negative effects keep existing mutual exclusion and expiry', () => {
  const g = game();
  applyPowerup(g, 'extend'); tickEffects(g, 3); applyPowerup(g, 'extend');
  assert.equal(g.paddle.width, 150); assert.equal(g.effects.paddle.remaining, 10);
  applyPowerup(g, 'shrink'); assert.equal(g.paddle.width, 70);
  applyPowerup(g, 'fast'); assert(Math.abs(BB.currentSpeed(g) - 387.5) < 1e-8);
  applyPowerup(g, 'slow'); assert.equal(g.effects.speed.type, 'slow');
  tickEffects(g, 11);
  assert.equal(Object.keys(g.effects).length, 0);
  assert.equal(g.paddle.width, 100);
  assert.equal(BB.currentSpeed(g), 310);
});

test('pause freezes drop and notice; restart removes prior pickup state', () => {
  const g = game(); applyPowerup(g, 'slow');
  g.drops = [{type: 'extend', x: 100, y: 300}];
  g.pause(); g.step(1);
  assert.equal(g.drops[0].y, 300);
  assert.equal(g.pickupNotice.remaining, 2.4);
  assert.equal(g.effects.speed.remaining, 8);
  g.resume(); tickEffects(g, 2.5); assert.equal(g.pickupNotice.remaining, 0);
  g.start('normal');
  assert.equal(g.pickupNotice, null); assert.equal(g.pickupSerial, 0);
  assert.equal(g.drops.length, 0); assert.equal(Object.keys(g.effects).length, 0);
});

test('missed product despawns only after the visible package leaves the board', () => {
  const g = game();
  g.drops = [{type: 'slow', x: 10, y: CONFIG.height + dropHitbox('slow').height / 2 - 2}];
  updateDrops(g, .008, g.paddle.x, g.paddle.x); assert.equal(g.drops.length, 1);
  updateDrops(g, .02, g.paddle.x, g.paddle.x); assert.equal(g.drops.length, 0);
});
