/* 동암초 탈출: 수수께끼가 언제나 풀 수 있게 만들어지는지, 복도를 지나갈 수 있는지 확인해요. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../multi/escape/core.js').EscapeCore;
const bot = require('./escape-hallbot.js');

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

test('같은 씨앗이면 같은 판이 나와요 (새로고침해도 똑같이)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(E.createRun(42, {}))), JSON.parse(JSON.stringify(E.createRun(42, {}))));
  assert.notDeepEqual(E.createRun(42, {}).puzzles, E.createRun(43, {}).puzzles);
});

test('탈출 경로: 6-3 교실 → 방·복도를 번갈아 → 중앙 현관', () => {
  const r = E.route();
  assert.equal(r.length, 12);
  assert.equal(r[0].id, 'classroom');
  assert.equal(r[r.length - 1].kind, 'exit');
  r.slice(0, -1).forEach((s, i) => assert.equal(s.kind, i % 2 ? 'hall' : 'room'));
  const run = E.createRun(1, {});
  assert.equal(run.steps[0].place, '6-3');
  // 지도에 모든 장소가 있어요
  run.steps.forEach((s) => assert.ok(E.locate(s.place), s.place));
  assert.ok(E.locate(E.EXIT.place));
});

test('교실: 호박·박쥐·거미 수가 모두 다르고, 식의 답이 두 자리예요', () => {
  for (const seed of SEEDS) {
    const c = E.createRun(seed, {}).puzzles.classroom;
    const { pumpkin, bat, spider } = c.counts;
    assert.equal(new Set([pumpkin, bat, spider]).size, 3);
    assert.equal(c.answer, E.COUNT_FORMS[c.form].calc(pumpkin, bat, spider));
    assert.ok(c.answer >= 10 && c.answer <= 99, String(c.answer));
    for (const kind of ['pumpkin', 'bat', 'spider']) {
      assert.equal(c.slots[kind].length, c.counts[kind]);
      assert.equal(new Set(c.slots[kind]).size, c.counts[kind]);
      c.slots[kind].forEach((s) => assert.ok(s >= 0 && s < E.HIDE_SLOTS[kind]));
    }
  }
});

test('과학실: 나눗셈·비율 물약은 10mL 눈금으로 딱 맞고, 마지막은 세 가지 색을 섞는 갈색이에요', () => {
  for (const seed of SEEDS) {
    const { recipes } = E.createRun(seed, {}).puzzles.science;
    assert.equal(recipes.length, 3);
    assert.equal(recipes[2].color, '갈색');
    assert.notEqual(recipes[0].color, recipes[1].color);
    for (const rc of recipes) {
      assert.deepEqual(rc.parts, E.RECIPES[rc.color]);
      assert.equal(rc.amounts.reduce((a, b) => a + b, 0), rc.total);
      rc.amounts.forEach((a) => assert.ok(a % 10 === 0 && a > 0 && a <= 600, String(a)));
      // 칠판의 식을 직접 계산해서 맞는지 (아이들이 배운 소수·분수의 나눗셈, 비율)
      const val = (t) => (t.endsWith('%') ? parseFloat(t) / 100 : t.includes('/') ? t.split('/')[0] / t.split('/')[1] : parseFloat(t));
      const m = /= (\S+) ÷ (\S+) \(mL\)$/.exec(rc.lines[0]);
      assert.ok(m, rc.lines[0]);
      assert.ok(Math.abs(val(m[1]) / val(m[2]) - rc.amounts[0]) < 1e-6, rc.lines[0]);
      rc.lines.slice(1).forEach((ln, i) => {
        const r = /비율 = (\S+)$/.exec(ln);
        assert.ok(r, ln);
        assert.ok(['10%', '50%', '100%'].includes(r[1]), '쉬운 비율만: ' + ln);
        assert.ok(Math.abs(rc.amounts[0] * val(r[1]) - rc.amounts[i + 1]) < 1e-6, ln);
        assert.ok(ln.startsWith(rc.parts[0] + '에 대한 ' + rc.parts[i + 1]));
      });
      assert.ok(!/비례|배분/.test(rc.lines.join()), '비례배분은 아직 안 배웠어요');
      const right = {};
      rc.parts.forEach((c, i) => (right[c] = rc.amounts[i]));
      assert.ok(E.checkPotion(rc, right));
      assert.equal(E.potionResult(rc, right), rc.color);
      const wrong = Object.assign({}, right);
      wrong[rc.parts[0]] += 10;
      assert.ok(!E.checkPotion(rc, wrong));
      assert.equal(E.potionResult(rc, wrong), 'almost');
      // 다른 색 물약을 넣으면 탁해져요
      const other = E.POTIONS.find((c) => rc.parts.indexOf(c) < 0);
      if (other) assert.equal(E.potionResult(rc, Object.assign({}, right, { [other]: 50 })), '탁함');
    }
  }
});

test('도서관: 속담 빈칸 글자가 카드에 모두 있고, 카드는 겹치지 않아요', () => {
  for (const seed of SEEDS) {
    const lib = E.createRun(seed, {}).puzzles.library;
    assert.equal(lib.books.length, 3);
    assert.equal(new Set(lib.slots).size, 3);
    lib.slots.forEach((s) => assert.ok(s >= 0 && s < E.BOOK_SLOTS));
    assert.ok(lib.books.filter((b) => Array.from(b.blank).length >= 3).length >= 2);
    for (const b of lib.books) {
      assert.equal(b.cho, E.initials(b.blank));
      assert.equal(new Set(b.tiles).size, b.tiles.length);
      Array.from(b.blank).forEach((ch) => assert.ok(b.tiles.includes(ch), b.blank));
      assert.ok(b.tiles.length >= 8);
      assert.ok(b.mean.length > 5);
    }
  }
  // 속담 목록이 올바르게 적혔는지
  E.PROVERBS.forEach(([text]) => assert.match(text, /^[^{}]*\{[^{} ]+\}[^{}]*$/));
});

test('방송실: 모스 부호 비밀번호는 네 자리, 숫자마다 소리가 5번', () => {
  for (const seed of SEEDS) {
    const { code } = E.createRun(seed, {}).puzzles.broadcast;
    assert.match(code, /^[1-9]\d{3}$/);
    const tl = E.morseTimeline(code, 0.2);
    assert.equal(tl.length, 20);
    tl.forEach((s) => assert.ok(s.on === 0.2 || Math.abs(s.on - 0.6) < 1e-9));
    assert.deepEqual(
      tl.map((s) => s.sym).join(''),
      Array.from(code)
        .map((d) => E.MORSE[d])
        .join('')
    );
  }
  assert.equal(E.MORSE[0], '-----');
  assert.equal(E.MORSE[5], '.....');
});

test('교무실: 단서 4~6개로 선생님 자리가 꼭 한 가지로 정해져요', () => {
  for (const seed of SEEDS) {
    const off = E.createRun(seed, { myClass: '6-3' }).puzzles.office;
    assert.equal(off.teachers[0], '6-3 담임');
    assert.ok(off.clues.length >= 4 && off.clues.length <= 6, String(off.clues.length));
    assert.ok(off.clues.filter((c) => c.type === 'at').length <= 1);
    const sols = E.solutionsFor(off.clues);
    assert.equal(sols.length, 1);
    assert.deepEqual(sols[0], off.solution);
    const seats = [];
    off.solution.forEach((seat, t) => (seats[seat] = t));
    assert.ok(E.checkSeats(off, seats));
    const swapped = seats.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    assert.ok(!E.checkSeats(off, swapped));
    off.clues.forEach((c) => assert.match(E.clueText(off, c), /선생님/));
  }
});

test('보건실: 그림 식이 서로 맞고, 답은 곱셈을 먼저 한 값이에요', () => {
  for (const seed of SEEDS) {
    const n = E.createRun(seed, {}).puzzles.nurse;
    assert.equal(Number(n.notes[0][8]), 4 * n.a);
    assert.equal(Number(n.notes[1][6]), n.b * n.b - n.a);
    assert.equal((n.c - n.b) / n.a, n.k);
    assert.ok(Number.isInteger(n.k) && n.k >= 2);
    assert.equal(n.answer, n.a * n.b + n.c);
    assert.ok(n.answer < 1000);
    assert.notEqual(n.a, n.b);
    assert.equal(new Set(n.slots).size, 4);
  }
});

test('현관 자물쇠: 방마다 숫자 하나, 그림 순서대로 맞춰야 열려요', () => {
  const run = E.createRun(7, {});
  assert.deepEqual(run.lock.slice().sort(), E.STEPS.map((s) => s.id).sort());
  Object.values(run.digits).forEach((d) => assert.ok(d >= 1 && d <= 9));
  const good = run.lock.map((id) => run.digits[id]);
  assert.ok(E.checkLock(run, good));
  assert.ok(!E.checkLock(run, good.slice().reverse()) || good.join('') === good.slice().reverse().join(''));
});

test('선생님 설정: 주소로 주고받고, 이상한 값은 걸러요', () => {
  const s = { school: '동암초등학교', myClass: '6-3', quiz: [{ q: '개교기념일은 몇 월?', a: '5월, 오월' }] };
  assert.deepEqual(E.decodeSettings(E.encodeSettings(s)), E.normalizeSettings(s));
  assert.equal(E.decodeSettings(E.encodeSettings(s)).school, '동암초등학교');
  assert.equal(E.decodeSettings('망가진주소'), null);
  const n = E.normalizeSettings({ school: '   ', myClass: '9-9', quiz: [{ q: '', a: 'x' }, 3, null] });
  assert.equal(n.school, '동암초등학교');
  assert.equal(n.myClass, '6-3');
  assert.deepEqual(n.quiz, []);
  assert.ok(E.checkAnswer(' 오 월 ', '5월, 오월'));
  assert.ok(!E.checkAnswer('', '5월'));
  assert.deepEqual(E.createRun(1, s).puzzles.quiz, [{ q: '개교기념일은 몇 월?', a: '5월, 오월' }]);
});

test('우리 반 꾸미기: 담임 선생님·급훈·주번·떠든 사람·사물함 이름표', () => {
  const s = E.normalizeSettings({ teacher: ' 홍길동 ', motto: '서로 돕자', duty: '김철수, 이영희', noisy: '박하나 최두리,  정세나', friends: ['가나', '', '다라'] });
  assert.equal(s.teacher, '홍길동');
  assert.deepEqual(s.duty, ['김철수', '이영희']);
  assert.deepEqual(s.noisy, ['박하나', '최두리', '정세나']);
  assert.deepEqual(s.friends, ['가나', '다라']);
  assert.deepEqual(E.decodeSettings(E.encodeSettings(s)), s);
  // 담임 선생님 이름이 교무실 자리 퍼즐에 나와요 (정답은 이름과 상관없이 같아요)
  const run = E.createRun(9, s);
  assert.equal(run.teacher, '홍길동');
  assert.equal(run.puzzles.office.teachers[0], '홍길동');
  assert.deepEqual(run.puzzles.office.solution, E.createRun(9, {}).puzzles.office.solution);
  // 이름이 너무 많거나 길면 잘라요
  const big = E.normalizeSettings({ noisy: 'ㄱ,ㄴ,ㄷ,ㄹ,ㅁ,ㅂ,ㅅ,ㅇ', friends: 'a'.repeat(20) });
  assert.equal(big.noisy.length, 6);
  assert.equal(big.friends[0].length, 8);
  // 예전 주소(이름 칸 없음)도 그대로 열려요
  assert.deepEqual(E.normalizeSettings({ school: '동암초등학교', myClass: '6-3', quiz: [] }).noisy, []);
});

test('복도: 출발할 때는 경비원 불빛 밖이고, 숨을 곳(청소함·계단·열린 교실)이 너무 멀지 않아요', () => {
  for (const def of E.HALLS) {
    for (let seed = 1; seed <= 20; seed++) {
      const h = E.createHall(def, seed);
      assert.ok(!E.inLight(h), def.id);
      assert.ok(Math.abs(h.startX - h.guard.x) > h.guard.cone, def.id + ' 시작이 너무 가까워요');
      const xs = bot.havens(h)
        .map((v) => v.x)
        .filter((x) => (x - h.startX) * h.dir >= -0.5 && (h.goalX - x) * h.dir > 0)
        .concat([h.startX, h.goalX])
        .sort((a, b) => a - b);
      assert.ok(xs.length >= 5, def.id);
      for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] <= 9.01, def.id + ' 숨을 곳 사이가 멀어요 ' + xs[i - 1] + '→' + xs[i]);
      // 들어갈 수 있는 실의 문은 처음엔 닫혀 있고, 드르륵 열면 실 안으로 이어져요. 교실 쪽 벽은 못 지나가요
      h.rooms.forEach((r) => {
        r.doors.forEach((d) => {
          assert.ok(!E.walkable(h, d, 1.6), def.id + ' 닫힌 문');
          E.openDoor(h, d, 'player');
          assert.ok(E.walkable(h, d, 1.6), def.id + ' 문 통로');
          assert.ok(E.walkable(h, d, E.ROOM_Z0 + 0.5), def.id + ' 교실 안');
          assert.ok(!E.walkable(h, d + 0.6, 1.4), def.id + ' 문 옆 벽');
        });
      });
    }
  }
});

test('복도: 조심스러운 아이 같은 자동 플레이어가 모든 복도를 지나가요', () => {
  for (const def of E.HALLS) {
    let ok = 0;
    let total = 0;
    const N = 40;
    for (let seed = 1; seed <= N; seed++) {
      const r = bot.run(def, seed, 0, 240);
      if (r.done) {
        ok++;
        total += r.t;
      }
    }
    assert.ok(ok >= N * 0.95, `${def.id}: ${ok}/${N}`);
    assert.ok(total / ok < 90, `${def.id}: 평균 ${(total / ok).toFixed(0)}초`);
  }
});

/** 경비원을 순찰 상태로 두고, 아이를 경비원 앞 거리 d 에 세워요 */
function facing(def, d) {
  const h = E.createHall(def, 3);
  const g = h.guard;
  h.player.x = g.x + g.face * d;
  h.player.z = 0;
  return h;
}
const steps = (h, n, input) => {
  for (let i = 0; i < n && !h.caught; i++) {
    E.stepHall(h, input || {}, 1 / 60);
    h.events.length = 0;
  }
};

