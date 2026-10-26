// 호박분투 자동 검사: 모든 단계가 끝까지 갈 수 있는지, 아이들 손으로도 충분히 여유가 있는지 봅니다.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const C = require('../single/hobak/core.js').HobakCore;

const P = C.policy;

/** 사람처럼 화면을 보고 누르는 자동 플레이어로 한 단계를 끝까지 달립니다. */
function playStage(si) {
  const level = C.buildLevel(si);
  const world = C.createWorld(level);
  const h = world.hero;
  let held = false;
  let heldFor = 0;
  for (let t = 0; t < 120; t += C.DT) {
    let pressed = false;
    let released = false;
    const press = () => {
      if (!held) {
        pressed = true;
        held = true;
        heldFor = 0;
      }
    };
    const release = () => {
      if (held) {
        released = true;
        held = false;
      }
    };
    heldFor += C.DT;
    if (h.state === 'run') {
      if (held && heldFor > 0.09) release();
      const i = level.roofs.findIndex((r) => h.x >= r.x0 - 4 && h.x <= r.x1 + 4);
      const A = level.roofs[i];
      const B = level.roofs[i + 1];
      if (A && B && !held) {
        const swing = level.anchors.some((a) => a.x > A.x1 && a.x < B.x0);
        let jx = A.x1 - 12;
        if (!swing) {
          // 다음 지붕의 안전한 곳(넓으면 앞쪽, 좁으면 한가운데)에 내려앉도록 뜁니다
          const dh = B.top - A.top;
          const air = (C.JUMP_V + Math.sqrt(C.JUMP_V * C.JUMP_V + 2 * C.G * dh)) / C.G;
          const D = level.speed * air;
          const land = B.x0 + Math.min((D - (B.x0 - A.x1)) / 2, (B.x1 - B.x0) / 2);
          jx = Math.min(A.x1, land - D);
        }
        if (h.x >= jx) press();
      }
    } else if (h.state === 'air') {
      if (held && heldFor > 0.09) release();
      else if (!held && h.vy >= -60 && C.findAnchor(level, h) >= 0) press();
    } else if (h.state === 'swing') {
      if (C.ropeAngle(h) >= 0.45) release();
    }
    C.step(world, { pressed, released, held }, C.DT);
    for (const e of world.events) {
      if (e.type === 'fall') return { ok: false, x: h.x, world, level };
      if (e.type === 'goal') return { ok: true, world, level };
    }
    world.events.length = 0;
  }
  return { ok: false, x: h.x, timeout: true, world, level };
}

test('6단계 모두 만들 수 있고, 매번 똑같이 만들어진다', () => {
  assert.strictEqual(C.STAGES.length, 6);
  for (let si = 0; si < C.STAGES.length; si++) {
    const a = C.buildLevel(si);
    const b = C.buildLevel(si);
    assert.deepStrictEqual(a.roofs, b.roofs, `${si + 1}단계 지붕이 매번 달라요`);
    assert.deepStrictEqual(a.anchors, b.anchors);
    assert.strictEqual(a.candies.length, b.candies.length);
  }
});

test('지붕은 왼쪽부터 차례로 놓이고 사이마다 틈이 있다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const { roofs } = C.buildLevel(si);
    for (let i = 1; i < roofs.length; i++) {
      assert.ok(roofs[i].x0 - roofs[i - 1].x1 >= 60, `${si + 1}단계 ${i}번째 틈이 너무 좁아요`);
      assert.ok(roofs[i].x1 > roofs[i].x0 + 100, `${si + 1}단계 ${i}번째 지붕이 너무 짧아요`);
    }
  }
});

test('황금 별사탕 개수가 단계 설정과 같다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const level = C.buildLevel(si);
    const golds = level.candies.filter((c) => c.gold).length;
    assert.strictEqual(golds, C.STAGES[si].golds, `${si + 1}단계`);
    assert.strictEqual(level.goldTotal, golds);
  }
});

test('자동 플레이어가 모든 단계를 한 번도 안 떨어지고 끝낸다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const run = playStage(si);
    assert.ok(run.ok, `${si + 1}단계를 끝내지 못했어요 (x=${Math.round(run.x)})`);
  }
});

test('일반 점프는 누르는 순간이 0.2초 이상 넉넉하다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const level = C.buildLevel(si);
    const base = Object.assign({}, level, { candies: [], goalX: Infinity });
    for (let i = 0; i < level.roofs.length - 1; i++) {
      const A = level.roofs[i];
      const B = level.roofs[i + 1];
      if (level.anchors.some((a) => a.x > A.x1 && a.x < B.x0)) continue;
      const startX = Math.max(A.x0 + 10, A.x1 - 220);
      let ok = 0;
      for (let jx = startX; jx <= A.x1 + 20; jx += 2) {
        if (C.simulate(base, i, startX, [P.pressAt(jx), P.tap()], i + 1, 5).ok) ok++;
      }
      const window = (ok * 2) / level.speed;
      assert.ok(window >= 0.2, `${si + 1}단계 ${i}번째 점프 여유가 ${window.toFixed(2)}초뿐이에요`);
    }
  }
});

test('거미줄 구간은 누르는 때와 떼는 때가 조금 달라도 대부분 건널 수 있다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const level = C.buildLevel(si);
    const base = Object.assign({}, level, { candies: [], goalX: Infinity });
    for (let i = 0; i < level.roofs.length - 1; i++) {
      const A = level.roofs[i];
      const B = level.roofs[i + 1];
      const inGap = level.anchors.filter((a) => a.x > A.x1 && a.x < B.x0);
      if (!inGap.length) continue;
      const startX = Math.max(A.x0 + 10, A.x1 - 200);
      let ok = 0;
      let total = 0;
      for (const web of [-400, -250, -100, 50, 200]) {
        for (const rel of [0, 0.2, 0.4, 0.6, 0.8]) {
          const acts = [P.pressAt(A.x1 - 12), P.tap(), P.webWhen(web), P.releaseAt(rel)];
          if (inGap.length === 2) acts.push(P.webWhen(-60), P.releaseAt(0.45));
          total++;
          if (C.simulate(base, i, startX, acts, i + 1, 8).ok) ok++;
        }
      }
      const need = inGap.length === 2 ? 0.5 : 0.7;
      assert.ok(ok / total >= need, `${si + 1}단계 ${i}번째 거미줄 구간 성공률이 ${Math.round((100 * ok) / total)}%예요`);
    }
  }
});

test('사탕 점수: 사탕 5점, 황금 별사탕은 단계마다 커진다', () => {
  const l1 = C.buildLevel(0);
  const l6 = C.buildLevel(5);
  assert.strictEqual(C.CANDY_POINTS, 5);
  assert.ok(l6.goldPoints > l1.goldPoints);
  const run = playStage(0);
  const w = run.world;
  assert.strictEqual(w.score, w.candies * 5 + w.golds * l1.goldPoints);
});
