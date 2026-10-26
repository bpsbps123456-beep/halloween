/* 복도 자동 플레이어: 숨을 곳에서 숨을 곳으로, 경비원이 지금 바로 돌아봐도 불빛이 닿지 않는 곳만 건너요.
   escape.test.js 가 모든 복도를 이 플레이어로 통과할 수 있는지 확인해요. */
const E = require('../multi/escape/core.js').EscapeCore;

function nearestReachable(h) {
  const p = h.player;
  const g = h.guard;
  const hunting = g.state === 'alert' || g.state === 'chase';
  let best = -1;
  let bt = 1e9;
  h.spots.forEach((s, i) => {
    const tp = Math.abs(s.x - p.x) / E.RUN;
    const lit = Math.abs(g.x - s.x) - (hunting ? 0 : g.cone);
    const tg = Math.sign(s.x - g.x) === g.face ? Math.max(0, lit) / (hunting ? g.chaseSpeed : g.speed) : 99;
    if (tp < tg && tp < bt) {
      bt = tp;
      best = i;
    }
  });
  return best;
}

/** 경비원이 교실 안에 들어갔을 때: 도착 문이나, 그 사이에 닿을 수 있는 가장 먼 숨을 곳까지 */
function roomWindow(h) {
  const p = h.player;
  const g = h.guard;
  const dir = h.dir;
  if (g.state !== 'enter' && g.state !== 'inRoom') return null;
  const left = g.state === 'inRoom' ? g.timer : g.timer + 3.5;
  const reach = (x) => Math.abs(x - p.x) / E.WALK < left - 0.4;
  if (reach(h.goalX)) return { target: h.goalX };
  const behind = (g.x - p.x) * dir < -0.7; // 이미 지나온 교실에 들어갔어요
  const cand = h.spots
    .filter((s) => (s.x - p.x) * dir > 0.6 && (behind || (s.x - g.x) * dir > 1) && reach(s.x))
    .sort((a, b) => (b.x - a.x) * dir);
  return cand.length ? { target: cand[0].x } : null;
}

/** 경비원이 돌아서기까지 남은 시간 (갑자기 뒤돌아보는 것은 빼고, 끝까지 걸어가 멈췄다 도는 시간) */
function timeToTurn(g) {
  if (g.state === 'pause') return g.flip ? g.timer : 99;
  if (g.state !== 'walk' && g.state !== 'exit') return 0;
  const end = g.face > 0 ? g.max : g.min;
  return Math.abs(end - g.x) / g.speed + 1.0;
}

/** 돌려주는 것: { move: -1|0|1, hide, run }
    조심스러운 아이처럼: 경비원 등이 보일 때만 움직이고, 경비원이 돌아서기 전에 다음 숨을 곳(또는 도착 문)에 닿을 수 있을 때만 건너요. */
function decide(h, margin) {
  const p = h.player;
  const g = h.guard;
  const dir = h.dir;
  const reachSpot = E.HIDE_REACH - 0.15;
  const win = roomWindow(h);
  if (win) {
    if (win.target === h.goalX) return { move: dir };
    if (p.hidden >= 0 && Math.abs(p.x - win.target) > 0.15) return { hide: true };
    return Math.abs(win.target - p.x) <= reachSpot ? (p.hidden >= 0 ? {} : { hide: true }) : { move: Math.sign(win.target - p.x) };
  }
  const hunting = g.state === 'alert' || g.state === 'chase';
  if (hunting) {
    const i = nearestReachable(h);
    if (i < 0) return { move: -Math.sign(g.x - p.x) || -dir, run: true };
    const sx = h.spots[i].x;
    return Math.abs(sx - p.x) <= reachSpot ? (p.hidden >= 0 ? {} : { hide: true }) : { move: Math.sign(sx - p.x), run: true };
  }
  const wait = () => (p.hidden >= 0 ? {} : nearestHide(h, reachSpot));
  if (g.state === 'search' || g.state === 'listen' || !E.inCorridor(g)) return wait();
  const dist = Math.abs(g.x - p.x);
  const guardAhead = (g.x - p.x) * dir > 0;
  const away = Math.sign(g.x - p.x) === g.face; // 등을 보이고 있나
  const budget = away ? timeToTurn(g) : 0;
  const tGoal = Math.abs(h.goalX - p.x) / E.WALK;
  const ahead = h.spots.filter((s) => (s.x - p.x) * dir > 0.6).sort((a, b) => (a.x - b.x) * dir);
  const go = (x) => (Math.abs(x - p.x) <= reachSpot ? (p.hidden >= 0 ? {} : { hide: true }) : { move: Math.sign(x - p.x) });

  if (!guardAhead) {
    // 경비원이 뒤쪽(출발 쪽)
    if (!away) return dist > g.cone + 0.8 + margin ? { move: dir } : wait();
    if (p.hidden >= 0 && dist < 2.5) return {}; // 바로 옆을 지나가는 중: 조금 더 기다려요
    const end = g.face > 0 ? g.max : g.min;
    const reachGoal = budget > tGoal + 0.3 + margin;
    const later = p.x + dir * Math.min(E.WALK * budget, Math.abs(h.goalX - p.x));
    if (reachGoal || (later - end) * dir > g.cone + 0.8 + margin) return { move: dir };
    const next = ahead.find((s) => Math.abs(s.x - p.x) / E.WALK < budget - 0.4 - margin);
    return next ? go(next.x) : wait();
  }
  // 경비원이 앞쪽(도착 쪽)
  if (!away) return wait();
  const passable = (x, t) => (g.x + g.face * g.speed * t - x) * dir > E.CATCH + 1.2 + margin;
  if (budget > tGoal + 0.3 + margin && passable(h.goalX, tGoal)) return { move: dir };
  const next = ahead.find((s) => {
    const t = Math.abs(s.x - p.x) / E.WALK;
    return budget > t + 0.4 + margin && passable(s.x, t);
  });
  return next ? go(next.x) : wait();
}

function nearestHide(h, reachSpot) {
  const i = nearestReachable(h);
  if (i < 0) return { move: 0 };
  const sp = h.spots[i];
  return Math.abs(sp.x - h.player.x) <= reachSpot ? { hide: true } : { move: Math.sign(sp.x - h.player.x) };
}

/** 한 판: 끝까지 가면 { done, t, caught } */
function run(def, seed, margin, limit) {
  const h = E.createHall(def, seed);
  const dt = 1 / 60;
  while (!h.done && h.t < (limit || 240)) {
    const o = decide(h, margin);
    const speed = o.run ? E.RUN : E.WALK;
    // 도착 문 가까이에서는 문 쪽(z+)으로 붙어요
    const vz = Math.abs(h.goalX - h.player.x) < 3 ? (1 - h.player.z) * 3 : (0 - h.player.z) * 2;
    E.stepHall(h, { vx: (o.move || 0) * speed, vz: o.move ? vz : 0, run: !!o.run, hide: !!o.hide }, dt);
    h.events.length = 0;
  }
  return { done: h.done, t: h.t, caught: h.caught };
}

module.exports = { decide, run };

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