test('복도: 불빛 안에 오래 있으면 들키고(가까우면 빨리), 잡히면 처음으로 돌아가요', () => {
  const near = facing(E.HALLS[0], 2);
  steps(near, 30);
  assert.equal(near.guard.state === 'alert' || near.guard.state === 'chase', true, '2m 앞은 0.5초 안에 들켜요');
  const far = facing(E.HALLS[0], 6.5);
  steps(far, 30);
  assert.ok(!E.hunting(far.guard), '멀면 0.5초로는 안 들켜요');
  assert.ok(far.guard.sus > 0.3, '그래도 의심은 해요');
  const h = facing(E.HALLS[0], 3);
  steps(h, 600);
  assert.equal(h.caught, 1);
  assert.equal(h.player.x, h.startX);
});

test('복도: 잠깐 비쳤다가 빠지면 "응?" 하고 그 자리를 살피러 와요', () => {
  const h = facing(E.HALLS[2], 6);
  const spotAt = h.player.x;
  steps(h, 24); // 0.4초
  assert.ok(h.guard.sus > 0.3 && !E.hunting(h.guard));
  h.player.x = h.guard.x - h.guard.face * 6; // 등 뒤로 쏙
  steps(h, 60);
  assert.equal(['listen', 'investigate'].includes(h.guard.state), true, h.guard.state);
  assert.ok(Math.abs(h.guard.clue.x - spotAt) < 0.01);
});

