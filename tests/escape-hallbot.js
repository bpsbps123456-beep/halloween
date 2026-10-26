/* 복도 자동 플레이어: 조심스러운 아이처럼 숨을 곳(청소함·화장실·열린 교실 안 문 옆 벽)에서 숨을 곳으로,
   경비원이 지금 바로 돌아봐도 불빛이 닿지 않을 때만 건너요. 들키면 계단이나 먼 곳으로 도망쳐 따돌려요.
   escape.test.js 가 모든 복도를 이 플레이어로 통과할 수 있는지 확인해요. */
const E = require('../multi/escape/core.js').EscapeCore;

/** 숨을 곳: 청소함·화장실·계단, 그리고 열린 교실 문 안쪽 벽 옆 (문에서 비춰도 안 보이는 곳) */
function havens(h) {
  if (h.botHavens) return h.botHavens;
  const list = [];
  h.spots.forEach((s, i) => list.push({ x: s.x, spot: i, kind: s.kind }));
  h.rooms.forEach((r) =>
    r.doors.forEach((d) => {
      const inward = d < (r.x0 + r.x1) / 2 ? 1 : -1;
      list.push({ x: d, kind: 'pocket', door: d, room: r, pocket: { x: d + inward * 1.9, z: E.ROOM_Z0 + 0.06 } });
    })
  );
  list.sort((a, b) => a.x - b.x);
  h.botHavens = list;
  return list;
}

const inRoom = (p) => p.z >= E.WALL_Z;
/** 지금 있는 숨을 곳 */
function current(h) {
  const p = h.player;
  if (p.hidden >= 0) return havens(h).find((v) => v.spot === p.hidden);
  return havens(h).find((v) => v.pocket && Math.abs(p.x - v.pocket.x) < 0.12 && Math.abs(p.z - v.pocket.z) < 0.12);
}

/** 지금 자리에서 목표까지 걸어갈 길 (점 목록) */
function path(h, target) {
  const p = h.player;
  const pts = [];
  let x = p.x;
  if (inRoom(p)) {
    const r = E.roomAt(h, p.x, p.z);
    if (target.pocket && target.room === r) return [target.pocket];
    const tx = target === 'goal' ? h.goalX : target.x;
    const d = r.doors.reduce((a, b) => (Math.abs(b - p.x) + Math.abs(b - tx) < Math.abs(a - p.x) + Math.abs(a - tx) ? b : a));
    pts.push({ x: d, z: E.ROOM_Z0 + 0.02 }, { x: d, z: 0.7 });
    x = d;
  }
  if (target === 'goal') pts.push({ x: h.goalX, z: 0.7 });
  else if (target.pocket) pts.push({ x: target.door, z: 0.85 }, { x: target.door, z: E.ROOM_Z0 + 0.02 }, target.pocket);
  else {
    const sp = h.spots[target.spot];
    pts.push({ x: sp.x, z: sp.z < 0 ? -0.55 : 0.6 });
  }
  return pts;
}
function pathLen(h, pts) {
  let len = 0;
  let a = h.player;
  pts.forEach((b) => {
    len += Math.hypot(b.x - a.x, b.z - a.z);
    a = b;
  });
  return len;
}

/** 경비원이 돌아서기까지 남은 시간 (갑자기 멈칫하는 것은 빼고, 끝까지 걸어가 멈췄다 도는 시간) */
function timeToTurn(g) {
  if (g.state === 'pause') return g.flip ? g.timer : 99;
  if (g.state !== 'walk' && g.state !== 'exit') return 0;
  const end = g.face > 0 ? g.max : g.min;
  return Math.abs(end - g.x) / g.speed + 1.0;
}

/** 어디로 갈까: 숨을 곳(havens 항목), 'goal', 또는 null(그대로 있기) */
function choose(h, margin) {
  const p = h.player;
  const g = h.guard;
  const dir = h.dir;
  const here = current(h);
  const ahead = havens(h)
    .filter((v) => (v.x - p.x) * dir > 0.6 && (h.goalX - v.x) * dir > 0)
    .sort((a, b) => (a.x - b.x) * dir);
  const t = (target) => pathLen(h, path(h, target)) / E.WALK;
  // 경비원이 닫힌 교실 안에 들어갔을 때: 도착 문이나, 그 사이에 닿을 수 있는 가장 먼 숨을 곳까지
  if (g.state === 'enter' || g.state === 'inRoom') {
    const left = (g.state === 'inRoom' ? g.timer : g.timer + 3.5) + 0.4 - margin * 0.5;
    if (t('goal') < left) return 'goal';
    const far = ahead.filter((v) => t(v) < left).pop();
    return far || null;
  }
  const patrol = g.state === 'walk' || g.state === 'exit' || g.state === 'pause';
  if (!patrol) return here ? null : nearest(h);
  const dist = Math.abs(g.x - p.x);
  const guardAhead = (g.x - p.x) * dir > 0;
  const away = Math.sign(g.x - p.x) === g.face && g.state !== 'pause'; // 등을 보이고 걸어가나
  const budget = away ? timeToTurn(g) : 0;
  const safeGap = g.cone + 0.8 + margin;
  if (!guardAhead) {
    // 경비원이 뒤쪽(출발 쪽)
    if (!away) return dist > safeGap + 2 && (!ahead[0] || t(ahead[0]) < (dist - safeGap) / g.speed) ? ahead[0] || 'goal' : here ? null : nearest(h);
    const end = g.face > 0 ? g.max : g.min;
    if (budget > t('goal') + 0.3 + margin) return 'goal';
    const next = ahead.filter((v) => t(v) < budget - 0.4 - margin || (v.x - end) * dir > safeGap).pop();
    return next || (here ? null : nearest(h));
  }
  // 경비원이 앞쪽(도착 쪽): 등 뒤를 따라가요
  if (!away) return here ? null : nearest(h);
  const passable = (x, tt) => (g.x + g.face * g.speed * tt - x) * dir > E.CATCH + 1.2 + margin;
  if (budget > t('goal') + 0.3 + margin && passable(h.goalX, t('goal'))) return 'goal';
  const next = ahead.filter((v) => {
    const tt = t(v);
    return budget > tt + 0.4 + margin && passable(v.x, tt);
  });
  return next.pop() || (here ? null : nearest(h));
}

