/* 호박분투 — 규칙과 물리
   화면 그리기와 떨어져 있어서 Node에서도 돌아갑니다 (tests/ 의 자동 검사가 이 파일을 씁니다).

   원작 고군분투의 규칙을 따릅니다.
   - 주인공은 저절로 달립니다. 누르면 점프.
   - 공중에서 한 번 더 누르면 거미줄(원작의 와이어)을 걸어 그네처럼 날아갑니다.
   - 누르고 있는 동안 매달리고, 떼면 날아갑니다. 너무 오래 매달리면 저절로 공중제비를 돌며 놓습니다.
   - 사탕(원작의 은화) 5점, 황금 별사탕(원작의 금화)은 단계마다 점수가 다르고, 한 단계의 황금 별사탕을 모두 모으면 +200. */
(function (root) {
  'use strict';

  const W = 960;
  const H = 540;
  const G = 2000; // 중력 (px/s²)
  const JUMP_V = 760; // 점프 속도 → 약 144px 높이
  const HALF_W = 13;
  const HALF_H = 25; // 발끝 = y + HALF_H
  const WEB_RANGE = 340; // 거미줄이 닿는 거리
  const ROPE_MAX = 200; // 더 먼 등불에 걸면 이 길이까지 감아 당깁니다
  const REEL_SPEED = 700;
  const PUMP = 250; // 그네를 앞으로 밀어 주는 힘
  const MAX_HOLD = 1.25; // 이보다 오래 매달리면 저절로 공중제비
  const AUTO_ANGLE = 1.13; // 앞쪽으로 약 65° 넘게 올라가도 공중제비
  const COYOTE = 0.1; // 지붕 끝을 막 지나쳐도 잠깐은 점프 가능
  const BUFFER = 0.12; // 착지 직전에 누른 점프도 받아 줍니다
  const LEDGE = 14; // 지붕 모서리에 살짝 못 미쳐도 올려 줍니다
  const PICK_R = 28;
  const TOP_MIN = 370;
  const TOP_MAX = 470;
  const DT = 1 / 120;

  const CANDY_POINTS = 5;
  const ALL_GOLD_BONUS = 200;
  const CLEAR_BONUS = 100;

  /* 단계 구성: 원작처럼 6단계, 갈수록 빨라집니다. 4단계는 연속 거미줄 연습 단계. */
  const STAGES = [
    { name: '호박 마을', speed: 300, seed: 1031, golds: 3, mix: { jump: 11, swing: 3 }, reach: [40, 80], roof: [300, 540] },
    { name: '박쥐 골목', speed: 330, seed: 2203, golds: 4, mix: { jump: 11, swing: 4, hops: 1 }, reach: [50, 100], roof: [270, 500] },
    { name: '마녀의 지붕', speed: 360, seed: 3307, golds: 4, mix: { jump: 10, swing: 4, double: 1, hops: 1 }, reach: [60, 120], roof: [250, 470] },
    { name: '유령 시계탑', speed: 390, seed: 4409, golds: 5, mix: { jump: 7, swing: 3, double: 3, hops: 1 }, reach: [70, 130], roof: [240, 450] },
    { name: '해골 성벽', speed: 420, seed: 5501, golds: 5, mix: { jump: 10, swing: 4, double: 2, hops: 2 }, reach: [80, 150], roof: [230, 430] },
    { name: '달빛 대저택', speed: 450, seed: 6607, golds: 6, mix: { jump: 10, swing: 4, double: 3, hops: 2 }, reach: [90, 160], roof: [220, 420] },
  ];

  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------------- 물리 ---------------- */

  function createWorld(level) {
    const r0 = level.roofs[0];
    return {
      level,
      t: 0,
      hero: {
        x: 120,
        y: r0.top - HALF_H,
        vx: level.speed,
        vy: 0,
        state: 'run', // run | air | swing | fallen | goal | ready
        coyote: 0,
        buffer: 0,
        jumped: false,
        rope: null,
        holdT: 0,
        flipT: 0,
        missT: 0,
        roof: 0,
        safeRoof: 0,
      },
      events: [],
      score: 0,
      candies: 0,
      golds: 0,
    };
  }

  function emit(world, type, data) {
    world.events.push(Object.assign({ type }, data));
  }

  /** 발밑 지붕. 내려앉을 때와 같은 기준: 몸이 지붕에 조금이라도 걸쳐 있으면 서 있습니다. */
  function roofUnder(level, x) {
    const roofs = level.roofs;
    const grace = HALF_W - 1;
    for (let i = 0; i < roofs.length; i++) {
      const r = roofs[i];
      if (x < r.x0 - grace) return -1;
      if (x <= r.x1 + grace) return i;
    }
    return -1;
  }

  function ropeAngle(h) {
    return h.rope ? Math.atan2(h.x - h.rope.ax, h.y - h.rope.ay) : 0;
  }

  function jump(world) {
    const h = world.hero;
    h.vy = -JUMP_V;
    h.state = 'air';
    h.jumped = true;
    h.coyote = 0;
    h.buffer = 0;
    emit(world, 'jump');
  }

  /** 앞쪽 위에 있는 가장 가까운 등불을 찾습니다. 없으면 -1. */
  function findAnchor(level, h) {
    let best = -1;
    let bestX = Infinity;
    const list = level.anchors;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.x < h.x + 8 || a.y > h.y - 20) continue;
      if (Math.hypot(a.x - h.x, a.y - h.y) > WEB_RANGE) continue;
      if (a.x < bestX) {
        bestX = a.x;
        best = i;
      }
    }
    return best;
  }

  function tryWeb(world) {
    const h = world.hero;
    if (h.missT > 0) return;
    const i = findAnchor(world.level, h);
    if (i < 0) {
      h.missT = 0.3;
      emit(world, 'webMiss');
      return;
    }
    const a = world.level.anchors[i];
    h.rope = { i, ax: a.x, ay: a.y, len: Math.hypot(a.x - h.x, a.y - h.y) };
    h.state = 'swing';
    h.holdT = 0;
    h.buffer = 0;
    emit(world, 'web', { anchor: i });
  }

  function release(world, auto) {
    const h = world.hero;
    h.rope = null;
    h.state = 'air';
    h.jumped = true;
    if (auto) {
      h.flipT = 0.5;
      h.vy = Math.min(h.vy, -330);
      h.vx = Math.max(h.vx, world.level.speed * 0.8);
    } else {
      h.vy -= 40;
    }
    emit(world, auto ? 'flip' : 'release');
  }

  function land(world, i) {
    const h = world.hero;
    const r = world.level.roofs[i];
    h.y = r.top - HALF_H;
    h.vy = 0;
    h.vx = world.level.speed;
    h.state = 'run';
    h.rope = null;
    h.jumped = false;
    h.roof = i;
    if (r.x1 - r.x0 >= 240) h.safeRoof = i;
    emit(world, 'land');
  }

  /** 지붕에 내려앉기, 벽에 부딪히기 */
  function collide(world, px, py) {
    const h = world.hero;
    const roofs = world.level.roofs;
    const prevFeet = py + HALF_H;
    for (let i = 0; i < roofs.length; i++) {
      const r = roofs[i];
      if (r.x0 > h.x + 40) break;
      if (h.x + HALF_W - 1 < r.x0 || h.x - HALF_W + 1 > r.x1) continue;
      const feet = h.y + HALF_H;
      if (feet <= r.top) continue;
      if (h.vy >= 0 && prevFeet <= r.top + 1) {
        land(world, i);
        return;
      }
      if (feet - r.top <= LEDGE && h.vy > -120) {
        land(world, i);
        return;
      }
      // 옆벽에 쿵
      if (px <= r.x0) {
        h.x = r.x0 - HALF_W - 0.01;
        h.vx = -40;
      } else {
        h.x = r.x1 + HALF_W + 0.01;
        h.vx = 40;
      }
      if (h.state === 'swing') {
        h.rope = null;
        h.state = 'air';
      }
      emit(world, 'bonk');
      return;
    }
  }

  function stepRun(world, dt) {
    const h = world.hero;
    const lv = world.level;
    h.vx = lv.speed;
    if (h.buffer > 0) {
      jump(world);
      stepAir(world, NO_INPUT, dt);
      return;
    }
    h.x += h.vx * dt;
    const i = roofUnder(lv, h.x);
    if (i < 0) {
      h.state = 'air';
      h.vy = 0;
      h.coyote = COYOTE;
      h.jumped = false;
    } else {
      h.y = lv.roofs[i].top - HALF_H;
      h.roof = i;
    }
  }

  function stepAir(world, input, dt) {
    const h = world.hero;
    if (input.pressed) {
      if (h.coyote > 0 && !h.jumped) jump(world);
      else tryWeb(world);
      if (h.state === 'swing') {
        stepSwing(world, input, dt);
        return;
      }
    }
    h.coyote = Math.max(0, h.coyote - dt);
    const px = h.x;
    const py = h.y;
    h.vy = Math.min(h.vy + G * dt, 1400);
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (h.y < HALF_H + 4) {
      h.y = HALF_H + 4;
      if (h.vy < 0) h.vy = 0;
    }
    collide(world, px, py);
  }

  function stepSwing(world, input, dt) {
    const h = world.hero;
    const r = h.rope;
    h.holdT += dt;
    const ang = ropeAngle(h);
    if (!input.held) {
      release(world, false);
      stepAir(world, NO_INPUT, dt);
      return;
    }
    if (h.holdT >= MAX_HOLD || (ang > AUTO_ANGLE && h.vy < 0)) {
      release(world, true);
      stepAir(world, NO_INPUT, dt);
      return;
    }
    if (r.len > ROPE_MAX) r.len = Math.max(ROPE_MAX, r.len - REEL_SPEED * dt);
    const px = h.x;
    const py = h.y;
    h.vy += G * dt;
    h.vx += Math.cos(ang) * PUMP * dt;
    h.vy -= Math.sin(ang) * PUMP * dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    const dx = h.x - r.ax;
    const dy = h.y - r.ay;
    const d = Math.hypot(dx, dy) || 1;
    let taut = false;
    if (d >= r.len) {
      h.x = r.ax + (dx / d) * r.len;
      h.y = r.ay + (dy / d) * r.len;
      taut = true;
    }
    h.vx = (h.x - px) / dt;
    h.vy = (h.y - py) / dt;
    if (taut) {
      // 팽팽한 줄은 바깥/안쪽으로 움직이지 않습니다: 줄 방향 속도는 버립니다
      const nx = dx / d;
      const ny = dy / d;
      const vr = h.vx * nx + h.vy * ny;
      h.vx -= vr * nx;
      h.vy -= vr * ny;
    }
    collide(world, px, py);
  }

  function collect(world) {
    const h = world.hero;
    const lv = world.level;
    const list = lv.candies;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.taken) continue;
      const dx = c.x - h.x;
      if (dx > PICK_R || dx < -PICK_R) continue;
      const dy = c.y - h.y;
      if (dx * dx + dy * dy > PICK_R * PICK_R) continue;
      c.taken = true;
      const points = c.gold ? lv.goldPoints : CANDY_POINTS;
      world.score += points;
      if (c.gold) world.golds++;
      else world.candies++;
      emit(world, 'candy', { gold: c.gold, x: c.x, y: c.y, points });
    }
  }

  const NO_INPUT = { pressed: false, released: false, held: false };

  /** 1/120초 진행. input = { pressed, released, held } (pressed/released는 이번 순간에 바뀐 것) */
  function step(world, input, dt) {
    const h = world.hero;
    dt = dt || DT;
    world.t += dt;
    if (h.flipT > 0) h.flipT = Math.max(0, h.flipT - dt);
    if (h.missT > 0) h.missT = Math.max(0, h.missT - dt);
    h.buffer = input.pressed ? BUFFER : Math.max(0, h.buffer - dt);

    if (h.state === 'run') stepRun(world, dt);
    else if (h.state === 'air') stepAir(world, input, dt);
    else if (h.state === 'swing') stepSwing(world, input, dt);
    else return;

    collect(world);
    if (h.x >= world.level.goalX && h.y < H) {
      h.state = 'goal';
      h.rope = null;
      emit(world, 'goal');
    } else if (h.y - HALF_H > H + 40) {
      h.state = 'fallen';
      h.rope = null;
      emit(world, 'fall');
    }
  }

  /** 떨어진 뒤 마지막으로 밟은 넓은 지붕에서 다시 시작합니다. */
  function respawn(world) {
    const h = world.hero;
    const r = world.level.roofs[h.safeRoof];
    h.x = h.safeRoof === 0 ? 120 : r.x0 + 40;
    h.y = r.top - HALF_H;
    h.vx = world.level.speed;
    h.vy = 0;
    h.state = 'ready';
    h.rope = null;
    h.roof = h.safeRoof;
    h.flipT = 0;
    h.missT = 0;
    h.buffer = 0;
    h.coyote = 0;
    h.jumped = false;
  }

  /* ---------------- 정해진 조작으로 미리 달려 보기 ----------------
     레벨을 만들 때 각 구간이 정말 건널 수 있는지 확인하고, 그 길을 따라 사탕을 놓습니다. */
  function simulate(level, startRoof, startX, actions, targetRoof, maxT) {
    const world = createWorld(level);
    const h = world.hero;
    h.x = startX;
    h.y = level.roofs[startRoof].top - HALF_H;
    h.roof = startRoof;
    h.safeRoof = startRoof;
    const path = [];
    let held = false;
    let ai = 0;
    let since = 0;
    const limit = maxT || 6;
    for (let t = 0; t < limit; t += DT) {
      let pressed = false;
      let released = false;
      if (ai < actions.length && actions[ai].when(h, since)) {
        const a = actions[ai];
        if (a.do === 'press' && !held) {
          pressed = true;
          held = true;
        } else if (a.do === 'release' && held) {
          released = true;
          held = false;
        }
        ai++;
        since = 0;
      } else {
        since += DT;
      }
      step(world, { pressed, released, held }, DT);
      path.push({ x: h.x, y: h.y, s: h.state });
      for (const e of world.events) {
        if (e.type === 'bonk' || e.type === 'fall') return { ok: false, why: e.type, path };
      }
      world.events.length = 0;
      if (h.state === 'run' && h.roof === targetRoof && ai >= actions.length) return { ok: true, path };
      if (h.state === 'run' && h.roof > targetRoof) return { ok: false, why: 'overshoot', path };
    }
    return { ok: false, why: 'timeout', path };
  }

  const P = {
    pressAt: (x) => ({ when: (h) => h.state === 'run' && h.x >= x, do: 'press' }),
    tap: () => ({ when: (h, s) => s >= 0.08, do: 'release' }),
    webWhen: (vy) => ({ when: (h) => h.state === 'air' && h.vy >= vy, do: 'press' }),
    releaseAt: (ang) => ({ when: (h) => h.state !== 'swing' || ropeAngle(h) >= ang, do: 'release' }),
  };

  /* ---------------- 레벨 만들기 ---------------- */

  function flightTime(dh) {
    // 점프해서 dh만큼 아래(+)/위(-) 지붕에 닿기까지 걸리는 시간
    return (JUMP_V + Math.sqrt(Math.max(0, JUMP_V * JUMP_V + 2 * G * dh))) / G;
  }

  function makeOrder(st, rnd) {
    const bag = [];
    Object.keys(st.mix).forEach((k) => {
      for (let i = 0; i < st.mix[k]; i++) bag.push(k);
    });
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    // 처음 두 구간은 몸풀기 점프, 거미줄 구간은 붙여 놓지 않습니다
    const order = [];
    const rest = bag.slice();
    order.push('jump', 'jump');
    for (let n = 0; n < 2; n++) {
      const k = rest.indexOf('jump');
      if (k >= 0) rest.splice(k, 1);
    }
    while (rest.length) {
      const prev = order[order.length - 1];
      let k = 0;
      if (prev !== 'jump') {
        const j = rest.indexOf('jump');
        if (j >= 0) k = j;
      }
      order.push(rest.splice(k, 1)[0]);
    }
    return order;
  }

  /** 한 구간(틈 + 다음 지붕들)을 만들어 봅니다. 성공하면 레벨에 붙입니다. */
  function trySegment(level, type, st, rnd, si) {
    const v = st.speed;
    const R = (a, b) => a + (b - a) * rnd();
    const ia = level.roofs.length - 1;
    const A = level.roofs[ia];
    const E = A.x1;
    const top = A.top;
    const roofs = [];
    const anchors = [];
    const actions = [];

    const roofLen = (long) =>
      long ? R(Math.max(st.roof[0], 360), Math.max(st.roof[1], 520)) : R(st.roof[0], st.roof[1]);

    if (type === 'jump') {
      const nt = clamp(top + R(-45, 55), TOP_MIN, TOP_MAX);
      const deff = v * flightTime(nt - top);
      const gap = Math.max(60, deff * R(0.28, 0.55 + 0.02 * si));
      // 지붕 끝에서 늦게 뛰어도 내려앉은 뒤 60px은 더 달릴 수 있게
      const len = Math.max(roofLen(false), deff - gap + 60);
      actions.push(P.pressAt(E - Math.max(6, (deff - gap) / 2)), P.tap());
      roofs.push({ x0: E + gap, x1: E + gap + len, top: nt });
    } else if (type === 'hops') {
      // 좁은 지붕 징검다리: 좁은 지붕 위에서는 언제 뛰어도 다음 지붕에 닿도록 틈을 맞춥니다
      const count = rnd() < 0.5 ? 2 : 3;
      let x = E;
      let t0 = top;
      let prevLen = 0;
      for (let k = 0; k <= count; k++) {
        const last = k === count;
        const nt = clamp(t0 + R(-40, 45), TOP_MIN, TOP_MAX);
        const deff = v * flightTime(nt - t0);
        const gap = k === 0 ? Math.max(60, deff * R(0.3, 0.42)) : deff - prevLen - 25;
        if (gap < 60) return null;
        const len = last ? Math.max(roofLen(false), deff - gap + 60) : R(130, 160) + k * 30;
        const x0 = x + gap;
        const landAt = last ? x0 + Math.min((deff - gap) / 2, len / 2) : x0 + len / 2;
        actions.push(P.pressAt(Math.min(x, landAt - deff)), P.tap());
        roofs.push({ x0, x1: x0 + len, top: nt });
        x = x0 + len;
        t0 = nt;
        prevLen = len;
      }
    } else {
      const doubles = type === 'double';
      const nt = clamp(top + R(-30, 40), TOP_MIN, TOP_MAX);
      const high = Math.min(top, nt);
      const apexX = E - 12 + (v * JUMP_V) / G;
      const ax1 = apexX + R(140, 175);
      const ay1 = Math.max(95, high - (ROPE_MAX + HALF_H + R(28, 45)));
      anchors.push({ x: ax1, y: ay1 });
      actions.push(P.pressAt(E - 12), P.tap(), P.webWhen(-60), P.releaseAt(R(0.35, 0.55)));
      let lastX = ax1;
      if (doubles) {
        const ax2 = ax1 + R(290, 335);
        const ay2 = clamp(ay1 + R(-25, 25), 95, high - (ROPE_MAX + HALF_H + 28));
        anchors.push({ x: ax2, y: ay2 });
        actions.push(P.webWhen(-60), P.releaseAt(R(0.35, 0.5)));
        lastX = ax2;
      }
      const x0 = lastX + R(st.reach[0], st.reach[1]);
      roofs.push({ x0, x1: x0 + roofLen(true), top: nt });
    }

    // 미리 달려 보기
    const trial = {
      level: { speed: v, roofs: level.roofs.concat(roofs), anchors: level.anchors.concat(anchors), candies: [], goalX: Infinity, goldPoints: 0 },
    };
    const startX = Math.max(A.x0 + 10, E - 160);
    const target = ia + roofs.length;
    const run = simulate(trial.level, ia, startX, actions, target, 8);
    if (!run.ok) return null;

    // 사람이 조금 다르게 눌러도 되는지 (거미줄 구간만)
    if (type === 'swing' || type === 'double') {
      let wins = 0;
      const webTimes = [-260, -60, 140];
      const rels = [0.15, 0.45, 0.8];
      for (const w of webTimes) {
        for (const rl of rels) {
          const acts = [P.pressAt(E - 12), P.tap(), P.webWhen(w), P.releaseAt(rl)];
          if (type === 'double') acts.push(P.webWhen(-60), P.releaseAt(0.45));
          if (simulate(trial.level, ia, startX, acts, target, 8).ok) wins++;
        }
      }
      if (wins < (type === 'double' ? 3 : 5)) return null;
    }
    return { roofs, anchors, path: run.path, type };
  }

  function placeCandies(level, seg, wantGold) {
    // 공중 경로를 따라 66px마다 사탕, 마지막으로 날아오른 곳의 꼭대기에 황금 별사탕
    const air = seg.path.filter((p) => p.s === 'air' || p.s === 'swing');
    if (air.length < 8) return 0;
    let from = 0;
    if (seg.type === 'swing' || seg.type === 'double') {
      for (let i = 1; i < air.length; i++) if (air[i].s === 'air' && air[i - 1].s === 'swing') from = i;
    }
    let apex = from;
    for (let i = from; i < air.length; i++) if (air[i].y < air[apex].y) apex = i;
    if (wantGold) level.candies.push({ x: air[apex].x, y: air[apex].y, gold: true, taken: false });
    let acc = 0;
    let placed = 0;
    for (let i = 1; i < air.length - 6; i++) {
      acc += Math.hypot(air[i].x - air[i - 1].x, air[i].y - air[i - 1].y);
      if (acc < 66) continue;
      if (wantGold && Math.hypot(air[i].x - air[apex].x, air[i].y - air[apex].y) < 44) continue;
      level.candies.push({ x: air[i].x, y: air[i].y, gold: false, taken: false, kind: placed % 4 });
      placed++;
      acc = 0;
    }
    return wantGold ? 1 : 0;
  }

  function roofRow(level, r, k) {
    const from = r.x0 + 70;
    const to = r.x1 - 160;
    const n = Math.min(4, Math.floor((to - from) / 48) + 1);
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      level.candies.push({ x: from + i * 48, y: r.top - HALF_H - 2, gold: false, taken: false, kind: (k + i) % 4 });
    }
  }

  function buildLevel(si) {
    const st = STAGES[si];
    const rnd = rng(st.seed);
    const level = {
      stage: si,
      name: st.name,
      speed: st.speed,
      roofs: [],
      anchors: [],
      candies: [],
      goalX: 0,
      end: 0,
      goldPoints: 30 * (si + 1),
      goldTotal: 0,
    };
    level.roofs.push({ x0: -400, x1: 700, top: 430 });
    roofRow(level, { x0: 200, x1: 700, top: 430 }, 0);

    const order = makeOrder(st, rnd);
    const segs = [];
    order.forEach((type) => {
      let seg = null;
      for (let attempt = 0; attempt < 16 && !seg; attempt++) seg = trySegment(level, type, st, rnd, si);
      if (!seg) {
        for (let attempt = 0; attempt < 16 && !seg; attempt++) seg = trySegment(level, 'jump', st, rnd, si);
      }
      if (!seg) throw new Error('호박분투: 구간을 만들 수 없어요 (' + st.name + ')');
      level.roofs.push(...seg.roofs);
      level.anchors.push(...seg.anchors);
      segs.push(seg);
    });

    // 황금 별사탕: 거미줄 구간을 먼저, 모자라면 점프 구간에서 골고루
    const swingIdx = segs.map((s, i) => (s.type === 'swing' || s.type === 'double' ? i : -1)).filter((i) => i >= 0);
    const jumpIdx = segs.map((s, i) => (s.type === 'jump' || s.type === 'hops' ? i : -1)).filter((i) => i >= 2);
    const goldSet = new Set();
    const pickSpread = (list, n) => {
      for (let k = 0; k < n && k < list.length; k++) goldSet.add(list[Math.floor(((k + 0.5) * list.length) / n)]);
    };
    pickSpread(swingIdx, Math.min(st.golds, swingIdx.length));
    pickSpread(jumpIdx, st.golds - goldSet.size);

    segs.forEach((seg, i) => {
      level.goldTotal += placeCandies(level, seg, goldSet.has(i));
      seg.roofs.forEach((r, k) => {
        if (r.x1 - r.x0 >= 300 && (i + k) % 2 === 0) roofRow(level, r, i + k);
      });
    });

    // 마지막: 파티장 지붕
    const last = level.roofs[level.roofs.length - 1];
    const gap = Math.max(70, st.speed * 0.3);
    const finalRoof = { x0: last.x1 + gap, x1: last.x1 + gap + 1300, top: 430, final: true };
    // 마지막 점프도 확인
    const run = simulate(
      { speed: st.speed, roofs: level.roofs.concat([finalRoof]), anchors: level.anchors, candies: [], goalX: Infinity, goldPoints: 0 },
      level.roofs.length - 1,
      Math.max(last.x0 + 10, last.x1 - 160),
      [P.pressAt(last.x1 - Math.max(6, (st.speed * flightTime(430 - last.top) - gap) / 2)), P.tap()],
      level.roofs.length,
      6
    );
    if (!run.ok) throw new Error('호박분투: 마지막 지붕에 닿을 수 없어요 (' + st.name + ')');
    level.roofs.push(finalRoof);
    level.goalX = finalRoof.x0 + 460;
    level.end = finalRoof.x1;
    level.candies.sort((a, b) => a.x - b.x);
    level.candies = level.candies.filter((c, i, list) => {
      if (c.gold) return true;
      for (let j = i - 1; j >= 0 && list[j].x > c.x - 26; j--) {
        if (Math.hypot(list[j].x - c.x, list[j].y - c.y) < 26) return false;
      }
      for (let j = i + 1; j < list.length && list[j].x < c.x + 26; j++) {
        if (list[j].gold && Math.hypot(list[j].x - c.x, list[j].y - c.y) < 26) return false;
      }
      return true;
    });
    return level;
  }

  const api = {
    W,
    H,
    G,
    JUMP_V,
    HALF_W,
    HALF_H,
    WEB_RANGE,
    MAX_HOLD,
    DT,
    STAGES,
    CANDY_POINTS,
    ALL_GOLD_BONUS,
    CLEAR_BONUS,
    buildLevel,
    createWorld,
    step,
    respawn,
    findAnchor,
    ropeAngle,
    simulate,
    policy: P,
  };
  root.HobakCore = api;
})(typeof module === 'object' && module.exports ? module.exports : window);