test('복도: 경비원은 뒤돌아보기 전에 멈칫해요', () => {
  const def = E.HALLS[4];
  const h = E.createHall(def, 9);
  const g = h.guard;
  let sawHalt = false;
  for (let i = 0; i < 60 * 60 && !sawHalt; i++) {
    const was = g.state;
    E.stepHall(h, {}, 1 / 60);
    if (was === 'walk' && g.state === 'halt') {
      sawHalt = true;
      const face = g.face;
      steps(h, 30);
      assert.equal(g.face, face, '멈칫하는 동안은 아직 앞을 봐요');
      steps(h, 30);
      assert.equal(g.face, -face, '그다음 뒤돌아봐요');
    }
    h.events.length = 0;
  }
  assert.ok(sawHalt);
});

test('복도: 숨기 버튼을 누를 때 걷고 있어도 숨어 있고, 손을 뗐다가 다시 움직이면 나와요', () => {
  const h = E.createHall(E.HALLS[0], 3);
  const sp = h.spots.findIndex((s) => s.kind === 'locker');
  h.player.x = h.spots[sp].x;
  E.stepHall(h, { vx: E.WALK, vz: 0, hide: true }, 1 / 60);
  assert.equal(h.player.hidden, sp);
  steps(h, 30, { vx: E.WALK, vz: 0 });
  assert.equal(h.player.hidden, sp, '계속 누르고 있어도 그대로 숨어 있어요');
  steps(h, 2, {});
  steps(h, 2, { vx: E.WALK, vz: 0 });
  assert.equal(h.player.hidden, -1);
  // 숨어 있으면 경비원이 옆을 지나가도 안전해요
  const h2 = E.createHall(E.HALLS[0], 3);
  h2.player.x = h2.spots[sp].x;
  E.stepHall(h2, { hide: true }, 1 / 60);
  h2.guard.x = h2.spots[sp].x - h2.guard.face * 2;
  steps(h2, 300);
  assert.equal(h2.caught, 0);
});

