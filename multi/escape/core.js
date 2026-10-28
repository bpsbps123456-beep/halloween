/* 동암초 탈출 3D — 학교 지도, 탈출 경로, 수수께끼, 복도 경비원
   화면(3D)과 떨어져 있어서 Node에서도 돌아갑니다 (tests/escape.test.js 가 이 파일을 씁니다).
   학교 지도는 선생님이 주신 신관·본관 대피 안내도를 옮긴 것입니다. 길이 단위는 미터예요. */
(function (root) {
  'use strict';

  const DEFAULT_SCHOOL = '동암초등학교';
  const DEFAULT_CLASS = '6-3'; // 우리 반 (신관 2층)
  const DEFAULT_SEED = 20261031; // 문제 고정 번호 (선생님 정답지가 이 판 기준)
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
     수수께끼는 6학년 1학기까지 배운 것에 맞췄어요 (소수·분수의 나눗셈, 비와 비율, 혼합 계산, 속담, 모스 부호, 논리 추론). */
  const STEPS = [
    { id: 'classroom', place: null, icon: '🎃', title: '칠판의 수수께끼', goal: '교실에 숨은 호박·박쥐·거미를 모두 세어 칠판의 식을 풀어요. 답은 선생님 책상 서랍 비밀번호!' },
    { id: 'science', place: '과학실', icon: '🧪', title: '마녀의 물약', goal: '칠판의 나눗셈과 비율로 물약 양을 구해 솥에 부어요. 물약 3가지를 만들어요.' },
    { id: 'library', place: '도서관', icon: '📚', title: '속담 책장', goal: '책장 어딘가에서 보랏빛으로 빛나는 책 3권을 찾아 속담의 빈칸을 채워요.' },
    { id: 'broadcast', place: '방송실', icon: '📢', title: '유령의 모스 부호', goal: '방송 장비로 유령 방송을 들으면 종이에 ● ▬ 가 찍혀요. 모스 부호표와 맞춰 4자리 비밀번호를 찾아요.' },
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

  /* ---------------- 2. 과학실: 물약 (소수의 나눗셈 · 분수의 나눗셈 · 비와 비율) ----------------
     첫 물약 양은 나눗셈으로, 나머지는 '○○에 대한 비율'로 구해요. 양은 모두 10mL 눈금에 딱 맞아요. */
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
  const num = (x) => String(Math.round(x * 1000) / 1000);
  // 비율: [값, 분수로, 소수로, 백분율로]
  // 아이들이 어려워하지 않는 쉬운 비율만 써요 (기준량의 10%, 50%, 100%)
  const RATES = [
    [1 / 10, '10%'],
    [1 / 2, '50%'],
    [1, '100%'],
  ];
  /** 첫 물약 양을 나눗셈 식으로: 소수의 나눗셈 또는 분수의 나눗셈 */
  function divisionFor(A, rnd) {
    if (rnd() < 0.5) {
      const ds = [0.2, 0.4, 0.5, 0.6, 0.8, 0.05, 0.04, 0.02, 0.06, 0.08, 1.2, 1.5];
      const d = ds[Math.floor(rnd() * ds.length)];
      return num(A * d) + ' ÷ ' + num(d);
    }
    // (자연수) ÷ (분수): 예) 60 ÷ 3/8 = 160
    const opts = [];
    for (let b = 2; b <= 9; b++)
      for (let a = 2; a < b; a++) {
        const n = (A * a) / b;
        if (gcd(a, b) === 1 && Number.isInteger(n) && n >= 6 && n <= 120) opts.push(n + ' ÷ ' + a + '/' + b);
      }
    if (!opts.length) return divisionFor(A, () => 0.1);
    return opts[Math.floor(rnd() * opts.length)];
  }
  function makeRecipe(color, rnd) {
    const parts = RECIPES[color];
    const rates = shuffle(RATES, rnd).slice(0, parts.length - 1);
    // 10%가 있으면 100의 배수, 50%가 있으면 20의 배수: 모든 양이 10mL 눈금에 딱 맞아요
    const step = rates.some((r) => r[0] === 1 / 10) ? 100 : rates.some((r) => r[0] === 1 / 2) ? 20 : 10;
    const A = step * randInt(Math.ceil(80 / step), Math.floor(300 / step), rnd); // 80~300mL
    const amounts = [A].concat(rates.map((r) => Math.round(A * r[0])));
    const lines = [parts[0] + ' = ' + divisionFor(A, rnd) + ' (mL)'].concat(rates.map((r, i) => parts[0] + '에 대한 ' + parts[i + 1] + '의 비율 = ' + r[1]));
    return { color, parts, amounts, lines, total: amounts.reduce((x, y) => x + y, 0) };
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
  /** 선생님 이름을 정해 두면 담임 선생님은 이름으로 나와요 (예: 홍길동 선생님) */
  const teacherNames = (myClass, teacher) => [teacher || myClass + ' 담임', '과학', '음악', '체육', '영어'];
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

  function makeOffice(rnd, myClass, teacher) {
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
      return { teachers: teacherNames(myClass, teacher), solution: sol.slice(), clues: shuffle(chosen, rnd) };
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
      office: makeOffice(rnd, s.myClass, s.teacher),
      nurse: makeNurse(rnd),
      quiz: s.quiz.map((q) => ({ q: q.q, a: q.a })), // 선생님이 낸 문제 (교무실 컴퓨터)
    };
    const digits = {};
    steps.forEach((st) => (digits[st.id] = 1 + Math.floor(rnd() * 9)));
    return {
      seed,
      school: s.school,
      myClass: s.myClass,
      // 우리 반만의 것: 칠판·급훈·사물함 이름표에 나와요
      teacher: s.teacher,
      motto: s.motto,
      duty: s.duty,
      noisy: s.noisy,
      friends: s.friends,
      steps,
      exit: EXIT,
      digits,
      lock: shuffle(steps.map((st) => st.id), rnd),
      puzzles,
    };
  }

  /* ---------------- 복도: 경비원을 피해 몰래 지나가기 ----------------
     복도는 x축으로 길게 놓여요. z = -1.5 가 창문 쪽, z = +1.5 가 교실 쪽 벽이에요.
     - 손전등 불빛에 오래 비치면 들켜요 (가까울수록 빨리). 잠깐 비쳤다 빠지면 "응?" 하고 그 자리를 살피러 와요.
     - 뛰면 발소리를 듣고 소리 난 곳으로 와 봐요.
     - 숨을 곳: 청소함·화장실, 계단(아래층으로 도망), 문이 열린 교실(앞문으로 들어가 뒷문으로 나올 수 있어요).
     - 쫓아올 때 경비원 눈앞에서 숨으면 그 청소함을 열어 봐요! 교실이나 계단으로 따돌려요.
     잡히면 복도 처음부터 다시. */
  const HALL_WIDTH = 3;
  const HALL_HEIGHT = 3;
  const WALL_Z = HALL_WIDTH / 2; // 교실 쪽 벽
  const Z_MIN = -0.95; // 창가 쪽에는 청소함과 라디에이터가 있어요
  const Z_MAX = 1.15;
  const ROOM_DEPTH = 6.5; // 열린 교실: 복도 벽(z 1.5)부터 창문 벽(z 8)까지
  const ROOM_Z0 = 1.85; // 교실 안에서 걸을 수 있는 곳 (책상은 청소 시간처럼 뒤로 밀어 두었어요)
  const ROOM_Z1 = 5.4;
  const ROOM_INSET = 1.1;
  const DOOR_HALF = 0.36;
  const WALK = 2.5;
  const RUN = 4.2;
  const CATCH = 1.0;
  const HIDE_REACH = 1.1;
  const STAIRS_REACH = 1.7;
  const NOISE = 7; // 뛰는 발소리가 들리는 거리
  const DOOR_NOISE = 5; // 드르륵: 미닫이문 여는 소리가 들리는 거리
  const SEE_HALF = 0.45; // 손전등 불빛의 반각 (라디안)

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
  /** 방 칸의 문 전부 (넓은 방은 앞문·뒷문) */
  function doorsOf(cell) {
    return cell.x1 - cell.x0 >= 8 ? [cell.x0 + 1.6, cell.x1 - 1.6] : [(cell.x0 + cell.x1) / 2];
  }

  /* 교실을 나와서 처음 걷는 신관 2층 복도: 바로 옆 계단으로 1층 현관까지 내려가요.
     경비 아저씨는 저쪽 끝(채움실 쪽)을 순찰해요. */
  const FIRST_HALL = {
    id: 'h0',
    building: 'sin',
    floor: 2,
    fromIndex: 1,
    toIndex: 0,
    startSide: 1, // 6-3 뒷문으로 나와요
    patrol: [36, 50],
    goalLabel: '계단 (1층 현관으로)',
    guard: { speed: 1.0, chase: 3.2, cone: 6.5, turn: 0, check: 0.5 },
    intro: '6-3 교실을 빠져나왔어요. 복도는 캄캄해요… 교실 앞 신발장을 지나 바로 옆 계단으로 1층 현관까지 내려가요. 저쪽 끝에 경비 아저씨 손전등이 보여요! 다른 실도 둘러볼 수 있어요.',
  };

  /* fromIndex/toIndex 는 대피 안내도 복도 줄의 칸 번호 */
  const HALLS = [
    {
      id: 'h1',
      building: 'sin',
      floor: 3,
      fromIndex: 7,
      toIndex: 2,
      guard: { speed: 1.1, chase: 3.3, cone: 7.5, turn: 0, check: 0.6 },
      intro: '신관 현관은 막혔어요! 1층 복도를 지나 가운데 계단으로 신관 3층까지 올라왔어요. 먼저 과학실! 그다음 복도 가운데 연결다리로 본관에 건너가요. 경비 아저씨가 순찰 중이에요! 불빛에 오래 비치면 들켜요.',
    },
    {
      id: 'h2',
      building: 'bon',
      floor: 3,
      fromIndex: 5,
      toIndex: 1,
      fromBridge: true,
      guard: { speed: 1.25, chase: 3.5, cone: 8, turn: 0.06, check: 0.65 },
      intro: '신관 3층 가운데 연결다리를 건너 본관 3층에 왔어요. 도서관은 복도 끝 왼쪽이에요. 문이 열린 교실은 들어갈 수 있어요. 앞문으로 들어가 뒷문으로 나오면 경비 아저씨를 따돌려요!',
    },
    {
      id: 'h3',
      building: 'bon',
      floor: 2,
      fromIndex: 0,
      toIndex: 5,
      guard: { speed: 1.3, chase: 3.6, cone: 8, turn: 0.08, check: 0.7 },
      intro: '왼쪽 계단으로 본관 2층에 내려왔어요. 방송실까지 몰래 가요. 교실을 살피러 들어갔을 때가 기회예요! 경비 아저씨가 멈춰 서면 곧 뒤돌아봐요.',
    },
    {
      id: 'h4',
      building: 'bon',
      floor: 2,
      fromIndex: 5,
      toIndex: 8,
      guard: { speed: 1.4, chase: 3.7, cone: 8.5, turn: 0.1, check: 0.7 },
      intro: '회의실과 교장실 앞을 지나 교무실로 가요. 문이 하나뿐인 방은 막다른 곳이에요. 쫓길 때는 들어가지 마요!',
    },
    {
      id: 'h5',
      building: 'bon',
      floor: 1,
      fromIndex: 11,
      toIndex: 7,
      guard: { speed: 1.5, chase: 3.8, cone: 9, turn: 0.12, check: 0.75 },
      intro: '동쪽 계단으로 1층에 내려왔어요. 동쪽 현관은 잠겨 있어요! 1학년 교실 앞을 지나 보건실로 가요. 경비 아저씨가 점점 예민해져요.',
    },
  ];

  /** 실 종류: 열린 실 안을 꾸밀 때 써요 */
  function roomType(name) {
    if (/^\d-\d$/.test(name)) return 'classroom';
    if (/연구실|교무실|교장실|행정실/.test(name)) return 'teacher';
    if (/회의실|미래실|연수실/.test(name)) return 'meeting';
    if (/시약실|과학실/.test(name)) return 'lab';
    if (/정보실|서버실/.test(name)) return 'computer';
    if (/자료실|문서고/.test(name)) return 'storage';
    if (name === '도서관') return 'library';
    if (name === '방송실') return 'broadcast';
    if (name === '보건실') return 'nurse';
    return 'care'; // 다이룸터·채움실·나눔실·어울림실·돌봄교실·늘봄교실·유치원·도움반
  }
  /** 밤에는 늘 잠가 두는 실 */
  const ALWAYS_LOCKED = ['교장실', '행정실', '서버실', '문서고'];

  /** 복도 하나를 만듭니다. 대피 안내도의 그 층 실을 모두 만들고(들어갈 수 있는 실·잠긴 실),
      칸은 지도 순서(왼쪽→오른쪽) 그대로 놓고, 가는 방향(dir)만 바뀌어요. */
  function createHall(def, seed) {
    const row = BUILDINGS[def.building].floors[def.floor];
    const dir = def.toIndex > def.fromIndex ? 1 : -1;
    const cells = [];
    let x = 0;
    row.forEach((name, i) => {
      const w = cellWidth(name);
      cells.push({ name, index: i, x0: x, x1: x + w, kind: cellKind(name), type: cellKind(name) === 'room' ? roomType(name) : cellKind(name) });
      x += w;
    });
    const from = cells[def.fromIndex];
    const to = cells[def.toIndex];
    // 3층은 복도 가운데에서 연결다리로 신관과 본관이 이어져요
    const bridgeX = def.floor === 3 ? Math.round((x / 2) * 10) / 10 : null;
    let startX = from.kind === 'room' ? doorX(from, def.startSide || dir) : (from.x0 + from.x1) / 2;
    if (def.fromBridge) startX = bridgeX;
    const fromCell = def.fromBridge ? -1 : def.fromIndex;
    const goalX = doorX(to, -dir);

    // 실마다: 들어갈 수 있는 실(하나 건너 하나), 잠긴 실, 나중에 갈 실(다른 수수께끼 방), 다녀온 실
    const later = STEPS.map((st) => st.place).concat([EXIT.place]);
    const rooms = [];
    const locked = [];
    let roomCount = 0;
    cells.forEach((c) => {
      if (c.kind !== 'room' || c.index === def.toIndex) return;
      if (c.index === fromCell) {
        locked.push({ cell: c.index, name: c.name, doors: doorsOf(c), why: 'done' });
        return;
      }
      const k = roomCount++;
      if (later.indexOf(c.name) >= 0) locked.push({ cell: c.index, name: c.name, doors: doorsOf(c), why: 'later' });
      else if (ALWAYS_LOCKED.indexOf(c.name) >= 0 || k % 2) locked.push({ cell: c.index, name: c.name, doors: doorsOf(c), why: 'locked' });
      else rooms.push({ cell: c.index, name: c.name, type: c.type, x0: c.x0, x1: c.x1, ix0: c.x0 + ROOM_INSET, ix1: c.x1 - ROOM_INSET, doors: doorsOf(c) });
    });

    // 숨을 곳: 화장실, 계단(아래층으로), 빈 곳은 청소함으로 메워요
    const spots = [];
    cells.forEach((c) => {
      if (c.index === def.toIndex) return;
      const mid = (c.x0 + c.x1) / 2;
      if (c.kind === 'toilet') spots.push({ x: mid, z: 1.5, kind: 'toilet', label: '화장실' });
      // 계단은 출발 자리에 있어도 돼요: 들키면 아래층으로 내려가 따돌려요
      if (c.kind === 'stairs') spots.push({ x: mid, z: 1.5, kind: 'stairs', label: '아래층 계단', downX: c.x1 - 1.4 });
    });
    const havens = () => spots.map((sp) => sp.x).concat(...rooms.map((r) => r.doors));
    const near = (sx) => havens().some((hx) => Math.abs(hx - sx) < 3);
    // 청소함은 창가 쪽: 연결다리 입구 앞에는 두지 않아요
    const addLocker = (lx) => {
      let px = lx;
      if (bridgeX != null && Math.abs(px - bridgeX) < 1.8) px = bridgeX + (px < bridgeX ? -1.8 : 1.8);
      spots.push({ x: Math.max(1, Math.min(x - 1, px)), z: -1.25, kind: 'locker', label: '청소함' });
    };
    const firstSafe = startX + dir * 4.5;
    const lastSafe = goalX - dir * 4;
    if (!near(firstSafe)) addLocker(firstSafe);
    if (!near(lastSafe)) addLocker(lastSafe);
    for (let guard = 0; guard < 40; guard++) {
      const xs = havens()
        .concat([startX])
        .filter((hx) => hx > 1.5 && hx < x - 1.5)
        .sort((p, q) => p - q);
      // 출발~도착 사이(경비원이 다니는 곳)는 숨을 곳을 조금 더 촘촘하게
      const lo = Math.min(startX, goalX);
      const hi = Math.max(startX, goalX);
      let gap = -1;
      for (let i = 0; i + 1 < xs.length; i++) if (xs[i + 1] - xs[i] > (xs[i] >= lo - 1 && xs[i + 1] <= hi + 1 ? 7.5 : 9)) gap = i;
      if (gap < 0) break;
      addLocker((xs[gap] + xs[gap + 1]) / 2);
    }
    spots.sort((p, q) => p.x - q.x);

    // 경비원은 출발 쪽 7m 밖에서부터 도착 문 3.5m 앞까지 순찰해요 (따로 정한 곳이 있으면 거기)
    const a = def.patrol ? def.patrol[0] : startX + dir * 7;
    const b = def.patrol ? def.patrol[1] : goalX - dir * 3.5;
    const g = def.guard;
    const lo2 = Math.min(a, b);
    const hi2 = Math.max(a, b);
    const inPatrol = (d) => d.x >= lo2 + 0.3 && d.x <= hi2 - 0.3;
    const guard = {
      min: lo2,
      max: hi2,
      speed: g.speed,
      chaseSpeed: g.chase,
      cone: g.cone,
      turn: g.turn,
      // 순찰하다가 잠긴 실 문을 열쇠로 열고 들어가 살펴봐요: 그때가 지나갈 기회!
      doors: locked
        .filter((l) => l.why !== 'done')
        .reduce((all, l) => all.concat(l.doors.map((dx) => ({ x: dx, cell: l.cell }))), [])
        .filter(inPatrol),
      // 열린 실은 문 앞에 서서 손전등으로 안을 비춰 봐요
      peeks: [].concat(...rooms.map((r) => r.doors.map((d) => ({ x: d, cell: r.cell })))).filter(inPatrol),
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
      bridgeX,
      spots,
      rooms,
      locked,
      evs: cells.filter((c) => c.kind === 'ev').map((c) => (c.x0 + c.x1) / 2),
      entrances: cells.filter((c) => c.kind === 'entrance' && c.index !== def.fromIndex).map((c) => ({ x: (c.x0 + c.x1) / 2, name: c.name })),
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
    h.player = { x: h.startX, z: 0, hidden: -1, hold: false, walking: false, running: false };
    h.doorOpen = {}; // 들어갈 수 있는 실도 문은 처음엔 닫혀 있어요 (드르륵 열어야 해요)
    const g = h.guard;
    g.x = (g.min + g.max) / 2;
    g.z = 0;
    g.face = h.dir; // 처음엔 등을 보이며 도착 쪽으로 걸어가요
    g.ang = h.dir > 0 ? 0 : Math.PI;
    g.state = 'walk';
    g.timer = 0;
    g.cool = 0;
    g.door = null;
    g.sus = 0; // 의심: 1 이 되면 들켜요
    g.clue = null; // 살피러 갈 곳
    g.lastSeen = null;
    g.lostT = 0;
    g.saw = -1; // 숨는 걸 본 숨을 곳
    g.target = -1;
    g.glimpse = null;
    g.moving = false;
    g.phase = 0;
  }

  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  /** 경비원이 복도에 있나요? (닫힌 교실 안에 들어가 있으면 못 봐요) */
  const inCorridor = (g) => g.state !== 'enter' && g.state !== 'inRoom';
  const hunting = (g) => g.state === 'alert' || g.state === 'chase';

  /** 그 자리가 열린 교실 안이면 그 교실 */
  function roomAt(h, x, z) {
    if (z < WALL_Z) return null;
    return h.rooms.find((r) => x >= r.x0 && x <= r.x1) || null;
  }
  const regionOf = (h, x, z) => {
    const r = roomAt(h, x, z);
    return r ? r.cell : -1;
  };
  /** 아이가 설 수 있는 곳: 복도, 열린 문 통로, 열린 교실 안 */
  function walkable(h, x, z) {
    if (z <= Z_MAX) return z >= Z_MIN && x >= 0.5 && x <= h.length - 0.5;
    for (const r of h.rooms) {
      if (z >= ROOM_Z0 && z <= ROOM_Z1 && x >= r.ix0 && x <= r.ix1) return true;
      if (z < ROOM_Z0 + 1e-9 && r.doors.some((d) => Math.abs(x - d) <= DOOR_HALF && isDoorOpen(h, d))) return true;
    }
    return false;
  }
  /* 미닫이문: 열린 문만 지나갈 수 있어요. by = 'player' | 'guard' */
  const doorKey = (d) => d.toFixed(2);
  const isDoorOpen = (h, d) => !!(h.doorOpen && h.doorOpen[doorKey(d)]);
  function openDoor(h, d, by) {
    if (isDoorOpen(h, d)) return false;
    h.doorOpen[doorKey(d)] = by;
    h.events.push({ type: 'doorOpen', x: d, by });
    return true;
  }
  /** 가까운 열린 교실 문 */
  function doorNear(h, x, reach) {
    let best = null;
    let bd = reach;
    h.rooms.forEach((r) =>
      r.doors.forEach((d) => {
        if (Math.abs(d - x) <= bd) {
          bd = Math.abs(d - x);
          best = d;
        }
      })
    );
    return best;
  }
  function bestDoor(r, ax, tx) {
    let best = r.doors[0];
    r.doors.forEach((d) => {
      if (Math.abs(ax - d) + Math.abs(d - tx) < Math.abs(ax - best) + Math.abs(best - tx)) best = d;
    });
    return best;
  }
  /** 경비원이 다음에 걸어갈 곳: 복도와 교실 사이는 문으로만 다녀요 */
  function waypoint(h, ax, az, tx, tz) {
    const ra = roomAt(h, ax, az);
    const rt = roomAt(h, tx, tz);
    if (ra === rt) return [tx, tz];
    const inZ = ROOM_Z0 + 0.15;
    if (ra) {
      const d = bestDoor(ra, ax, tx);
      if (Math.abs(ax - d) > 0.03) return [d, Math.max(az, inZ)];
      openDoor(h, d, 'guard'); // 경비원도 문을 열고 다녀요
      return [d, 1.0];
    }
    const d = bestDoor(rt, ax, tx);
    if (Math.abs(ax - d) < 0.03 && az > 0.97) {
      openDoor(h, d, 'guard');
      return [d, inZ];
    }
    return [d, 1.0];
  }
  function turnTo(g, ang, dt, rate) {
    const d = wrap(ang - g.ang);
    const k = (rate || 9) * dt;
    g.ang = Math.abs(d) <= k ? ang : wrap(g.ang + sign(d) * k);
  }
  /** 경비원을 (tx, tz) 쪽으로 걸려요. 닿으면 true */
  function walkTo(h, g, tx, tz, speed, dt) {
    let step = speed * dt;
    for (let k = 0; k < 3 && step > 1e-9; k++) {
      const [wx, wz] = waypoint(h, g.x, g.z, tx, tz);
      const dx = wx - g.x;
      const dz = wz - g.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-9) break;
      turnTo(g, Math.atan2(dz, dx), dt);
      if (Math.abs(dx) > 0.01) g.face = sign(dx);
      const s = Math.min(d, step);
      g.x += (dx / d) * s;
      g.z += (dz / d) * s;
      step -= s;
      g.moving = true;
    }
    return Math.hypot(tx - g.x, tz - g.z) < 0.05;
  }

  /** 경비원 눈에 아이가 보이나요? 0 이면 안 보이고, 가까울수록 1에 가까워요 */
  function sight(h) {
    const p = h.player;
    const g = h.guard;
    if (p.hidden >= 0 || !inCorridor(g)) return 0;
    if (regionOf(h, p.x, p.z) !== regionOf(h, g.x, g.z)) return 0;
    const dx = p.x - g.x;
    const dz = p.z - g.z;
    const d = Math.hypot(dx, dz);
    if (d > g.cone) return 0;
    const off = Math.abs(wrap(Math.atan2(dz, dx) - g.ang));
    if (off > (d < 1.4 ? Math.PI / 2 + 0.3 : SEE_HALF)) return 0;
    return Math.max(0.05, 1 - d / (g.cone + 0.5));
  }
  /** 지금 손전등 불빛 안에 있나요? */
  const inLight = (h) => sight(h) > 0;

  function spotNear(h, x, z) {
    if (z != null && z > Z_MAX + 0.05) return -1;
    let best = -1;
    let bestD = 1e9;
    h.spots.forEach((sp, i) => {
      const d = Math.abs(sp.x - x);
      if (d <= (sp.kind === 'stairs' ? STAIRS_REACH : HIDE_REACH) && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
  /** 숨을 곳 앞 경비원이 서는 자리 */
  const spotFront = (sp) => ({ x: sp.x, z: sp.z < 0 ? -0.45 : 0.9 });

  /** 살피러 갈 곳을 정해요. 그 자리 바로 옆에 청소함이 있으면 열어 보고, 열린 교실 문 앞이면 교실 안을 비춰 봐요. */
  function setClue(h, x, z, why, noSpot) {
    const g = h.guard;
    const r = roomAt(h, x, z);
    // 같은 실 안에서 언뜻 봤으면 그 자리로 곧장 가서 둘러봐요
    if (r && why === 'glimpse' && regionOf(h, g.x, g.z) === r.cell) {
      g.clue = { x, z: Math.max(ROOM_Z0, Math.min(ROOM_Z1, z)), why, spot: -1, room: -1 };
      return;
    }
    if (r) {
      g.clue = { x: bestDoor(r, g.x, x), z: 1.0, why, spot: -1, room: r.cell };
      return;
    }
    let spot = -1;
    let bd = 1.4;
    if (!noSpot)
      h.spots.forEach((sp, i) => {
        if (sp.kind !== 'stairs' && Math.abs(sp.x - x) < bd) {
          bd = Math.abs(sp.x - x);
          spot = i;
        }
      });
    let room = -1;
    const d = spot < 0 && z > 0.5 ? doorNear(h, x, 1.2) : null;
    if (d != null) room = h.rooms.find((rr) => rr.doors.indexOf(d) >= 0).cell;
    g.clue = { x, z, why, spot, room };
  }
  /** 도착한 곳에서 무엇을 할까: 청소함 열기 / 교실 비추기 / 둘러보기 */
  function searchAt(h, emit) {
    const g = h.guard;
    const c = g.clue || { x: g.x, z: g.z, spot: -1, room: -1 };
    g.clue = null;
    if (c.spot >= 0) {
      g.target = c.spot;
      g.state = 'goCheck';
      return;
    }
    const room = h.rooms.find((r) => r.cell === c.room);
    // 방금 뒤진 실은 또 뒤지지 않고 그 자리에서 둘러봐요 (같은 곳을 끝없이 맴돌지 않게)
    const recent = room && g.searched && g.searched.cell === room.cell && h.t - g.searched.t < 12;
    if (room && !recent) {
      g.searched = { cell: room.cell, t: h.t };
      g.state = 'roomSearch';
      g.door = { x: bestDoor(room, g.x, c.x), cell: room.cell };
      g.timer = 3.5;
      g.phase = 0;
      emit('roomSearch', { cell: room.cell });
      return;
    }
    g.state = 'search';
    g.timer = 2.4;
    g.phase = g.ang;
  }

  /** input: { vx, vz (m/s, 화면에서 계산), run: 뛰는 중, hide: 숨기 버튼을 누른 순간 } */
  function stepHall(h, input, dt) {
    if (h.done) return;
    h.t += dt;
    const p = h.player;
    const g = h.guard;
    const emit = (type, data) => h.events.push(Object.assign({ type }, data));
    let vx = input.vx || 0;
    const vz = input.vz || 0;
    const moving = Math.abs(vx) + Math.abs(vz) > 0.05;
    const caught = (why) => {
      h.caught++;
      emit('caught', { why });
      resetHall(h);
    };

    // 아이 숨기 / 나오기
    const unhide = () => {
      const sp = h.spots[p.hidden];
      p.hidden = -1;
      p.z = sp.kind === 'locker' ? -0.5 : sp.kind === 'stairs' ? 0.75 : 0.6;
      emit('unhide', { kind: sp.kind });
    };
    if (input.hide) {
      if (p.hidden >= 0) unhide();
      else {
        const i = spotNear(h, p.x, p.z);
        const dd = i < 0 && p.z > 0.3 ? doorNear(h, p.x, 0.8) : null;
        if (dd != null) openDoor(h, dd, 'player'); // 문 앞에서 누르면 드르륵
        else if (i >= 0) {
          // 경비원 눈앞에서 숨으면 경비원이 그걸 봐요
          const dist = Math.hypot(p.x - g.x, p.z - g.z);
          const seen = sight(h) > 0 || (hunting(g) && inCorridor(g) && regionOf(h, g.x, g.z) < 0 && dist < g.cone + 1);
          p.hidden = i;
          p.hold = moving; // 걷던 손을 떼기 전까지는 그대로 숨어 있어요
          p.x = h.spots[i].x;
          g.saw = seen ? i : -1;
          emit('hide', { spot: i, kind: h.spots[i].kind, seen });
        }
      }
    } else if (moving && p.hidden >= 0 && !p.hold) unhide();
    if (!moving) p.hold = false;
    p.walking = false;
    p.running = false;
    if (moving && p.hidden < 0) {
      // 열린 교실 문 앞에서 문 쪽으로 가면 문 가운데로 살짝 끌어 줘요
      const d = doorNear(h, p.x, 0.95);
      const pushIn = vz > 0.2 && p.z > Z_MAX - 0.4 && p.z < ROOM_Z0;
      const pushOut = vz < -0.2 && p.z > Z_MAX - 0.05 && p.z < ROOM_Z0 + 0.45;
      if (d != null && (pushIn || pushOut)) {
        vx += Math.max(-2.5, Math.min(2.5, (d - p.x) * 7));
        // 닫힌 문을 밀면 드르륵 열려요
        if (Math.abs(d - p.x) < 0.6 && ((pushIn && p.z > Z_MAX - 0.2) || (pushOut && p.z < ROOM_Z0 + 0.3))) openDoor(h, d, 'player');
      }
      const nx = p.x + vx * dt;
      const nz = p.z + vz * dt;
      if (walkable(h, nx, nz)) {
        p.x = nx;
        p.z = nz;
      } else if (walkable(h, nx, p.z)) p.x = nx;
      else if (walkable(h, p.x, nz)) p.z = nz;
      else if (p.z <= Z_MAX) p.z = Math.min(Z_MAX, Math.max(Z_MIN, nz));
      p.walking = true;
      p.running = !!input.run;
    }
    if (p.hidden < 0 && Math.abs(p.x - h.goalX) < 0.8 && p.z > 0.45 && p.z < WALL_Z) {
      h.done = true;
      emit('goal');
      return;
    }

    // 경비원
    g.moving = false;
    if (g.cool > 0) g.cool -= dt;
    const pd = Math.hypot(p.x - g.x, p.z - g.z);
    const calm = !hunting(g) && inCorridor(g);
    // 드르륵! 문 여는 소리가 들리면 그 문으로 살피러 와요
    const creak = h.events.find((e) => e.type === 'doorOpen' && e.by === 'player');
    if (creak && calm && Math.hypot(creak.x - g.x, 1.2 - g.z) < DOOR_NOISE && g.state !== 'goCheck' && g.state !== 'check') {
      setClue(h, creak.x, 1.2, 'door');
      g.state = 'listen';
      g.timer = 0.6;
      emit('heard', { door: true });
    }
    // 뛰는 발소리가 들리면 소리 난 곳으로 살피러 와요
    if (p.running && p.hidden < 0 && calm && pd < NOISE && g.state !== 'goCheck' && g.state !== 'check' && g.state !== 'listen') {
      const fresh = !g.clue || Math.abs(g.clue.x - p.x) > 2;
      setClue(h, p.x, p.z, 'noise');
      if (g.state !== 'investigate' || fresh) {
        g.state = 'listen';
        g.timer = 0.7;
        emit('heard');
      }
    }
    switch (g.state) {
      case 'walk': {
        if (roomAt(h, g.x, g.z) || g.z > 0.6) {
          g.state = 'return';
          break;
        }
        const prev = g.x;
        if (g.x < g.min - 0.05) g.face = 1;
        else if (g.x > g.max + 0.05) g.face = -1;
        g.x += g.face * g.speed * dt;
        g.z += (0 - g.z) * Math.min(1, dt * 4);
        g.moving = true;
        turnTo(g, g.face > 0 ? 0 : Math.PI, dt);
        const end = (g.face > 0 && prev < g.max && g.x >= g.max) || (g.face < 0 && prev > g.min && g.x <= g.min);
        const cross = (d) => (prev - d.x) * (g.x - d.x) <= 0;
        const door = g.cool <= 0 ? g.doors.find(cross) : undefined;
        const peek = g.cool <= 0 && !door ? g.peeks.find(cross) : undefined;
        if (door && h.rnd() < g.checkChance) {
          g.x = door.x;
          g.door = door;
          g.state = 'enter';
          g.timer = 0.5;
          emit('enterRoom', { cell: door.cell });
        } else if (peek && h.rnd() < (h.doorOpen[doorKey(peek.x)] === 'player' ? 0.85 : g.checkChance * 0.5)) {
          // 아이들이 열어 둔 문은 "문이 왜 열려 있지?" 하고 거의 꼭 들여다봐요
          const opened = h.doorOpen[doorKey(peek.x)] === 'player';
          g.x = peek.x;
          g.door = peek;
          g.state = 'peekRoom';
          g.timer = 2.6;
          g.phase = 0;
          emit('peekRoom', { cell: peek.cell, opened });
        } else if (end) {
          g.x = g.face > 0 ? g.max : g.min;
          g.state = 'pause';
          g.timer = 1 + h.rnd() * 1;
          g.flip = true;
        } else if (g.turn > 0 && h.rnd() < g.turn * dt) {
          // 갑자기 뒤돌아보기: 먼저 멈칫하고 서요 (그때 피하면 돼요)
          g.state = 'halt';
          g.timer = 0.75;
          emit('look');
        }
        break;
      }
      case 'halt':
        g.timer -= dt;
        if (g.timer <= 0) {
          g.state = 'pause';
          g.timer = 0.9 + h.rnd() * 0.7;
          g.flip = true;
          g.face = -g.face;
        }
        break;
      case 'pause':
        g.timer -= dt;
        turnTo(g, g.face > 0 ? 0 : Math.PI, dt, 6);
        if (g.timer <= 0) {
          // 끝에 닿았을 때는 돌아서 걷고, 갑자기 뒤돌아본 뒤에는 원래 방향으로 다시 걸어요
          if (g.flip) g.face = -g.face;
          g.flip = false;
          g.state = 'walk';
        }
        break;
      case 'listen': {
        g.timer -= dt;
        const c = g.clue;
        if (c) turnTo(g, Math.atan2(c.z - g.z, c.x - g.x), dt, 7);
        if (g.timer <= 0) g.state = c ? 'investigate' : 'walk';
        break;
      }
      case 'investigate': {
        const c = g.clue;
        if (!c) {
          g.state = 'return';
          break;
        }
        const tz = c.z < WALL_Z || !roomAt(h, c.x, c.z) ? Math.max(Z_MIN, Math.min(Z_MAX - 0.15, c.z)) : c.z;
        if (walkTo(h, g, c.x, tz, g.speed * 1.5, dt)) searchAt(h, emit);
        break;
      }
      case 'goCheck': {
        const sp = h.spots[g.target];
        const f = spotFront(sp);
        // 숨는 걸 봤으면 서둘러 와요 (그 사이에 나와서 도망칠 수 있어요)
        if (walkTo(h, g, f.x, f.z, g.saw === g.target ? g.chaseSpeed * 0.75 : g.speed * 1.6, dt)) {
          g.state = 'check';
          g.timer = 1.1;
          emit('check', { spot: g.target, kind: sp.kind });
        }
        break;
      }
      case 'check': {
        const sp = h.spots[g.target];
        turnTo(g, sp.z < 0 ? -Math.PI / 2 : Math.PI / 2, dt);
        g.timer -= dt;
        if (g.timer <= 0) {
          if (p.hidden === g.target) {
            emit('found', { spot: g.target });
            caught('found');
            return;
          }
          emit('empty', { spot: g.target });
          g.saw = -1;
          g.state = 'search';
          g.timer = 1.6;
          g.phase = g.ang;
        }
        break;
      }
      case 'goStairs': {
        const sp = h.spots[g.target];
        // 내려가는 계단 바로 위에 서서 아래를 비춰 봐요
        if (walkTo(h, g, sp.downX != null ? sp.downX : sp.x, 1.0, g.chaseSpeed * 0.8, dt)) {
          g.state = 'peekStairs';
          g.timer = 3.4;
          emit('stairsLook');
        }
        break;
      }
      case 'peekStairs':
        g.timer -= dt;
        turnTo(g, Math.PI / 2, dt, 6);
        if (g.timer <= 0) {
          g.saw = -1;
          g.state = 'search';
          g.timer = 1.4;
          g.phase = g.ang;
          g.cool = 4;
        }
        break;
      case 'search':
        g.timer -= dt;
        g.ang = wrap(g.phase + Math.sin((2.4 - g.timer) * 2.6) * 1.2);
        if (g.timer <= 0) g.state = 'return';
        break;
      case 'roomSearch': {
        // 문으로 들어가 교실 안을 이리저리 비춰 봐요
        const d = g.door;
        if (g.phase === 0) {
          if (walkTo(h, g, d.x, ROOM_Z0 + 0.5, g.speed * 1.5, dt)) g.phase = 1;
        } else {
          g.timer -= dt;
          g.ang = wrap(Math.PI / 2 + Math.sin((3.5 - g.timer) * 1.9) * 1.25);
          if (g.timer <= 0) {
            g.state = 'return';
            g.cool = 3;
          }
        }
        break;
      }
      case 'peekRoom': {
        // 순찰하다가 열린 교실 문 안을 비춰 봐요
        const d = g.door;
        if (g.phase === 0) {
          if (walkTo(h, g, d.x, WALL_Z + 0.1, g.speed, dt)) g.phase = 1;
        } else {
          g.timer -= dt;
          g.ang = wrap(Math.PI / 2 + Math.sin((2.6 - g.timer) * 2.4) * 0.8); // 문 옆 벽에 바짝 붙으면 안 보여요
          if (g.timer <= 0) {
            g.state = 'return';
            g.cool = 5;
          }
        }
        break;
      }
      case 'return': {
        // 순찰하던 길로 돌아가요
        const tx = Math.max(g.min, Math.min(g.max, g.x));
        if (walkTo(h, g, tx, 0, g.speed, dt)) {
          g.state = 'walk';
          g.face = g.x >= g.max - 0.05 ? -1 : g.x <= g.min + 0.05 ? 1 : g.face;
        }
        break;
      }
      case 'enter':
        g.timer -= dt;
        g.z += (1.6 - g.z) * Math.min(1, dt * 6);
        turnTo(g, Math.PI / 2, dt);
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
        turnTo(g, Math.atan2(p.z - g.z, p.x - g.x), dt);
        if (g.timer <= 0) {
          g.state = 'chase';
          g.lostT = 0;
        }
        break;
      case 'chase': {
        if (p.hidden >= 0) {
          // 숨는 걸 봤으면 그 자리로, 못 봤으면 마지막으로 본 곳을 살펴요
          if (g.saw === p.hidden) {
            g.target = g.saw;
            g.state = h.spots[g.saw].kind === 'stairs' ? 'goStairs' : 'goCheck';
          } else {
            setClue(h, g.lastSeen.x, g.lastSeen.z, 'lost', true);
            g.state = 'investigate';
          }
          emit('lost', { saw: g.saw >= 0 });
          break;
        }
        if (!g.lastSeen) g.lastSeen = { x: p.x, z: p.z };
        const s = sight(h);
        if (s > 0 || (pd < 2 && regionOf(h, p.x, p.z) === regionOf(h, g.x, g.z))) {
          g.lastSeen = { x: p.x, z: p.z };
          g.lostT = 0;
          walkTo(h, g, p.x, p.z, g.chaseSpeed, dt);
        } else {
          g.lostT += dt;
          walkTo(h, g, g.lastSeen.x, g.lastSeen.z, g.chaseSpeed, dt);
          if (g.lostT > 1.2) {
            setClue(h, g.lastSeen.x, g.lastSeen.z, 'lost', true);
            g.state = 'investigate';
            emit('lost', { saw: false });
          }
        }
        break;
      }
      default:
        break;
    }

    // 불빛에 비치면 의심이 쌓여요: 가까우면 금방, 멀면 천천히
    if (!hunting(g) && inCorridor(g)) {
      const s = sight(h);
      if (s > 0) {
        const wary = g.state !== 'walk' && g.state !== 'pause' && g.state !== 'halt';
        const T = (0.25 + 0.9 * (1 - s)) * (wary ? 0.6 : 1);
        if (g.sus < 0.3 && g.sus + dt / T >= 0.3) emit('suspect');
        g.sus = Math.min(1, g.sus + dt / T);
        g.glimpse = { x: p.x, z: p.z };
        if (g.sus >= 1) {
          g.state = 'alert';
          g.timer = 0.5;
          g.sus = 0;
          g.lastSeen = { x: p.x, z: p.z };
          g.clue = null;
          emit('spotted');
        }
      } else if (g.sus > 0) {
        // 잠깐 봤다가 놓치면 그 자리를 살피러 와요
        if (g.sus >= 0.3 && g.glimpse && g.state !== 'goCheck' && g.state !== 'check') {
          setClue(h, g.glimpse.x, g.glimpse.z, 'glimpse');
          if (g.state !== 'investigate') {
            g.state = 'listen';
            g.timer = 0.35;
          }
          g.glimpse = null;
        }
        g.sus = Math.max(0, g.sus - dt * 0.5);
      }
    }
    // 닿으면 잡혀요 (벽 너머는 안 돼요)
    if (p.hidden < 0 && inCorridor(g) && pd < CATCH) {
      const same = regionOf(h, p.x, p.z) === regionOf(h, g.x, g.z);
      const door = doorNear(h, p.x, 0.9) != null && Math.abs(p.z - WALL_Z) < 0.6 && Math.abs(g.z - WALL_Z) < 0.6;
      if (same || door) caught('touch');
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
  /** 반 전체 명예의 전당: 구글 Apps Script 웹 앱 주소만 받아요 (…/exec) */
  function sheetUrl(v) {
    const m = /^https:\/\/script\.google\.com\/(?:a\/macros\/[\w.-]+|macros)\/s\/[\w-]+\/exec/.exec(typeof v === 'string' ? v.trim() : '');
    return m ? m[0] : '';
  }

  function normalizeSettings(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const school = typeof r.school === 'string' && r.school.trim() ? r.school.trim().slice(0, 20) : DEFAULT_SCHOOL;
    const myClass = CLASSES.indexOf(r.myClass) >= 0 ? r.myClass : DEFAULT_CLASS;
    const quiz = (Array.isArray(r.quiz) ? r.quiz : [])
      .filter((q) => q && typeof q.q === 'string' && typeof q.a === 'string' && q.q.trim() && q.a.trim())
      .slice(0, 3)
      .map((q) => ({ q: q.q.trim().slice(0, 80), a: q.a.trim().slice(0, 40) }));
    const text = (v, n) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, n) : '');
    // 이름 목록: 쉼표·띄어쓰기로 나눠 적어도 돼요
    const names = (v, max) =>
      (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，、\s]+/) : [])
        .filter((x) => typeof x === 'string')
        .map((x) => x.trim().slice(0, 8))
        .filter(Boolean)
        .slice(0, max);
    return {
      school,
      myClass,
      quiz,
      teacher: text(r.teacher, 10),
      motto: text(r.motto, 24),
      duty: names(r.duty, 4),
      noisy: names(r.noisy, 6),
      friends: names(r.friends, 30),
      // 문제 고정: 숫자를 정해 두면 판마다 같은 문제가 나와요 (선생님이 정답을 미리 알 수 있게)
      // 따로 정하지 않으면 늘 같은 문제(정답지와 같은 판)가 나와요
      seed: Number.isInteger(r.seed) && r.seed > 0 && r.seed < 1e9 ? r.seed : DEFAULT_SEED,
      sheet: sheetUrl(r.sheet),
    };
  }

  function toBase64(bytes) {
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function encodeSettings(settings) {
    const s = normalizeSettings(settings);
    const out = { v: 1, school: s.school, myClass: s.myClass, quiz: s.quiz };
    ['teacher', 'motto', 'duty', 'noisy', 'friends', 'seed', 'sheet'].forEach((k) => {
      if (k === 'seed' ? s.seed : s[k] && s[k].length) out[k] = s[k];
    });
    return toBase64(new TextEncoder().encode(JSON.stringify(out)));
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
    WALL_Z,
    Z_MIN,
    Z_MAX,
    ROOM_DEPTH,
    ROOM_Z0,
    ROOM_Z1,
    DOOR_HALF,
    WALK,
    RUN,
    CATCH,
    HIDE_REACH,
    STAIRS_REACH,
    NOISE,
    SEE_HALF,
    HALLS,
    cellKind,
    cellWidth,
    doorX,
    doorsOf,
    roomType,
    FIRST_HALL,
    createHall,
    resetHall,
    stepHall,
    sight,
    inLight,
    inCorridor,
    hunting,
    roomAt,
    walkable,
    isDoorOpen,
    openDoor,
    doorNear,
    spotNear,
    route,
    // 확인
    checkAnswer,
    checkLock,
    formatTime,
    sheetUrl,
    normalizeSettings,
    encodeSettings,
    decodeSettings,
  };
})(typeof module === 'object' && module.exports ? module.exports : window);
