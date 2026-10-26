/* 죽림고스트 — 규칙과 화살 무늬
   화면 그리기와 떨어져 있어서 Node에서도 돌아갑니다 (tests/ 의 자동 검사가 이 파일을 씁니다).

   원작 죽림고수의 규칙을 따릅니다.
   - 사방에서 날아오는 화살을 방향키로 피하며 최대한 오래 버팁니다. 점수는 버틴 시간.
   - 화살촉 끝만 위험하고 화살대와 깃은 닿아도 괜찮습니다.
   - 시간이 지날수록 화살이 빨라지고 날아오는 무늬가 복잡해집니다. */
(function (root) {
  'use strict';

  const W = 960;
  const H = 540;
  const GHOST_R = 13; // 맞는 범위 (그림보다 작게 잡아 억울하지 않게)
  const TIP_R = 4;
  const HIT = GHOST_R + TIP_R;
  const NEAR = HIT + 16; // 이만큼 스치면 "아슬!"
  const MOVE = 270; // 유령 속도 px/s
  const DRAG_MAX = MOVE * 1.4;
  const EDGE = 24; // 유령이 갈 수 있는 화면 가장자리 여백
  const OUT = 8; // 화살이 처음 나타나는 곳: 화면 바로 바깥
  const BASE_SPEED = 240;
  const WARN = 0.45; // 화살이 들어오기 전에 화면 가장자리에 미리 알려 주는 시간 (초)
  const DT = 1 / 120;

  /* 레벨이 오르는 시각 (초) */
  const LEVEL_AT = [0, 10, 20, 35, 50, 70];

  /* 무늬마다: cost = 다음 무늬까지 쉬는 정도, w = 레벨별 나올 비율 */
  const PATTERNS = {
    aimed: { cost: 0.55, w: [5, 4, 3, 3, 2, 2] },
    straight: { cost: 0.45, w: [3, 3, 2, 2, 2, 2] },
    volley3: { cost: 1.0, w: [0, 3, 3, 2, 2, 2] },
    fan3: { cost: 0.9, w: [0, 3, 3, 2, 2, 2] },
    snipe: { cost: 0.8, w: [0, 0, 2, 2, 2, 2] },
    cross: { cost: 1.2, w: [0, 0, 2, 2, 2, 2] },
    sweep: { cost: 1.4, w: [0, 0, 2, 2, 2, 2] },
    volley5: { cost: 1.3, w: [0, 0, 0, 2, 2, 3] },
    fan5: { cost: 1.2, w: [0, 0, 0, 2, 2, 3] },
    wall: { cost: 1.7, w: [0, 0, 0, 2, 2, 3] },
    ring: { cost: 1.8, w: [0, 0, 0, 0, 2, 3] },
  };
  const INTERVAL = [0.95, 0.88, 0.8, 0.74, 0.68, 0.6];

  const TITLES = [
    [10, '아기 유령'],
    [20, '꼬마 유령'],
    [30, '날쌘 유령'],
    [45, '죽림 고수'],
    [60, '죽림 달인'],
    [90, '전설의 고스트'],
    [Infinity, '할로윈의 신'],
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

  function createWorld(seed) {
    return {
      t: 0,
      ghost: { x: W / 2, y: H / 2 + 20, vx: 0, vy: 0 },
      arrows: [],
      next: 1.2,
      alive: true,
      dodged: 0,
      near: 0,
      level: 1,
      rnd: rng(seed == null ? (Math.random() * 1e9) | 0 : seed),
      events: [],
    };
  }

  function levelOf(world) {
    let lv = 1;
    for (let i = 0; i < LEVEL_AT.length; i++) if (world.t >= LEVEL_AT[i]) lv = i + 1;
    return lv;
  }

  function arrowSpeed(world) {
    return BASE_SPEED * (1 + 0.007 * Math.min(world.t, 120));
  }

  /* ---------------- 화살 만들기 ---------------- */

  /** side: 0 왼쪽, 1 오른쪽, 2 위, 3 아래. k: 변을 따라 0~1 */
  function edgePoint(side, k) {
    const pad = 30;
    if (side === 0) return { x: -OUT, y: pad + k * (H - 2 * pad), nx: 1, ny: 0 };
    if (side === 1) return { x: W + OUT, y: pad + k * (H - 2 * pad), nx: -1, ny: 0 };
    if (side === 2) return { x: pad + k * (W - 2 * pad), y: -OUT, nx: 0, ny: 1 };
    return { x: pad + k * (W - 2 * pad), y: H + OUT, nx: 0, ny: -1 };
  }

  /** 유령 위치를 그 변에 비춘 비율 (0~1) */
  function along(side, g) {
    const pad = 30;
    return side < 2 ? clamp((g.y - pad) / (H - 2 * pad), 0, 1) : clamp((g.x - pad) / (W - 2 * pad), 0, 1);
  }

  function add(world, x, y, angle, speed, delay, kind) {
    world.arrows.push({
      x,
      y,
      angle,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      delay,
      warn: delay,
      kind: kind || 'normal',
      inside: false,
      near: false,
    });
  }

  function aimAngle(x, y, g, jitter) {
    return Math.atan2(g.y - y, g.x - x) + jitter;
  }

  function spawn(world, name) {
    const r = world.rnd;
    const g = world.ghost;
    const v = arrowSpeed(world);
    const warn = WARN;
    const side = Math.floor(r() * 4);
    const J = (s) => (r() - 0.5) * 2 * s;

    switch (name) {
      case 'aimed': {
        const p = edgePoint(side, r());
        add(world, p.x, p.y, aimAngle(p.x, p.y, g, J(0.12)), v, warn);
        break;
      }
      case 'straight': {
        const p = edgePoint(side, r());
        add(world, p.x, p.y, Math.atan2(p.ny, p.nx) + J(0.3), v * 1.05, warn);
        break;
      }
      case 'snipe': {
        const p = edgePoint(side, r());
        add(world, p.x, p.y, aimAngle(p.x, p.y, g, 0), v * 1.6, warn + 0.25, 'fast');
        break;
      }
      case 'volley3':
      case 'volley5': {
        const n = name === 'volley3' ? 3 : 5;
        const gap = 72;
        const c = along(side, g);
        const span = side < 2 ? H - 60 : W - 60;
        const ang = Math.atan2(edgePoint(side, 0).ny, edgePoint(side, 0).nx);
        const shift = J(0.5) * gap;
        for (let i = 0; i < n; i++) {
          const k = c + ((i - (n - 1) / 2) * gap + shift) / span;
          if (k < -0.02 || k > 1.02) continue;
          const p = edgePoint(side, k);
          add(world, p.x, p.y, ang, v, warn);
        }
        break;
      }
      case 'fan3':
      case 'fan5': {
        const n = name === 'fan3' ? 3 : 5;
        const spread = name === 'fan3' ? 0.22 : 0.18;
        const p = edgePoint(side, r());
        const base = aimAngle(p.x, p.y, g, J(0.05));
        for (let i = 0; i < n; i++) add(world, p.x, p.y, base + (i - (n - 1) / 2) * spread, v * 0.95, warn);
        break;
      }
      case 'cross':
      case 'ring': {
        // 여러 방향에서 같은 순간에 지금 유령 자리로 모입니다 (조금만 비켜도 피할 수 있어요)
        const dirs = name === 'cross' ? 4 : 8;
        const turn = r() * Math.PI * 2;
        const pts = [];
        for (let i = 0; i < dirs; i++) {
          const a = turn + (i * Math.PI * 2) / dirs;
          // 유령에서 a 방향으로 화면 밖까지
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          const tx = dx > 0 ? (W + OUT - g.x) / dx : dx < 0 ? (-OUT - g.x) / dx : Infinity;
          const ty = dy > 0 ? (H + OUT - g.y) / dy : dy < 0 ? (-OUT - g.y) / dy : Infinity;
          const d = Math.min(tx, ty);
          pts.push({ x: g.x + dx * d, y: g.y + dy * d, d });
        }
        const far = Math.max.apply(null, pts.map((p) => p.d));
        const T = far / (v * 0.9);
        pts.forEach((p) => add(world, p.x, p.y, Math.atan2(g.y - p.y, g.x - p.x), p.d / T, warn + 0.2));
        break;
      }
      case 'sweep': {
        // 변을 따라 차례로 쏘는 화살 줄
        const n = 9;
        const c = along(side, g);
        const dir = r() < 0.5 ? 1 : -1;
        const ang = Math.atan2(edgePoint(side, 0).ny, edgePoint(side, 0).nx);
        for (let i = 0; i < n; i++) {
          const k = clamp(c - dir * 0.3 + dir * (i * 0.6) / (n - 1), 0, 1);
          const p = edgePoint(side, k);
          add(world, p.x, p.y, ang, v * 0.9, warn + i * 0.09);
        }
        break;
      }
      case 'wall': {
        // 구멍 뚫린 화살 벽: 구멍 하나는 유령 가까이에 있어요
        const span = side < 2 ? H - 60 : W - 60;
        const gap = 60;
        const n = Math.floor(span / gap) + 1;
        const c = along(side, g);
        const holeA = clamp(Math.round(c * (n - 1) + J(2.5)), 1, n - 2);
        let holeB = Math.floor(r() * n);
        if (Math.abs(holeB - holeA) < 4) holeB = (holeA + Math.floor(n / 2)) % n;
        const ang = Math.atan2(edgePoint(side, 0).ny, edgePoint(side, 0).nx);
        for (let i = 0; i < n; i++) {
          if (Math.abs(i - holeA) <= 1 || Math.abs(i - holeB) <= 0) continue;
          const p = edgePoint(side, i / (n - 1));
          add(world, p.x, p.y, ang, v * 0.75, warn + 0.3);
        }
        break;
      }
      default:
        break;
    }
  }

  function pickPattern(world) {
    const lv = world.level - 1;
    let total = 0;
    const names = Object.keys(PATTERNS);
    names.forEach((n) => (total += PATTERNS[n].w[lv]));
    let x = world.rnd() * total;
    for (const n of names) {
      x -= PATTERNS[n].w[lv];
      if (x <= 0) return n;
    }
    return 'aimed';
  }

  /** 유령 움직이기. input: { dx, dy } 방향키 (-1~1), 또는 { mx, my } 끌어서 옮긴 거리(px) */
  function moveGhost(world, input, dt) {
    const g = world.ghost;
    let mx = 0;
    let my = 0;
    if (input && (input.mx || input.my)) {
      const d = Math.hypot(input.mx, input.my);
      const lim = DRAG_MAX * dt;
      const k = d > lim ? lim / d : 1;
      mx = input.mx * k;
      my = input.my * k;
    } else if (input && (input.dx || input.dy)) {
      const d = Math.hypot(input.dx, input.dy) || 1;
      mx = (input.dx / d) * MOVE * dt;
      my = (input.dy / d) * MOVE * dt;
    }
    const nx = clamp(g.x + mx, EDGE, W - EDGE);
    const ny = clamp(g.y + my, EDGE, H - EDGE);
    g.vx = (nx - g.x) / dt;
    g.vy = (ny - g.y) / dt;
    g.x = nx;
    g.y = ny;
  }

  /* ---------------- 한 순간 진행 ---------------- */
  function step(world, input, dt) {
    dt = dt || DT;
    if (!world.alive) return;
    world.t += dt;
    moveGhost(world, input, dt);
    const g = world.ghost;

    // 레벨과 새 화살
    const lv = levelOf(world);
    if (lv !== world.level) {
      world.level = lv;
      world.events.push({ type: 'level', level: lv });
    }
    world.next -= dt;
    while (world.next <= 0) {
      const name = pickPattern(world);
      spawn(world, name);
      if (world.level >= 5 && name !== 'ring' && name !== 'wall' && world.rnd() < 0.3) spawn(world, 'aimed');
      const slow = Math.pow(0.99, Math.max(0, world.t - 70) / 5);
      const warmup = 1 + 0.6 * Math.max(0, 1 - world.t / 10); // 처음 10초는 천천히
      const interval = Math.max(0.4, INTERVAL[world.level - 1] * slow * warmup);
      world.next += interval * PATTERNS[name].cost;
    }

    // 화살 움직이기와 맞았는지 보기
    const list = world.arrows;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (a.delay > 0) {
        a.delay -= dt;
        continue;
      }
      const px = a.x;
      const py = a.y;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      // 화살촉 끝이 지나간 선분과 유령 사이의 거리
      const sx = a.x - px;
      const sy = a.y - py;
      const len2 = sx * sx + sy * sy || 1;
      const t = clamp(((g.x - px) * sx + (g.y - py) * sy) / len2, 0, 1);
      const cx = px + sx * t - g.x;
      const cy = py + sy * t - g.y;
      const d = Math.sqrt(cx * cx + cy * cy);
      if (d < HIT) {
        world.alive = false;
        world.hitBy = a;
        world.events.push({ type: 'hit', x: a.x, y: a.y });
        return;
      }
      if (!a.near && d < NEAR) {
        a.near = true;
        world.near++;
        world.events.push({ type: 'near', x: g.x, y: g.y });
      }
      const inside = a.x > -2 && a.x < W + 2 && a.y > -2 && a.y < H + 2;
      if (inside) a.inside = true;
      if (a.inside && !inside && (a.x < -70 || a.x > W + 70 || a.y < -70 || a.y > H + 70)) {
        list.splice(i, 1);
        world.dodged++;
      } else if (!a.inside && (a.x < -400 || a.x > W + 400 || a.y < -400 || a.y > H + 400)) {
        list.splice(i, 1);
      }
    }
  }

  function titleFor(seconds) {
    for (const [limit, name] of TITLES) if (seconds < limit) return name;
    return TITLES[TITLES.length - 1][1];
  }

  root.JukrimCore = {
    W,
    H,
    GHOST_R,
    HIT,
    MOVE,
    DT,
    PATTERNS,
    TITLES,
    createWorld,
    moveGhost,
    step,
    spawn,
    titleFor,
    levelOf,
  };
})(typeof module === 'object' && module.exports ? module.exports : window);
