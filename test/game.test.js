'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../public/js/game.js');

const HOUR = 3_600_000;
const T0 = new Date(2026, 0, 1, 12).getTime();

function hatched() {
  const s = Game.create('团子', 'cat', T0);
  Game.hatch(s, T0);
  return s;
}

test('蛋在破壳前不会掉属性', () => {
  const s = Game.create('团子', 'cat', T0);
  Game.tick(s, T0 + 10 * HOUR);
  assert.equal(s.stats.hunger, 80);
  assert.equal(Game.stage(s).id, 'egg');
});

test('离线时间会结算衰减,且不低于 0', () => {
  const s = hatched();
  Game.tick(s, T0 + 2 * HOUR);
  assert.equal(s.stats.hunger, 68);
  Game.tick(s, T0 + 100 * HOUR);
  assert.equal(s.stats.hunger, 0);
});

test('睡觉恢复精力,睡饱后自动醒来并继续正常衰减', () => {
  const s = hatched();
  s.stats.energy = 50;
  assert.ok(Game.sleep(s).ok);
  const r = Game.tick(s, T0 + 3 * HOUR); // 2 小时睡满,再醒着 1 小时
  assert.equal(r.wokeUp, true);
  assert.equal(s.sleeping, false);
  assert.equal(s.stats.energy, 96);
  assert.equal(s.stats.hunger, 80 - 2 * 2 - 6);
});

test('不困的时候不肯睡', () => {
  const s = hatched();
  s.stats.energy = 95;
  assert.equal(Game.sleep(s).reason, 'notTired');
});

test('喂食消耗库存,吃饱了就不吃', () => {
  const s = hatched();
  s.stats.hunger = 50;
  assert.ok(Game.feed(s, 'fish').ok);
  assert.equal(s.stats.hunger, 85);
  assert.equal(s.food.fish, undefined);
  assert.equal(Game.feed(s, 'fish').reason, 'none');
  s.stats.hunger = 96;
  assert.equal(Game.feed(s, 'rice').reason, 'full');
});

test('经验够了会升级', () => {
  const s = hatched();
  s.xp = 118;
  s.stats.hunger = 10;
  const r = Game.feed(s, 'rice');
  assert.equal(r.levelUp.id, 'kid');
  assert.equal(Game.stage(s).id, 'kid');
});

test('抚摸每 8 下给 1 金币,每天有上限', () => {
  const s = hatched();
  const coins = s.coins;
  for (let i = 0; i < 8; i++) Game.stroke(s, T0);
  assert.equal(s.coins, coins + 1);
  for (let i = 0; i < 8 * 40; i++) Game.stroke(s, T0);
  assert.equal(s.coins, coins + 30);
  for (let i = 0; i < 8; i++) Game.stroke(s, T0 + 24 * HOUR);
  assert.equal(s.coins, coins + 31);
});

test('每日签到一天只能领一次', () => {
  const s = hatched();
  assert.equal(Game.claimDaily(s, T0), Game.DAILY_BONUS);
  assert.equal(Game.claimDaily(s, T0 + HOUR), 0);
  assert.equal(Game.claimDaily(s, T0 + 24 * HOUR), Game.DAILY_BONUS);
});

test('商店购买与穿戴', () => {
  const s = hatched();
  s.coins = 60;
  assert.equal(Game.buy(s, 'item', 'crown').reason, 'coins');
  assert.ok(Game.buy(s, 'item', 'bow').ok);
  assert.equal(s.coins, 10);
  assert.equal(Game.buy(s, 'item', 'bow').reason, 'owned');
  assert.equal(Game.toggleWear(s, 'bow').wearing, true);
  assert.equal(s.wearing.head, 'bow');
  assert.equal(Game.toggleWear(s, 'bow').wearing, false);
  assert.equal(Game.buy(s, 'food', 'rice').reason, 'unknown');
});

test('小游戏金币有上限', () => {
  const s = hatched();
  const coins = s.coins;
  assert.equal(Game.finishGame(s, 9999).coins, 200);
  assert.equal(s.coins, coins + 200);
});

test('心情:最迫切的需求优先,太低会哭', () => {
  const s = hatched();
  s.stats.hunger = 25;
  s.stats.clean = 10;
  const m = Game.mood(s);
  assert.equal(m.need.key, 'clean');
  assert.equal(m.expr, 'sad');
});

test('normalize 补齐缺失字段、过滤未知道具', () => {
  const s = Game.normalize({ name: 'x', species: 'dragon', stats: { hunger: 5 }, items: ['bow', 'laser'] });
  assert.equal(s.species, 'cat');
  assert.equal(s.stats.hunger, 5);
  assert.equal(s.stats.happy, 80);
  assert.deepEqual(s.items, ['bow']);
  assert.equal(s.wearing.head, null);
});
