/* 동암초 탈출 3D — 학교 지도, 탈출 경로, 수수께끼, 복도 경비원
   화면(3D)과 떨어져 있어서 Node에서도 돌아갑니다 (tests/escape.test.js 가 이 파일을 씁니다).
   학교 지도는 선생님이 주신 신관·본관 대피 안내도를 옮긴 것입니다. 길이 단위는 미터예요. */
(function (root) {
  'use strict';

  const DEFAULT_SCHOOL = '동암초등학교';
  const DEFAULT_CLASS = '6-3'; // 우리 반 (신관 2층)
  const HINT_PENALTY = 30; // 힌트 한 번에 +30초
  const CAUGHT_PENALTY = 30; // 경비원에게 잡히면 +30초

  /* 대피 안내도의 복도를 왼쪽에서 오른쪽으로 옮겼어요 (뒤쪽 화장실·연구실 줄은 뺐어요) */
  const BUILDINGS = {
    bon: {
      name: '본관',
      floors: {
        3: ['계단', '도서관', '5-3', '5-2', '5학년 연구실', '3학년 연구실', '5-1', '3-1', '3-2', '3-3', '계단'],
        2: ['계단', '2-3', '2-2', '2-1', '서버실', '방송실', '회의실', '교장실', '교무실', '4-1', '4-2', '4-3', '계단'],
        1: ['현관', '돌봄교실', '늘봄교실', '지능형과학실', '문서고', '행정실', '중앙 현관', '보건실', '1-1', '1-2', '1-3', '현관'],
      },
    },
    sin: {
      name: '신관',
      floors: {
        3: ['계단', '시약실', '과학실', '미래실', '정보실', 'EV', '화장실', '계단', '회의실 II', '자료실', '다이룸터'],
        2: ['계단', '6-3', '6-2', '6-1', '6학년 연구실', '채움실', 'EV', '화장실', '계단', '나눔실', '회의실 I', '어울림실', '자료실'],
        1: ['현관', '유치원', '유치원', '도움반2', '도움반1', 'EV', '화장실', '계단', '연수실', '몽글마루'],
      },
    },
  };

  const CLASSES = [];
  for (let g = 1; g <= 6; g++) for (let c = 1; c <= 3; c++) CLASSES.push(g + '-' + c);

  /** 방 이름이 지도의 어디에 있는지 (건물, 층, 칸) */
  function locate(place) {
    for (const b of Object.keys(BUILDINGS)) {
      const floors = BUILDINGS[b].floors;
      for (const f of [3, 2, 1]) {
        const i = floors[f].indexOf(place);
        if (i >= 0) return { building: b, floor: f, index: i };
      }
    }
    return null;
  }

  /* 탈출 경로: 우리 반(신관 2층) → 신관 3층 과학실 → 연결통로 → 본관 3층 도서관 → 2층 방송실·교무실 → 1층 보건실 → 중앙 현관
     수수께끼는 6학년에 맞췄어요 (곱셈·혼합 계산, 비례배분, 속담, 모스 부호, 논리 추론). */
  const STEPS = [
    { id: 'classroom', place: null, icon: '🎃', title: '칠판의 수수께끼', goal: '교실에 숨은 호박·박쥐·거미를 모두 세어 칠판의 식을 풀어요. 답은 선생님 책상 서랍 비밀번호!' },
    { id: 'science', place: '과학실', icon: '🧪', title: '마녀의 물약', goal: '칠판의 비율대로 물약 양을 정확히 나눠 솥에 부어요. 물약 3가지를 만들어요.' },
    { id: 'library', place: '도서관', icon: '📚', title: '속담 책장', goal: '책장 어딘가에서 보랏빛으로 빛나는 책 3권을 찾아 속담의 빈칸을 채워요.' },
    { id: 'broadcast', place: '방송실', icon: '📢', title: '유령의 모스 부호', goal: '유령이 보내는 삐- 소리와 불빛을 벽의 모스 부호표로 풀어 4자리 비밀번호를 찾아요.' },
    { id: 'office', place: '교무실', icon: '📝', title: '선생님 자리 찾기', goal: '화이트보드 단서로 선생님 다섯 분의 자리를 모두 알아내요.' },
    { id: 'nurse', place: '보건실', icon: '🩹', title: '보건실 약장', goal: '보건실 곳곳의 처방전 쪽지 4장을 찾아 그림 식을 풀고, 약장 비밀번호를 맞혀요.' },
  ];
  const EXIT = { id: 'exit', place: '중앙 현관', icon: '🚪', title: '현관 자물쇠' };

  /* ---------------- 씨앗 난수 ---------------- */
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rnd) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const randInt = (lo, hi, rnd) => lo + Math.floor(rnd() * (hi - lo + 1));

  /* ---------------- 1. 교실: 숨은 것 세기 ----------------
     3D 교실(rooms.js)에 호박·박쥐·거미가 숨을 수 있는 자리가 있고, 판마다 그중 몇 곳에 숨어요. */
  const HIDE_SLOTS = { pumpkin: 14, bat: 9, spider: 10 };
  const COUNT_FORMS = [
    { parts: ['🎃', '×', '🦇', '−', '🕷️'], calc: (p, b, s) => p * b - s },
    { parts: ['🎃', '×', '🕷️', '+', '🦇'], calc: (p, b, s) => p * s + b },
    { parts: ['(', '🎃', '+', '🦇', ')', '×', '🕷️'], calc: (p, b, s) => (p + b) * s },
    { parts: ['🦇', '×', '🕷️', '−', '🎃'], calc: (p, b, s) => b * s - p },
  ];
  function makeCounting(rnd) {
    for (;;) {
      const p = randInt(5, 8, rnd);
      const b = randInt(3, 6, rnd);
      const s = randInt(3, 6, rnd);
      const form = randInt(0, COUNT_FORMS.length - 1, rnd);
      const answer = COUNT_FORMS[form].calc(p, b, s);
      // 세 수가 모두 달라야 하나라도 잘못 세면 답이 틀려요
      if (answer < 10 || answer > 99 || p === b || b === s || p === s) continue;
      return {
        counts: { pumpkin: p, bat: b, spider: s },
        form,
        answer,
        slots: {
          pumpkin: shuffle(range(HIDE_SLOTS.pumpkin), rnd).slice(0, p),
          bat: shuffle(range(HIDE_SLOTS.bat), rnd).slice(0, b),
          spider: shuffle(range(HIDE_SLOTS.spider), rnd).slice(0, s),
        },
      };
    }
  }

  /* ---------------- 2. 과학실: 비례배분 물약 ---------------- */
  const POTIONS = ['빨강', '파랑', '노랑'];
  const RECIPES = { 보라: ['빨강', '파랑'], 초록: ['파랑', '노랑'], 주황: ['빨강', '노랑'], 갈색: ['빨강', '파랑', '노랑'] };
  const COLORS = {
    빨강: '#e8443a',
    파랑: '#2f6bff',
    노랑: '#ffd23f',
    보라: '#9b4dd8',
    초록: '#2fbf71',
    주황: '#ff8a1f',
    갈색: '#7a4a2a',
    탁함: '#5b6152',
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  function makeRecipe(color, rnd) {
    const parts = RECIPES[color];
    let ratio;
    do ratio = parts.map(() => randInt(1, parts.length === 2 ? 5 : 4, rnd));
    while (ratio.reduce(gcd) !== 1 || ratio.every((r) => r === ratio[0]));
    const sum = ratio.reduce((a, b) => a + b, 0);
    const units = [];
    for (let u = 20; u * sum <= 600; u += 10) if (u * sum >= 120) units.push(u);
    const unit = units[Math.floor(rnd() * units.length)];
    return { color, parts, ratio, total: unit * sum, amounts: ratio.map((r) => r * unit) };
  }
  function makeScience(rnd) {
    const two = shuffle(['보라', '초록', '주황'], rnd).slice(0, 2);
    return { recipes: two.concat(['갈색']).map((c) => makeRecipe(c, rnd)) };
  }
  /** amounts: { 빨강: 120, 파랑: 80, 노랑: 0 } */
  function checkPotion(recipe, amounts) {
    return POTIONS.every((c) => {
      const i = recipe.parts.indexOf(c);
      return (Number(amounts[c]) || 0) === (i >= 0 ? recipe.amounts[i] : 0);
    });
  }
  /** 솥에 부은 물약 색: 맞으면 그 색, 섞은 종류만 맞으면 연한 색, 아니면 탁한 색 */
  function potionResult(recipe, amounts) {
    if (checkPotion(recipe, amounts)) return recipe.color;
    const used = POTIONS.filter((c) => Number(amounts[c]) > 0);
    const same = used.length === recipe.parts.length && used.every((c) => recipe.parts.indexOf(c) >= 0);
    return same ? 'almost' : '탁함';
  }

  /* ---------------- 3. 도서관: 속담 책 ---------------- */
  const PROVERBS = [
    ['낮말은 새가 듣고 {밤말}은 쥐가 듣는다', '아무도 듣지 않는 곳에서도 말은 늘 조심해야 해요.'],
    ['세 살 {버릇} 여든까지 간다', '어릴 때 든 버릇은 커서도 고치기 어려워요.'],
    ['천 리 길도 한 {걸음부터}', '큰일도 작은 일부터 차근차근 시작해야 해요.'],
    ['{원숭이도} 나무에서 떨어진다', '아무리 잘하는 사람도 실수할 때가 있어요.'],
    ['소 잃고 {외양간} 고친다', '일이 잘못된 뒤에 손을 쓰면 이미 늦어요.'],
    ['{등잔} 밑이 어둡다', '가까이 있는 것을 오히려 잘 모를 때가 있어요.'],
    ['{호랑이도} 제 말 하면 온다', '누군가의 이야기를 하고 있으면 마침 그 사람이 나타나요.'],
    ['{백지장도} 맞들면 낫다', '쉬운 일이라도 힘을 합치면 훨씬 쉬워요.'],
    ['티끌 모아 {태산}', '작은 것도 모이면 아주 큰 것이 돼요.'],
    ['빈 수레가 {요란하다}', '아는 것이 적은 사람일수록 더 떠들어요.'],
    ['고래 싸움에 {새우} 등 터진다', '힘센 사람들 싸움에 약한 사람이 피해를 봐요.'],
    ['우물 안 {개구리}', '넓은 세상을 모르고 자기가 아는 것만 전부인 줄 알아요.'],
    ['하늘이 무너져도 {솟아날} 구멍이 있다', '아무리 어려운 일이 생겨도 헤쳐 나갈 방법은 있어요.'],
    ['{돌다리도} 두들겨 보고 건너라', '잘 아는 일이라도 꼼꼼히 확인하고 조심해야 해요.'],
    ['될성부른 나무는 {떡잎부터} 알아본다', '크게 될 사람은 어릴 때부터 남다른 모습이 보여요.'],
    ['사공이 많으면 배가 {산으로} 간다', '저마다 자기 생각만 내세우면 일이 엉뚱하게 흘러가요.'],
    ['개구리 {올챙이} 적 생각 못 한다', '형편이 나아지면 어려웠던 옛날을 잊어버려요.'],
    ['배보다 {배꼽이} 더 크다', '중요한 것보다 덜 중요한 것이 더 크거나 많아요.'],
    ['바늘 도둑이 {소도둑} 된다', '작은 나쁜 짓도 버릇이 되면 큰 나쁜 짓을 하게 돼요.'],
    ['{윗물이} 맑아야 아랫물이 맑다', '윗사람이 바르게 행동해야 아랫사람도 따라서 바르게 해요.'],
    ['가는 말이 고와야 {오는} 말이 곱다', '내가 남에게 고운 말을 해야 남도 나에게 고운 말을 해요.'],
    ['구슬이 서 말이라도 {꿰어야} 보배', '좋은 것도 잘 다듬어 쓸모 있게 만들어야 값어치가 있어요.'],
    ['열 번 찍어 안 {넘어가는} 나무 없다', '여러 번 꾸준히 노력하면 결국 이룰 수 있어요.'],
    ['말 한마디로 천 냥 {빚을} 갚는다', '말만 잘해도 어려운 일을 풀 수 있어요.'],
  ];
  const BOOK_SLOTS = 12; // 도서관 책장에서 빛나는 책이 꽂힐 수 있는 자리 수
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const HANGUL = 0xac00;
  const isHangul = (ch) => ch.charCodeAt(0) >= HANGUL && ch.charCodeAt(0) <= 0xd7a3;
  const choIndex = (ch) => Math.floor((ch.charCodeAt(0) - HANGUL) / 588);
  const initials = (word) => Array.from(word).map((ch) => (isHangul(ch) ? CHO[choIndex(ch)] : ch)).join('');
  const syllable = (cho, jung, jong) => String.fromCharCode(HANGUL + (cho * 21 + jung) * 28 + (jong || 0));
  const PLAIN_VOWELS = [0, 1, 4, 5, 8, 13, 18, 20]; // ㅏ ㅐ ㅓ ㅔ ㅗ ㅜ ㅡ ㅣ: 헷갈리는 카드도 흔한 글자로
  const SOFT_JONG = [0, 0, 0, 4, 8, 16, 21]; // 받침 없음이 많고, 가끔 ㄴ ㄹ ㅁ ㅇ

  function parseProverb(entry) {
    const m = /\{(.+?)\}/.exec(entry[0]);
    return { before: entry[0].slice(0, m.index), blank: m[1], after: entry[0].slice(m.index + m[0].length), mean: entry[1] };
  }
  /** 정답 글자 + 같은 초성의 헷갈리는 글자 + 다른 속담 글자로 카드를 만들어요 */
  function makeTiles(answer, count, rnd) {
    const chars = Array.from(answer);
    const tiles = chars.slice();
    for (const ch of chars) {
      if (tiles.length >= count) break;
      const c = choIndex(ch);
      let fake = ch;
      for (let k = 0; k < 30 && (fake === ch || tiles.indexOf(fake) >= 0); k++) {
        fake = syllable(c, PLAIN_VOWELS[Math.floor(rnd() * PLAIN_VOWELS.length)], SOFT_JONG[Math.floor(rnd() * SOFT_JONG.length)]);
      }
      if (tiles.indexOf(fake) < 0) tiles.push(fake);
    }
    const pool = shuffle(PROVERBS.map((p) => parseProverb(p).blank).join('').split(''), rnd);
    for (const ch of pool) {
      if (tiles.length >= count) break;
      if (tiles.indexOf(ch) < 0) tiles.push(ch);
    }
    return shuffle(tiles, rnd);
  }
  function makeLibrary(rnd) {
    const all = shuffle(PROVERBS.map(parseProverb), rnd);
    const long = all.filter((p) => Array.from(p.blank).length >= 3);
    const short = all.filter((p) => Array.from(p.blank).length < 3);
    const picks = shuffle([long[0], long[1], short[0]], rnd);
    return {
      books: picks.map((p) => {
        const n = Array.from(p.blank).length;
        return Object.assign({}, p, { cho: initials(p.blank), tiles: makeTiles(p.blank, n >= 4 ? 10 : 8, rnd) });
      }),
      slots: shuffle(range(BOOK_SLOTS), rnd).slice(0, 3),
    };
  }

  /* ---------------- 4. 방송실: 모스 부호 ---------------- */
  const MORSE = { 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
  function makeBroadcast(rnd) {
    let code;
    do code = [randInt(1, 9, rnd), randInt(0, 9, rnd), randInt(0, 9, rnd), randInt(0, 9, rnd)].join('');
    while (new Set(code).size < 3);
    return { code };
  }
  /** 숫자 문자열을 소리 차례로: [{on: 초, off: 초}] (점 1칸, 선 3칸, 글자 사이 3칸) */
  function morseTimeline(code, unit) {
    const u = unit || 0.16;
    const out = [];
    Array.from(String(code)).forEach((d, i) => {
      Array.from(MORSE[d]).forEach((sym, k, arr) => {
        const last = k === arr.length - 1;
        out.push({ on: sym === '.' ? u : 3 * u, off: last ? 0 : u, digit: i, sym });
      });
      if (i < String(code).length - 1) out[out.length - 1].off = 4 * u;
    });
    return out;
  }

  /* ---------------- 5. 교무실: 선생님 자리 논리 퍼즐 ---------------- */
  const SEATS = 5;
  const teacherNames = (myClass) => [myClass + ' 담임', '과학', '음악', '체육', '영어'];
  const PERMS = (function () {
    const out = [];
    const a = range(SEATS);
    (function rec(k) {
      if (k === SEATS) return out.push(a.slice());
      for (let i = k; i < SEATS; i++) {
        let t = a[k];
        a[k] = a[i];
        a[i] = t;
        rec(k + 1);
        t = a[k];
        a[k] = a[i];
        a[i] = t;
      }
    })(0);
    return out; // 각각 pos[선생님] = 자리(0~4)
  })();
  const CLUES = {
    at: { w: 0.8, test: (p, c) => p[c.a] === c.n, text: (T, c) => `${T[c.a]} 선생님은 ${c.n + 1}번 자리예요.` },
    leftOf: { w: 3, test: (p, c) => p[c.a] === p[c.b] - 1, text: (T, c) => `${T[c.a]} 선생님은 ${T[c.b]} 선생님 바로 왼쪽 자리예요.` },
    before: { w: 2, test: (p, c) => p[c.a] < p[c.b], text: (T, c) => `${T[c.a]} 선생님은 ${T[c.b]} 선생님보다 왼쪽에 앉아요.` },
    nextTo: { w: 3, test: (p, c) => Math.abs(p[c.a] - p[c.b]) === 1, text: (T, c) => `${T[c.a]} 선생님과 ${T[c.b]} 선생님은 바로 옆자리예요.` },
    apart: { w: 2, test: (p, c) => Math.abs(p[c.a] - p[c.b]) > 1, text: (T, c) => `${T[c.a]} 선생님과 ${T[c.b]} 선생님은 붙어 앉지 않아요.` },
    end: { w: 1.4, test: (p, c) => p[c.a] === 0 || p[c.a] === SEATS - 1, text: (T, c) => `${T[c.a]} 선생님은 양쪽 끝 자리 중 한 곳에 앉아요.` },
    notEnd: { w: 1.4, test: (p, c) => p[c.a] !== 0 && p[c.a] !== SEATS - 1, text: (T, c) => `${T[c.a]} 선생님은 양쪽 끝 자리가 아니에요.` },
    even: { w: 1, test: (p, c) => (p[c.a] + 1) % 2 === 0, text: (T, c) => `${T[c.a]} 선생님의 자리 번호는 짝수예요.` },
    gap: { w: 1, test: (p, c) => Math.abs(p[c.a] - p[c.b]) === 3, text: (T, c) => `${T[c.a]} 선생님과 ${T[c.b]} 선생님 사이에는 두 자리가 있어요.` },
  };
  const solutionsFor = (clues) => PERMS.filter((p) => clues.every((c) => CLUES[c.type].test(p, c)));

  function trueClues(sol) {
    const out = [];
    for (let a = 0; a < SEATS; a++) {
      out.push({ type: 'at', a, n: sol[a] });
      if (sol[a] === 0 || sol[a] === SEATS - 1) out.push({ type: 'end', a });
      else out.push({ type: 'notEnd', a });
      if ((sol[a] + 1) % 2 === 0) out.push({ type: 'even', a });
      for (let b = 0; b < SEATS; b++) {
        if (a === b) continue;
        const d = sol[b] - sol[a];
        if (d === 1) out.push({ type: 'leftOf', a, b });
        if (d >= 2) out.push({ type: 'before', a, b });
        if (a < b) {
          if (Math.abs(d) === 1) out.push({ type: 'nextTo', a, b });
          else out.push({ type: 'apart', a, b });
          if (Math.abs(d) === 3) out.push({ type: 'gap', a, b });
        }
      }
    }
    return out;
  }

  function makeOffice(rnd, myClass) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const sol = PERMS[Math.floor(rnd() * PERMS.length)];
      const cands = trueClues(sol)
        .map((c) => ({ c, key: Math.pow(rnd(), 1 / CLUES[c.type].w) }))
        .sort((x, y) => y.key - x.key)
        .map((x) => x.c);
      let chosen = [];
      let alive = PERMS;
      for (const c of cands) {
        if (c.type === 'at' && chosen.some((x) => x.type === 'at')) continue;
        const next = alive.filter((p) => CLUES[c.type].test(p, c));
        if (next.length === alive.length) continue; // 새로 알려 주는 것이 없는 단서
        chosen.push(c);
        alive = next;
        if (alive.length === 1) break;
      }
      if (alive.length !== 1) continue;
      for (let i = chosen.length - 1; i >= 0; i--) {
        const without = chosen.filter((_, k) => k !== i);
        if (solutionsFor(without).length === 1) chosen = without;
      }
      if (chosen.length < 4 || chosen.length > 6) continue;
      return { teachers: teacherNames(myClass), solution: sol.slice(), clues: shuffle(chosen, rnd) };
    }
    throw new Error('office puzzle');
  }
  const clueText = (office, c) => CLUES[c.type].text(office.teachers, c);
  /** seats[자리] = 선생님 번호 (모두 채웠을 때만 맞는지 봐요) */
  function checkSeats(office, seats) {
    return seats.length === SEATS && seats.every((t, seat) => office.solution[t] === seat);
  }

  /* ---------------- 6. 보건실: 처방전 쪽지 그림 식 ---------------- */
  const NURSE_SLOTS = 8; // 보건실에서 쪽지가 놓일 수 있는 자리 수
  function makeNurse(rnd) {
    const a = randInt(3, 9, rnd);
    let b;
    do b = randInt(3, 9, rnd);
    while (b === a || b * b - a <= 0);
    const k = randInt(2, 5, rnd);
    const c = k * a + b;
    return {
      a,
      b,
      c,
      k,
      // 그림 식 (🩹 = a, 💊 = b, 🌡️ = c). 곱셈·나눗셈과 괄호를 먼저!
      notes: [
        ['🩹', '+', '🩹', '+', '🩹', '+', '🩹', '=', String(4 * a)],
        ['💊', '×', '💊', '−', '🩹', '=', String(b * b - a)],
        ['(', '🌡️', '−', '💊', ')', '÷', '🩹', '=', String(k)],
        ['🩹', '×', '💊', '+', '🌡️', '=', '?'],
      ],
      answer: a * b + c,
      slots: shuffle(range(NURSE_SLOTS), rnd).slice(0, 4),
    };
  }

  /** 한 판의 모든 수수께끼를 씨앗(seed)으로 정합니다. 같은 씨앗이면 새로고침해도 똑같아요. */
  function createRun(seed, settings) {
    const s = normalizeSettings(settings);
    const rnd = rng(seed);
    const steps = STEPS.map((st) => Object.assign({}, st, { place: st.place || s.myClass }));
    const puzzles = {
      classroom: makeCounting(rnd),
      science: makeScience(rnd),
      library: makeLibrary(rnd),
      broadcast: makeBroadcast(rnd),
      office: makeOffice(rnd, s.myClass),
      nurse: makeNurse(rnd),
      quiz: s.quiz.map((q) => ({ q: q.q, a: q.a })), // 선생님이 낸 문제 (교무실 컴퓨터)
    };
    const digits = {};
    steps.forEach((st) => (digits[st.id] = 1 + Math.floor(rnd() * 9)));
    return {
      seed,
      school: s.school,
      myClass: s.myClass,
      steps,
      exit: EXIT,
      digits,
      lock: shuffle(steps.map((st) => st.id), rnd),
      puzzles,
    };
  }

  /* ---------------- 복도: 경비원을 피해 몰래 지나가기 ----------------
     복도는 x축으로 길게 놓여요. z = -1.5 가 창문 쪽, z = +1.5 가 교실 문 쪽 벽이에요.
     경비원 손전등 불빛 안에 들어가면 들켜서 쫓아와요. 뛰면 발소리가 나서 경비원이 돌아봐요.
     숨을 곳(청소함·화장실·열린 교실 문)에 숨으면 안전해요. 잡히면 복도 처음부터 다시. */
  const HALL_WIDTH = 3;
  const HALL_HEIGHT = 3;
  const Z_MIN = -0.95; // 창가 쪽에는 청소함과 라디에이터가 있어요
  const Z_MAX = 1.15;
  const WALK = 2.5;
  const RUN = 4.2;
  const CATCH = 1.0;
  const HIDE_REACH = 1.1;
  const NOISE = 7; // 뛰는 발소리가 들리는 거리

  const WIDE_ROOMS = ['도서관', '교무실', '과학실', '지능형과학실', '늘봄교실', '돌봄교실', '다이룸터', '몽글마루', '채움실', '나눔실', '정보실'];
  function cellKind(name) {
    if (name === '계단') return 'stairs';
    if (name === '화장실') return 'toilet';
    if (name === 'EV') return 'ev';
    if (name === '현관' || name === '중앙 현관') return 'entrance';
    return 'room';
  }
  function cellWidth(name) {
    const k = cellKind(name);
    if (k === 'stairs') return 4.5;
    if (k === 'toilet') return 4;
    if (k === 'ev') return 2.6;
    if (k === 'entrance') return 6;
    if (/^\d-\d$/.test(name)) return 9;
    if (WIDE_ROOMS.indexOf(name) >= 0) return 10.5;
    return 7.5;
  }
  /** 방 칸의 문 위치: side = -1 이면 왼쪽(x0) 문, +1 이면 오른쪽(x1) 문 */
  function doorX(cell, side) {
    const w = cell.x1 - cell.x0;
    if (cell.kind !== 'room' || w < 8) return (cell.x0 + cell.x1) / 2;
    return side < 0 ? cell.x0 + 1.6 : cell.x1 - 1.6;
  }

  /* fromIndex/toIndex 는 대피 안내도 복도 줄의 칸 번호 */
  const HALLS = [
    {
      id: 'h1',
      building: 'sin',
      floor: 3,
      fromIndex: 7,
      toIndex: 2,
      guard: { speed: 1.1, chase: 3.3, cone: 8, turn: 0, check: 0.6 },
      intro: '가운데 계단으로 신관 3층에 올라왔어요. 경비 아저씨가 순찰 중이에요! 손전등 불빛에 들키지 말고 과학실까지 가요. 뛰면 발소리가 나요!',
    },
    {
      id: 'h2',
      building: 'bon',
      floor: 3,
      fromIndex: 4,
      toIndex: 1,
      guard: { speed: 1.25, chase: 3.5, cone: 8.5, turn: 0.08, check: 0.65 },
      intro: '연결통로를 건너 본관 3층에 왔어요. 도서관은 복도 끝 왼쪽이에요. 경비 아저씨가 가끔 뒤를 돌아봐요.',
    },
    {
      id: 'h3',
      building: 'bon',
      floor: 2,
      fromIndex: 0,
      toIndex: 5,
      guard: { speed: 1.35, chase: 3.7, cone: 9, turn: 0.12, check: 0.7 },
      intro: '왼쪽 계단으로 본관 2층에 내려왔어요. 방송실까지 몰래 가요. 교실을 살피러 들어갔을 때가 기회예요!',
    },
    {
      id: 'h4',
      building: 'bon',
      floor: 2,
      fromIndex: 5,
      toIndex: 8,
      guard: { speed: 1.45, chase: 3.8, cone: 9, turn: 0.16, check: 0.7 },
      intro: '회의실과 교장실 앞을 지나 교무실로 가요. 경비 아저씨가 점점 예민해져요.',
    },
    {
      id: 'h5',
      building: 'bon',
      floor: 1,
      fromIndex: 11,
      toIndex: 7,
      guard: { speed: 1.55, chase: 3.9, cone: 9.5, turn: 0.2, check: 0.75 },
      intro: '동쪽 계단으로 1층에 내려왔어요. 동쪽 현관은 잠겨 있어요! 1학년 교실 앞을 지나 보건실로 가요.',
    },
  ];

  /** 복도 하나를 만듭니다. 칸은 지도 순서(왼쪽→오른쪽) 그대로 놓고, 가는 방향(dir)만 바뀌어요. */
  function createHall(def, seed) {
    const row = BUILDINGS[def.building].floors[def.floor];
    const dir = def.toIndex > def.fromIndex ? 1 : -1;
    const lo = Math.min(def.fromIndex, def.toIndex);
    const hi = Math.max(def.fromIndex, def.toIndex);
    const first = Math.max(0, lo - 1);
    const last = Math.min(row.length - 1, hi + 1);
    const cells = [];
    let x = 0;
    for (let i = first; i <= last; i++) {
      const w = cellWidth(row[i]);
      cells.push({ name: row[i], index: i, x0: x, x1: x + w, kind: cellKind(row[i]) });
      x += w;
    }
    const cellAt = (i) => cells.find((c) => c.index === i);
    const from = cellAt(def.fromIndex);
    const to = cellAt(def.toIndex);
    const startX = from.kind === 'room' ? doorX(from, dir) : (from.x0 + from.x1) / 2;
    const goalX = doorX(to, -dir);

    // 숨을 곳: 화장실, 하나 건너 하나씩 열린 교실 문, 빈 곳은 청소함으로 메워요
    const spots = [];
    let roomCount = 0;
    cells.forEach((c) => {
      if (c.index === def.fromIndex || c.index === def.toIndex) return;
      if (c.kind === 'toilet') spots.push({ x: (c.x0 + c.x1) / 2, z: 1.5, kind: 'toilet', label: '화장실' });
      else if (c.kind === 'room') {
        if (roomCount++ % 2 === 0) spots.push({ x: doorX(c, dir), z: 1.5, kind: 'door', label: c.name + ' 교실 문 안', cell: c.index });
      }
    });
    const inside = (sx) => (sx - startX) * dir > 2 && (goalX - sx) * dir > 2;
    for (let i = spots.length - 1; i >= 0; i--) if (!inside(spots[i].x)) spots.splice(i, 1);
    const near = (sx) => spots.some((sp) => Math.abs(sp.x - sx) < 3);
    const firstSafe = startX + dir * 4.5;
    const lastSafe = goalX - dir * 4;
    if (!near(firstSafe)) spots.push({ x: firstSafe, z: -1.25, kind: 'locker', label: '청소함' });
    if (!near(lastSafe)) spots.push({ x: lastSafe, z: -1.25, kind: 'locker', label: '청소함' });
    spots.sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < spots.length; i++) {
      if (spots[i + 1].x - spots[i].x > 9) {
        spots.splice(i + 1, 0, { x: (spots[i].x + spots[i + 1].x) / 2, z: -1.25, kind: 'locker', label: '청소함' });
      }
    }

    // 경비원은 출발 쪽 7m 밖에서부터 도착 문 3.5m 앞까지 순찰해요
    const a = startX + dir * 7;
    const b = goalX - dir * 3.5;
    const g = def.guard;
    const lo2 = Math.min(a, b);
    const hi2 = Math.max(a, b);
    const guard = {
      min: lo2,
      max: hi2,
      speed: g.speed,
      chaseSpeed: g.chase,
      cone: g.cone,
      turn: g.turn,
      // 순찰하다가 교실 문을 열고 들어가 살펴봐요: 그때가 지나갈 기회!
      // (아이가 숨어 있는 열린 문 교실에는 들어가지 않아요)
      doors: cells
        .filter((c) => c.kind === 'room' && c.index !== def.fromIndex && c.index !== def.toIndex)
        .map((c) => ({ x: doorX(c, -dir), cell: c.index }))
        .filter((d) => d.x >= lo2 + 0.3 && d.x <= hi2 - 0.3)
        .filter((d) => !spots.some((sp) => sp.kind === 'door' && Math.abs(sp.x - d.x) < 2)),
      checkChance: g.check,
    };
    const hall = {
      def,
      dir,
      length: x,
      cells,
      startX,
      goalX,
      goalZ: 1.3,
      spots,
      guard,
      player: null,
      t: 0,
      caught: 0,
      done: false,
      events: [],
      rnd: rng(seed),
    };
    resetHall(hall);
    return hall;
  }

  function resetHall(h) {
    h.player = { x: h.startX, z: 0, hidden: -1, walking: false, running: false };
    const g = h.guard;
    g.x = (g.min + g.max) / 2;
    g.z = 0;
    g.face = h.dir; // 처음엔 등을 보이며 도착 쪽으로 걸어가요
    g.state = 'walk';
    g.timer = 0;
    g.cool = 0;
    g.door = null;
  }

  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  /** 경비원이 복도에 있나요? (교실 안에 들어가 있으면 못 봐요) */
  const inCorridor = (g) => g.state !== 'enter' && g.state !== 'inRoom';

  /** 지금 손전등 불빛 안에 있나요? */
  function inLight(h) {
    const p = h.player;
    const g = h.guard;
    if (p.hidden >= 0 || !inCorridor(g)) return false;
    const d = (p.x - g.x) * g.face;
    return d >= -0.3 && d <= g.cone;
  }

  function spotNear(h, x) {
    let best = -1;
    let bestD = HIDE_REACH;
    h.spots.forEach((sp, i) => {
      const d = Math.abs(sp.x - x);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** input: { vx, vz (m/s, 화면에서 계산), run: 뛰는 중, hide: 숨기 버튼을 누른 순간 } */
  function stepHall(h, input, dt) {
    if (h.done) return;
    h.t += dt;
    const p = h.player;
    const g = h.guard;
    const emit = (type, data) => h.events.push(Object.assign({ type }, data));
    const vx = input.vx || 0;
    const vz = input.vz || 0;
    const moving = Math.abs(vx) + Math.abs(vz) > 0.05;

    // 아이 움직이기 / 숨기
    if (input.hide) {
      if (p.hidden >= 0) {
        const sp = h.spots[p.hidden];
        p.hidden = -1;
        p.z = Math.max(Z_MIN, Math.min(Z_MAX, sp.z > 0 ? 0.6 : -0.5));
        emit('unhide');
      } else {
        const i = spotNear(h, p.x);
        if (i >= 0) {
          p.hidden = i;
          p.x = h.spots[i].x;
          emit('hide', { spot: i });
        }
      }
    } else if (moving && p.hidden >= 0) {
      const sp = h.spots[p.hidden];
      p.hidden = -1;
      p.z = sp.z > 0 ? 0.6 : -0.5;
      emit('unhide');
    }
    p.walking = false;
    p.running = false;
    if (moving && p.hidden < 0) {
      p.x = Math.min(h.length - 0.5, Math.max(0.5, p.x + vx * dt));
      p.z = Math.min(Z_MAX, Math.max(Z_MIN, p.z + vz * dt));
      p.walking = true;
      p.running = !!input.run;
    }
    if (p.hidden < 0 && Math.abs(p.x - h.goalX) < 0.8 && p.z > 0.45) {
      h.done = true;
      emit('goal');
      return;
    }

    // 경비원
    const prev = g.x;
    if (g.cool > 0) g.cool -= dt;
    // 뛰는 발소리가 들리면 그쪽을 돌아봐요
    if (p.running && p.hidden < 0 && inCorridor(g) && (g.state === 'walk' || g.state === 'pause') && Math.abs(p.x - g.x) < NOISE) {
      g.state = 'listen';
      g.timer = 1.3;
      g.face = sign(p.x - g.x) || g.face;
      emit('heard');
    }
    switch (g.state) {
      case 'walk': {
        if (g.x < g.min - 0.05) g.face = 1;
        else if (g.x > g.max + 0.05) g.face = -1;
        g.x += g.face * g.speed * dt;
        g.z += (0 - g.z) * Math.min(1, dt * 4);
        const end = (g.face > 0 && prev < g.max && g.x >= g.max) || (g.face < 0 && prev > g.min && g.x <= g.min);
        const door = g.cool <= 0 ? g.doors.find((d) => (prev - d.x) * (g.x - d.x) <= 0) : undefined;
        if (door && h.rnd() < g.checkChance) {
          g.x = door.x;
          g.door = door;
          g.state = 'enter';
          g.timer = 0.5;
          emit('enterRoom', { cell: door.cell });
        } else if (end) {
          g.x = g.face > 0 ? g.max : g.min;
          g.state = 'pause';
          g.timer = 1 + h.rnd() * 1;
          g.flip = true;
        } else if (g.turn > 0 && h.rnd() < g.turn * dt) {
          g.state = 'pause'; // 갑자기 뒤돌아보기
          g.timer = 0.8 + h.rnd() * 0.8;
          g.flip = true;
          g.face = -g.face;
          emit('look');
        }
        break;
      }
      case 'pause':
        g.timer -= dt;
        if (g.timer <= 0) {
          // 끝에 닿았을 때는 돌아서 걷고, 갑자기 뒤돌아본 뒤에는 원래 방향으로 다시 걸어요
          if (g.flip) g.face = -g.face;
          g.flip = false;
          g.state = 'walk';
        }
        break;
      case 'listen':
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'walk';
        break;
      case 'enter':
        g.timer -= dt;
        g.z += (1.6 - g.z) * Math.min(1, dt * 6);
        if (g.timer <= 0) {
          g.state = 'inRoom';
          g.timer = 3.5 + h.rnd() * 2;
        }
        break;
      case 'inRoom':
        g.timer -= dt;
        if (g.timer <= 0) {
          g.state = 'exit';
          g.timer = 0.5;
          g.cool = 6;
          emit('exitRoom', { cell: g.door && g.door.cell });
        }
        break;
      case 'exit':
        g.timer -= dt;
        g.z += (0 - g.z) * Math.min(1, dt * 6);
        if (g.timer <= 0) {
          g.state = 'walk';
          g.door = null;
        }
        break;
      case 'alert':
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'chase';
        break;
      case 'chase':
        if (p.hidden >= 0) {
          g.state = 'search';
          g.timer = 2;
          emit('lost');
          break;
        }
        g.face = sign(p.x - g.x) || g.face;
        g.x += g.face * g.chaseSpeed * dt;
        g.z += (p.z - g.z) * Math.min(1, dt * 3);
        break;
      case 'search':
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'walk';
        break;
      default:
        break;
    }

    if (g.state !== 'alert' && g.state !== 'chase' && inLight(h)) {
      g.state = 'alert';
      g.timer = 0.5;
      g.face = sign(p.x - g.x) || g.face;
      emit('spotted');
    }
    if (p.hidden < 0 && inCorridor(g) && Math.abs(p.x - g.x) < CATCH && Math.abs(p.z - g.z) < 1.3) {
      h.caught++;
      emit('caught');
      resetHall(h);
    }
  }

  /** 한 판의 순서: 방 → 복도 → 방 → … → 보건실 → 중앙 현관 */
  function route() {
    const list = [];
    STEPS.forEach((st, i) => {
      list.push({ kind: 'room', id: st.id });
      if (HALLS[i]) list.push({ kind: 'hall', id: HALLS[i].id });
    });
    list.push({ kind: 'exit', id: EXIT.id });
    return list;
  }

  /* ---------------- 정답 확인 ---------------- */
  const norm = (str) => String(str == null ? '' : str).toLowerCase().replace(/[\s.,!?~·'"()\-]/g, '');

  /** 선생님 퀴즈 답: 띄어쓰기·문장부호는 무시하고, 쉼표로 여러 답을 허용해요 */
  function checkAnswer(input, answer) {
    const n = norm(input);
    if (!n) return false;
    return String(answer)
      .split(/[,，/]/)
      .some((alt) => norm(alt) === n);
  }

  function checkLock(run, entered) {
    return run.lock.every((id, i) => Number(entered[i]) === run.digits[id]);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------------- 선생님 설정 (주소에 담아 학생 기기로 보냅니다) ---------------- */
  function normalizeSettings(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const school = typeof r.school === 'string' && r.school.trim() ? r.school.trim().slice(0, 20) : DEFAULT_SCHOOL;
    const myClass = CLASSES.indexOf(r.myClass) >= 0 ? r.myClass : DEFAULT_CLASS;
    const quiz = (Array.isArray(r.quiz) ? r.quiz : [])
      .filter((q) => q && typeof q.q === 'string' && typeof q.a === 'string' && q.q.trim() && q.a.trim())
      .slice(0, 3)
      .map((q) => ({ q: q.q.trim().slice(0, 80), a: q.a.trim().slice(0, 40) }));
    return { school, myClass, quiz };
  }

  function toBase64(bytes) {
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function encodeSettings(settings) {
    const s = normalizeSettings(settings);
    return toBase64(new TextEncoder().encode(JSON.stringify({ v: 1, school: s.school, myClass: s.myClass, quiz: s.quiz })));
  }

  function decodeSettings(code) {
    try {
      const b64 = String(code).replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      return obj && obj.v === 1 ? normalizeSettings(obj) : null;
    } catch (e) {
      return null;
    }
  }

  root.EscapeCore = {
    DEFAULT_SCHOOL,
    DEFAULT_CLASS,
    HINT_PENALTY,
    CAUGHT_PENALTY,
    BUILDINGS,
    CLASSES,
    STEPS,
    EXIT,
    locate,
    rng,
    shuffle,
    // 수수께끼
    HIDE_SLOTS,
    COUNT_FORMS,
    POTIONS,
    RECIPES,
    COLORS,
    checkPotion,
    potionResult,
    PROVERBS,
    BOOK_SLOTS,
    initials,
    MORSE,
    morseTimeline,
    SEATS,
    clueText,
    solutionsFor,
    checkSeats,
    NURSE_SLOTS,
    createRun,
    // 복도
    HALL_WIDTH,
    HALL_HEIGHT,
    Z_MIN,
    Z_MAX,
    WALK,
    RUN,
    CATCH,
    HIDE_REACH,
    NOISE,
    HALLS,
    cellKind,
    cellWidth,
    doorX,
    createHall,
    resetHall,
    stepHall,
    inLight,
    inCorridor,
    spotNear,
    route,
    // 확인
    checkAnswer,
    checkLock,
    formatTime,
    normalizeSettings,
    encodeSettings,
    decodeSettings,
  };
})(typeof module === 'object' && module.exports ? module.exports : window);
