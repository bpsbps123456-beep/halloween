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

test('복도: 출발할 때는 경비원 불빛 밖이고, 도착 문은 숨을 곳 사이에 있어요', () => {
  for (const def of E.HALLS) {
    for (let seed = 1; seed <= 20; seed++) {
      const h = E.createHall(def, seed);
      assert.ok(!E.inLight(h), def.id);
      assert.ok(Math.abs(h.startX - h.guard.x) > h.guard.cone, def.id + ' 시작이 너무 가까워요');
      assert.ok(h.spots.length >= 3, def.id);
      // 숨을 곳 사이가 너무 멀지 않아요
      for (let i = 1; i < h.spots.length; i++) assert.ok(h.spots[i].x - h.spots[i - 1].x <= 9.01, def.id);
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

test('복도: 불빛 안에 서 있으면 들키고, 잡히면 처음으로 돌아가요', () => {
  const h = E.createHall(E.HALLS[0], 3);
  const g = h.guard;
  h.player.x = g.x + g.face * 3;
  E.stepHall(h, { vx: 0, vz: 0 }, 1 / 60);
  assert.equal(g.state, 'alert');
  for (let i = 0; i < 600 && !h.caught; i++) E.stepHall(h, { vx: 0, vz: 0 }, 1 / 60);
  assert.equal(h.caught, 1);
  assert.equal(h.player.x, h.startX);
  // 숨으면 안전해요
  const h2 = E.createHall(E.HALLS[0], 3);
  const sp = h2.spots[0];
  h2.player.x = sp.x;
  E.stepHall(h2, { hide: true }, 1 / 60);
  assert.equal(h2.player.hidden, 0);
  h2.guard.x = sp.x + h2.guard.face * -2;
  for (let i = 0; i < 300; i++) E.stepHall(h2, {}, 1 / 60);
  assert.equal(h2.caught, 0);
});

test('복도: 뛰면 발소리를 듣고 돌아봐요', () => {
  const h = E.createHall(E.HALLS[2], 5);
  const g = h.guard;
  g.state = 'walk';
  g.face = 1;
  h.player.x = g.x - 5; // 등 뒤 5m
  E.stepHall(h, { vx: E.RUN, vz: 0, run: true }, 1 / 60);
  assert.equal(g.state === 'listen' || g.state === 'alert', true);
  assert.equal(g.face, -1);
});

test('시간 표시', () => {
  assert.equal(E.formatTime(0), '00:00');
  assert.equal(E.formatTime(75.9), '01:15');
  assert.equal(E.formatTime(3599), '59:59');
});
