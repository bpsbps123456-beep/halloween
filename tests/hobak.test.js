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

test('4단계 모두 만들 수 있고, 매번 똑같이 만들어진다', () => {
  assert.strictEqual(C.STAGES.length, 4);
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

test('난이도는 5 → 10 → 15 → 20 이고, 단계마다 빨라진다', () => {
  assert.deepStrictEqual(
    C.STAGES.map((st) => st.d),
    [5, 10, 15, 20]
  );
  for (let si = 1; si < C.STAGES.length; si++) assert.ok(C.STAGES[si].speed > C.STAGES[si - 1].speed);
});

test('점프마다 누를 수 있는 때가 난이도별 최소 시간보다 길다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const st = C.STAGES[si];
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
      assert.ok(window >= st.jumpNeed - 0.02, `${si + 1}단계 ${i}번째 점프 여유가 ${window.toFixed(2)}초뿐이에요 (기준 ${st.jumpNeed.toFixed(2)}초)`);
    }
  }
});

test('거미줄 구간은 누르는 때와 떼는 때가 조금 달라도 난이도별 기준만큼 건널 수 있다', () => {
  for (let si = 0; si < C.STAGES.length; si++) {
    const st = C.STAGES[si];
    const level = C.buildLevel(si);
    const base = Object.assign({}, level, { candies: [], goalX: Infinity });
    for (let i = 0; i < level.roofs.length - 1; i++) {
      const A = level.roofs[i];
      const B = level.roofs[i + 1];
      const inGap = level.anchors.filter((a) => a.x > A.x1 && a.x < B.x0);
      if (!inGap.length) continue;
      const startX = Math.max(A.x0 + 10, A.x1 - 160);
      let ok = 0;
      let total = 0;
      for (const web of [-400, -250, -100, 50, 200]) {
        for (const rel of [0, 0.2, 0.4, 0.6, 0.8]) {
          const acts = [P.pressAt(A.x1 - 12), P.tap(), P.webWhen(web), P.releaseAt(rel)];
          for (let k = 1; k < inGap.length; k++) acts.push(P.webWhen(-60), P.releaseAt(0.45));
          total++;
          if (C.simulate(base, i, startX, acts, i + 1, 9).ok) ok++;
        }
      }
      // 레벨을 만들 때는 뒤 구간이 없는 상태로 재므로 조금 여유를 둡니다
      assert.ok(ok / total >= st.swingNeed - 0.12, `${si + 1}단계 ${i}번째 거미줄 구간 성공률이 ${Math.round((100 * ok) / total)}%예요`);
    }
  }
});

/** 조금씩 틀리게 누르는 아이를 흉내 내어, 한 번뿐인 기회로 단계를 끝내는지 봅니다.
    noise: 손 떨림 (1 = 보통 아이, 1/3 = 아주 잘하는 아이) */
function kidRun(si, seed, noise = 1, lives = 1) {
  const level = C.buildLevel(si);
  const world = C.createWorld(level);
  const h = world.hero;
  let a = seed | 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const fresh = () => ({ web: -60 + gauss() * 0.12 * noise * C.G, rel: 0.45 + gauss() * 0.35 * noise });
  let held = false;
  let heldFor = 0;
  let plan = null;
  let planFor = -1;
  let falls = 0;
  for (let t = 0; t < 300; t += C.DT) {
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
    if (h.state === 'ready') h.state = 'run';
    if (h.state === 'run') {
      if (held && heldFor > 0.09) release();
      const i = level.roofs.findIndex((r) => h.x >= r.x0 - 12 && h.x <= r.x1 + 12);
      const A = level.roofs[i];
      const B = level.roofs[i + 1];
      if (A && B && !held) {
        if (planFor !== i) {
          planFor = i;
          let jx = A.x1 - 12;
          if (!level.anchors.some((an) => an.x > A.x1 && an.x < B.x0)) {
            const air = (C.JUMP_V + Math.sqrt(C.JUMP_V * C.JUMP_V + 2 * C.G * (B.top - A.top))) / C.G;
            const D = level.speed * air;
            jx = Math.min(A.x1, B.x0 + Math.min((D - (B.x0 - A.x1)) / 2, (B.x1 - B.x0) / 2) - D);
          }
          plan = Object.assign(fresh(), { jx: jx + gauss() * 0.09 * noise * level.speed });
        }
        if (h.x >= plan.jx) press();
      }
    } else if (h.state === 'air') {
      if (held && heldFor > 0.09) release();
      else if (!held && plan && h.vy >= plan.web && C.findAnchor(level, h) >= 0) press();
    } else if (h.state === 'swing' && C.ropeAngle(h) >= plan.rel) {
      release();
      plan = Object.assign(plan, fresh());
    }
    C.step(world, { pressed, released, held }, C.DT);
    for (const e of world.events) {
      if (e.type === 'goal') return true;
      if (e.type === 'fall') {
        falls++;
        if (falls >= lives) return false;
        C.respawn(world);
        held = false;
        planFor = -1;
      }
    }
    world.events.length = 0;
  }
  return false;
}

test('기회 한 번: 단계가 오를수록 끝내기 어려워지고, 아주 잘하는 아이는 마지막 단계도 할 수 있다', () => {
  const N = 40;
  const rates = (noise) =>
    C.STAGES.map((st, si) => {
      let ok = 0;
      for (let s = 1; s <= N; s++) if (kidRun(si, s * 7919 + si, noise)) ok++;
      return ok / N;
    });
  const kid = rates(1);
  const pro = rates(1 / 3);
  const shown = 'Kid ' + kid.map((r) => Math.round(r * 100) + '%').join(', ') + ' / pro ' + pro.map((r) => Math.round(r * 100) + '%').join(', ');
  assert.ok(kid[0] >= 0.2 && kid[0] <= 0.75, `1단계(난이도 5)가 맞지 않아요 (${shown})`);
  assert.ok(kid[1] <= 0.25, `2단계(난이도 10)가 너무 쉬워요 (${shown})`);
  assert.ok(pro[0] >= 0.8, `잘하는 아이에게 1단계가 너무 어려워요 (${shown})`);
  assert.ok(pro[3] >= 0.05 && pro[3] <= 0.4, `4단계(난이도 20)가 맞지 않아요 (${shown})`);
  for (const r of [kid, pro]) for (let i = 1; i < r.length; i++) assert.ok(r[i] <= r[i - 1] + 0.15, `${i + 1}단계가 앞 단계보다 쉬워요 (${shown})`);
});

test('사탕 점수: 사탕 5점, 황금 별사탕은 단계마다 커진다', () => {
  const l1 = C.buildLevel(0);
  const l6 = C.buildLevel(C.STAGES.length - 1);
  assert.strictEqual(C.CANDY_POINTS, 5);
  assert.ok(l6.goldPoints > l1.goldPoints);
  const run = playStage(0);
  const w = run.world;
  assert.strictEqual(w.score, w.candies * 5 + w.golds * l1.goldPoints);
});