test('복도: 쫓아올 때 눈앞에서 청소함에 숨으면 열어 봐요', () => {
  const h = facing(E.HALLS[2], 3);
  const g = h.guard;
  const sp = h.spots.findIndex((s) => s.kind === 'locker');
  g.state = 'chase';
  g.lastSeen = { x: h.player.x, z: 0 };
  g.x = h.spots[sp].x - 3;
  g.face = 1;
  g.ang = 0;
  h.player.x = h.spots[sp].x;
  E.stepHall(h, { hide: true }, 1 / 60);
  const ev = h.events.find((e) => e.type === 'hide');
  assert.ok(ev && ev.seen, '숨는 걸 봤어요');
  h.events.length = 0;
  let found = false;
  for (let i = 0; i < 600 && !h.caught; i++) {
    E.stepHall(h, {}, 1 / 60);
    if (h.events.some((e) => e.type === 'found')) found = true;
    h.events.length = 0;
  }
  assert.ok(found && h.caught === 1);
});

test('복도: 계단으로 내려가면 경비원은 위에서 비춰 보기만 하고 돌아가요', () => {
  const def = E.HALLS[2]; // 본관 2층: 출발 자리가 계단이에요
  const h = E.createHall(def, 4);
  const g = h.guard;
  const st = h.spots.findIndex((s) => s.kind === 'stairs');
  assert.ok(st >= 0);
  h.player.x = h.spots[st].x + 1;
  g.state = 'chase';
  g.lastSeen = { x: h.player.x, z: 0 };
  g.x = h.player.x + 3.5;
  g.face = -1;
  g.ang = Math.PI;
  E.stepHall(h, { hide: true }, 1 / 60);
  assert.equal(h.player.hidden, st);
  const seen = [];
  for (let i = 0; i < 60 * 12; i++) {
    E.stepHall(h, {}, 1 / 60);
    if (seen[seen.length - 1] !== g.state) seen.push(g.state);
    h.events.length = 0;
  }
  assert.ok(seen.includes('peekStairs'), seen.join('>'));
  assert.equal(h.caught, 0);
  assert.equal(['return', 'walk'].includes(g.state), true, seen.join('>'));
});

