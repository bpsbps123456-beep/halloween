// 죽림고스트 자동 검사: 화살촉만 위험한지, 화살 무늬가 공정한지, 난이도 차이가 나는지 봅니다.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const J = require('../single/jukrim/core.js').JukrimCore;

const { W, H } = J;

function quietWorld() {
  const w = J.createWorld(7);
  w.next = Infinity; // 저절로 나오는 화살은 막아 둡니다
  return w;
}

function arrow(w, x, y, angle, speed) {
  w.arrows.push({ x, y, angle, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, delay: 0, warn: 0, kind: 'normal', inside: true, near: false });
}

test('화살촉이 유령에 닿으면 끝난다', () => {
  const w = quietWorld();
  const g = w.ghost;
  arrow(w, g.x - 200, g.y, 0, 300);
  for (let i = 0; i < 240 && w.alive; i++) J.step(w, {}, J.DT);
  assert.strictEqual(w.alive, false);
});

test('화살대가 지나가도 촉이 비켜 가면 괜찮다', () => {
  const w = quietWorld();
  const g = w.ghost;
  // 촉이 유령 바로 앞에서 멈추듯 지나가지 않게: 유령 위 22px 높이로 지나가는 화살
  arrow(w, g.x - 300, g.y - (J.HIT + 5), 0, 300);
  for (let i = 0; i < 360; i++) J.step(w, {}, J.DT);
  assert.strictEqual(w.alive, true);
  assert.ok(w.near >= 1, '아슬아슬하게 스친 것도 세어야 해요');
});

test('빠른 화살도 한 번에 유령을 뚫고 지나가지 못한다', () => {
  const w = quietWorld();
  const g = w.ghost;
  arrow(w, g.x - 300, g.y, 0, 3000);
  for (let i = 0; i < 60 && w.alive; i++) J.step(w, {}, J.DT);
  assert.strictEqual(w.alive, false);
});

test('모든 화살은 화면 밖에서 나타나 안쪽으로 날아온다', () => {
  for (const name of Object.keys(J.PATTERNS)) {
    for (let seed = 1; seed <= 30; seed++) {
      const w = J.createWorld(seed);
      w.ghost.x = 100 + ((seed * 97) % (W - 200));
      w.ghost.y = 80 + ((seed * 53) % (H - 160));
      J.spawn(w, name);
      assert.ok(w.arrows.length > 0, name + ' 무늬가 화살을 안 만들었어요');
      for (const a of w.arrows) {
        const outside = a.x <= 0 || a.x >= W || a.y <= 0 || a.y >= H;
        assert.ok(outside, `${name}: 화살이 화면 안에서 갑자기 나타나요`);
        const nx = a.x + a.vx * 0.5;
        const ny = a.y + a.vy * 0.5;
        const closer = Math.hypot(nx - W / 2, ny - H / 2) < Math.hypot(a.x - W / 2, a.y - H / 2);
        assert.ok(closer, `${name}: 화살이 화면 바깥쪽으로 날아가요`);
      }
    }
  }
});

test('화살 벽에는 유령 가까이에 지나갈 구멍이 있다', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = J.createWorld(seed);
    J.spawn(w, 'wall');
    const g = w.ghost;
    const a0 = w.arrows[0];
    const horizontal = Math.abs(a0.vx) > Math.abs(a0.vy); // 왼쪽/오른쪽에서 오는 벽
    // 유령이 갈 수 있는 끝(가장자리 24px 안쪽)도 구멍의 경계로 칩니다
    const pos = w.arrows.map((a) => (horizontal ? a.y : a.x)).concat([24, (horizontal ? H : W) - 24]).sort((p, q) => p - q);
    const me = horizontal ? g.y : g.x;
    let widest = 0;
    for (let i = 1; i < pos.length; i++) {
      const lo = pos[i - 1];
      const hi = pos[i];
      if (hi - lo > widest && Math.min(Math.abs(me - lo), Math.abs(me - hi), Math.abs(me - (lo + hi) / 2)) < 260) widest = hi - lo;
    }
    assert.ok(widest >= 150, `벽 구멍이 너무 좁거나 멀어요 (seed ${seed}, ${widest}px)`);
  }
});

test('같은 씨앗이면 화살도 똑같이 나온다', () => {
  const a = J.createWorld(42);
  const b = J.createWorld(42);
  for (let i = 0; i < 120 * 20; i++) {
    J.step(a, { dx: 1 }, J.DT);
    J.step(b, { dx: 1 }, J.DT);
  }
  assert.strictEqual(a.arrows.length, b.arrows.length);
  assert.strictEqual(a.alive, b.alive);
});

test('레벨은 10, 20, 35, 50, 70초에 오른다', () => {
  const w = quietWorld();
  const at = (t) => {
    w.t = t;
    return J.levelOf(w);
  };
  assert.deepStrictEqual([0, 9.9, 10, 20, 35, 50, 70, 300].map(at), [1, 1, 2, 3, 4, 5, 6, 6]);
});

test('피하는 자동 플레이어가 평균 20초 넘게 버틴다 (불가능하게 어렵지 않다)', () => {
  const DIRS = [[0, 0]];
  for (let i = 0; i < 8; i++) DIRS.push([Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);
  function survive(seed) {
    const w = J.createWorld(seed);
    let dir = [0, 0];
    let next = 0;
    while (w.alive && w.t < 90) {
      if (w.t >= next) {
        next = w.t + 0.08;
        let best = -Infinity;
        for (const d of DIRS) {
          let worst = Infinity;
          for (let k = 1; k <= 6; k++) {
            const t = k * 0.08;
            const gx = Math.max(24, Math.min(W - 24, w.ghost.x + d[0] * J.MOVE * t));
            const gy = Math.max(24, Math.min(H - 24, w.ghost.y + d[1] * J.MOVE * t));
            for (const a of w.arrows) {
              const at = t - Math.max(0, a.delay);
              if (at < 0) continue;
              worst = Math.min(worst, Math.hypot(a.x + a.vx * at - gx, a.y + a.vy * at - gy) + t * 25);
            }
          }
          const wall = Math.min(w.ghost.x + d[0] * 40, W - w.ghost.x - d[0] * 40, w.ghost.y + d[1] * 40, H - w.ghost.y - d[1] * 40);
          const score = Math.min(worst, 160) + Math.min(wall, 120) * 0.25;
          if (score > best) {
            best = score;
            dir = d;
          }
        }
      }
      J.step(w, { dx: dir[0], dy: dir[1] }, J.DT);
      w.events.length = 0;
    }
    return w.t;
  }
  let sum = 0;
  for (let s = 1; s <= 8; s++) sum += survive(s);
  assert.ok(sum / 8 > 20, `평균 ${(sum / 8).toFixed(1)}초밖에 못 버텨요`);
});

test('칭호는 버틴 시간에 따라 바뀐다', () => {
  assert.strictEqual(J.titleFor(3), '아기 유령');
  assert.strictEqual(J.titleFor(25), '날쌘 유령');
  assert.strictEqual(J.titleFor(50), '죽림 달인');
  assert.strictEqual(J.titleFor(500), '할로윈의 신');
});