/** 가장 빨리 닿는 숨을 곳 (경비원 쪽은 피해요) */
function nearest(h) {
  const p = h.player;
  const g = h.guard;
  let best = null;
  let bt = 1e9;
  havens(h).forEach((v) => {
    const toward = Math.sign(v.x - p.x) === Math.sign(g.x - p.x) && Math.abs(v.x - p.x) > Math.abs(g.x - p.x) - 1;
    if (toward) return;
    const tt = pathLen(h, path(h, v));
    if (tt < bt) {
      bt = tt;
      best = v;
    }
  });
  return best;
}

/** 들켰을 때: 계단으로 내려가거나, 도착 문으로 뛰거나, 멀리 도망쳐서 안 보일 때 숨어요 */
function flee(h) {
  const p = h.player;
  const g = h.guard;
  const away = Math.sign(p.x - g.x) || -h.dir;
  const stairs = havens(h).find((v) => {
    if (v.kind !== 'stairs' || (v.x - p.x) * away < -0.5) return false;
    return Math.abs(v.x - p.x) / E.RUN < (Math.abs(v.x - g.x) - E.CATCH) / g.chaseSpeed - 0.2;
  });
  if (stairs) return stairs;
  if ((h.goalX - p.x) * away > 0) return 'goal';
  const gap = Math.hypot(p.x - g.x, p.z - g.z);
  if (gap > g.cone + 0.4) return nearest(h);
  return { run: away };
}

/** 한 판: 끝까지 가면 { done, t, caught } */
function run(def, seed, margin, limit) {
  const h = E.createHall(def, seed);
  const dt = 1 / 60;
  const mem = { target: null, pts: null, last: null };
  let lastCaught = 0;
  while (!h.done && h.t < (limit || 240)) {
    const p = h.player;
    const g = h.guard;
    if (h.caught !== lastCaught) {
      lastCaught = h.caught;
      mem.target = null;
    }
    const hunted = E.hunting(g);
    let target = hunted ? flee(h) : mem.target;
    // 가는 길에 경비원이 이쪽을 보거나 멈칫하면 가까운 숨을 곳으로 바꿔요
    const danger = !hunted && mem.target && (g.state === 'halt' || (Math.sign(p.x - g.x) === g.face && Math.abs(p.x - g.x) < g.cone + 1.5 && g.state !== 'enter' && g.state !== 'inRoom'));
    if (!hunted && (!mem.target || danger)) {
      target = danger ? nearest(h) : choose(h, margin || 0);
      if (danger && current(h)) target = null;
    }
    if (target !== mem.last) {
      mem.last = target;
      mem.pts = target && !target.run ? path(h, target) : null;
    }
    mem.target = hunted ? null : target;
    let input = {};
    if (target && target.run) input = { vx: target.run * E.RUN, vz: (0 - p.z) * 2, run: true };
    else if (target) {
      const here = current(h);
      if (here === target) {
        mem.target = null;
      } else if (p.hidden >= 0) input = { hide: true };
      else {
        const pts = mem.pts;
        const spotGoal = target !== 'goal' && !target.pocket;
        if (spotGoal && Math.abs(h.spots[target.spot].x - p.x) <= (target.kind === 'stairs' ? E.STAIRS_REACH : E.HIDE_REACH) - 0.15 && p.z < E.WALL_Z) {
          input = { hide: true };
          mem.target = null;
        } else {
          while (pts.length > 1 && Math.hypot(pts[0].x - p.x, pts[0].z - p.z) < 0.06) pts.shift();
          const wp = pts[0];
          const dx = wp.x - p.x;
          const dz = wp.z - p.z;
          const d = Math.hypot(dx, dz);
          const speed = hunted ? E.RUN : E.WALK;
          const k = d > 1e-6 ? Math.min(speed, d / dt) / d : 0;
          input = { vx: dx * k, vz: dz * k, run: hunted };
          if (d < 1e-6 && pts.length === 1 && !spotGoal) mem.target = null;
        }
      }
    }
    E.stepHall(h, input, dt);
    h.events.length = 0;
  }
  return { done: h.done, t: h.t, caught: h.caught };
}

module.exports = { run, havens };

if (require.main === module) {
  for (const def of E.HALLS) {
    const parts = [];
    for (const margin of [0.8, 0]) {
      const N = 60;
      let ok = 0;
      let t = 0;
      let c = 0;
      let worst = 0;
      for (let s = 1; s <= N; s++) {
        const r = run(def, s, margin);
        if (r.done) {
          ok++;
          t += r.t;
          worst = Math.max(worst, r.t);
        }
        c += r.caught;
      }
      parts.push(`${margin > 0 ? 'careful' : 'normal'} ${ok}/${N} avg ${(t / Math.max(1, ok)).toFixed(0)}s worst ${worst.toFixed(0)}s caught ${(c / N).toFixed(2)}`);
    }
    console.log(def.id, '|', parts.join(' | '));
  }
}