test('복도: 열린 교실로 들어가면 복도에서는 안 보이고, 경비원은 문으로만 들어와요', () => {
  const def = E.HALLS[2];
  const h = E.createHall(def, 5);
  const r = h.rooms[0];
  const g = h.guard;
  // 교실 문으로 들어가기 (문 근처에서 안쪽으로 걸으면 문 가운데로 들어가요)
  h.player.x = r.doors[0] + 0.5;
  h.player.z = 0.8;
  steps(h, 60, { vx: 0, vz: E.WALK });
  assert.ok(h.player.z > E.ROOM_Z0, '교실 안: ' + h.player.z);
  // 경비원이 복도에서 이쪽을 봐도 안 보여요
  g.x = h.player.x - 3;
  g.z = 0;
  g.ang = Math.atan2(h.player.z - g.z, h.player.x - g.x);
  assert.equal(E.sight(h), 0);
  // 교실 안을 살피러 오면 문을 지나 들어와요
  g.clue = { x: r.doors[0], z: 1.0, spot: -1, room: r.cell };
  g.state = 'investigate';
  let maxZ = 0;
  for (let i = 0; i < 400; i++) {
    E.stepHall(h, {}, 1 / 60);
    h.events.length = 0;
    if (g.z > E.WALL_Z - 0.2) assert.ok(r.doors.some((d) => Math.abs(g.x - d) < 0.6) || g.z > E.ROOM_Z0, '벽을 뚫고 다니지 않아요');
    maxZ = Math.max(maxZ, g.z);
  }
  assert.ok(maxZ > E.ROOM_Z0, '교실 안까지 들어와요');
});

test('복도: 미닫이문은 밀면 드르륵 열리고, 가까이 있는 경비원은 문소리를 듣고 와요', () => {
  const h = E.createHall(E.HALLS[2], 5);
  const g = h.guard;
  const r = h.rooms[0];
  const d = r.doors[0];
  g.x = d + 3;
  g.z = 0;
  g.state = 'walk';
  g.face = 1;
  g.ang = 0; // 등을 돌리고 있어요
  h.player.x = d;
  h.player.z = 1.1;
  E.stepHall(h, { vx: 0, vz: E.WALK }, 1 / 60);
  assert.ok(E.isDoorOpen(h, d), '밀면 열려요');
  assert.ok(h.events.some((e) => e.type === 'doorOpen' && e.by === 'player'));
  assert.equal(g.state, 'listen', '문소리를 들었어요');
  assert.ok(Math.abs(g.clue.x - d) < 0.01);
  // 멀리 있으면 못 들어요
  const h2 = E.createHall(E.HALLS[2], 5);
  h2.guard.x = h2.rooms[0].doors[0] + 12;
  h2.guard.state = 'walk';
  h2.player.x = h2.rooms[0].doors[0];
  h2.player.z = 1.1;
  E.stepHall(h2, { vx: 0, vz: E.WALK }, 1 / 60);
  assert.notEqual(h2.guard.state, 'listen');
  // 잡혀서 처음부터 하면 문도 다시 닫혀요
  E.resetHall(h2);
  assert.ok(!E.isDoorOpen(h2, h2.rooms[0].doors[0]));
});

test('복도: 뛰면 발소리를 듣고 소리 난 곳을 살피러 와요', () => {
  const h = E.createHall(E.HALLS[2], 5);
  const g = h.guard;
  g.state = 'walk';
  g.face = 1;
  g.ang = 0;
  h.player.x = g.x - 5; // 등 뒤 5m
  E.stepHall(h, { vx: E.RUN, vz: 0, run: true }, 1 / 60);
  assert.equal(g.state, 'listen');
  assert.ok(Math.abs(g.clue.x - h.player.x) < 0.1);
  steps(h, 50);
  assert.equal(g.state === 'investigate' || E.hunting(g), true, g.state);
});

test('복도: 그 층의 실이 모두 있고, 실마다 들어갈 수 있거나 잠겨 있어요 (엘리베이터는 정전)', () => {
  for (const def of [E.FIRST_HALL].concat(E.HALLS)) {
    const h = E.createHall(def, 7);
    const row = E.BUILDINGS[def.building].floors[def.floor];
    assert.deepEqual(h.cells.map((c) => c.name), row, def.id + ' 층 전체');
    h.cells
      .filter((c) => c.kind === 'room' && c.index !== def.toIndex)
      .forEach((c) => {
        const open = h.rooms.find((r) => r.cell === c.index);
        const locked = h.locked.find((l) => l.cell === c.index);
        assert.ok(!!open !== !!locked, def.id + ' ' + c.name + ' 은 열리거나 잠겨 있어야 해요');
        // 잠긴 실 문으로는 못 들어가요
        if (locked) E.doorsOf(c).forEach((d) => assert.ok(!E.walkable(h, d, 1.6), def.id + ' 잠긴 ' + c.name));
      });
    // 다른 수수께끼 방은 아직 잠겨 있어요
    h.locked.filter((l) => l.why === 'later').forEach((l) => assert.ok(E.STEPS.some((st) => st.place === l.name) || l.name === E.EXIT.place));
    assert.equal(h.evs.length, row.filter((n) => n === 'EV').length);
    h.evs.forEach((x) => assert.ok(!E.walkable(h, x, 1.6), '엘리베이터는 못 타요'));
  }
});

test('연결다리: 신관 3층과 본관 3층 복도 가운데에 있고, 본관 3층은 다리를 건너와서 시작해요', () => {
  const h1 = E.createHall(E.HALLS[0], 1);
  const h2 = E.createHall(E.HALLS[1], 1);
  assert.equal(E.HALLS[0].floor, 3);
  assert.equal(E.HALLS[1].floor, 3);
  assert.ok(Math.abs(h1.bridgeX - h1.length / 2) < 0.1);
  assert.ok(Math.abs(h2.bridgeX - h2.length / 2) < 0.1);
  assert.equal(h2.startX, h2.bridgeX);
  // 청소함이 다리 입구를 막지 않아요
  [h1, h2].forEach((h) => h.spots.filter((sp) => sp.kind === 'locker').forEach((sp) => assert.ok(Math.abs(sp.x - h.bridgeX) >= 1.5)));
  assert.equal(E.createHall(E.HALLS[2], 1).bridgeX, null);
});

test('6-3 교실 다음: 신관 2층 복도에서 바로 옆 계단으로 내려가요 (경비 아저씨는 저쪽 끝)', () => {
  const def = E.FIRST_HALL;
  assert.equal(E.BUILDINGS[def.building].floors[def.floor][def.fromIndex], '6-3');
  assert.equal(E.BUILDINGS[def.building].floors[def.floor][def.toIndex], '계단');
  const h = E.createHall(def, 3);
  assert.ok(h.guard.min - h.startX > h.guard.cone + 5, '경비 아저씨 불빛이 교실 앞까지 오지 않아요');
  let ok = 0;
  for (let seed = 1; seed <= 10; seed++) if (bot.run(def, seed, 0, 120).done) ok++;
  assert.equal(ok, 10);
});

test('시간 표시', () => {
  assert.equal(E.formatTime(0), '00:00');
  assert.equal(E.formatTime(75.9), '01:15');
  assert.equal(E.formatTime(3599), '59:59');
});
