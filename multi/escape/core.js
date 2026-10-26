/* 동암초 탈출 — 학교 지도, 탈출 경로, 수수께끼 만들기
   화면과 떨어져 있어서 Node에서도 돌아갑니다 (tests/escape.test.js 가 이 파일을 씁니다).
   학교 지도는 선생님이 주신 신관·본관 대피 안내도를 옮긴 것입니다. */
(function (root) {
  'use strict';

  const DEFAULT_SCHOOL = '동암초등학교';
  const DEFAULT_CLASS = '6-3'; // 우리 반 (신관 2층)
  const HINT_PENALTY = 30; // 힌트 한 번에 +30초

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
     수수께끼는 6학년에 맞췄어요. */
  const STEPS = [
    { id: 'classroom', place: null, icon: '🎃', title: '숨은 호박을 찾아라', goal: '교실 곳곳에 숨은 호박 5개를 모두 찾아 눌러요.' },
    { id: 'science', place: '과학실', icon: '🧪', title: '마녀의 물약', goal: '물약 병을 골라(두 병이나 세 병) 솥에 부어서, 칠판에 적힌 색 물약을 만들어요.' },
    { id: 'library', place: '도서관', icon: '📚', title: '초성 책장', goal: '초성을 보고 글자 카드를 차례로 눌러 낱말을 완성해요.' },
    { id: 'broadcast', place: '방송실', icon: '📢', title: '유령 방송', goal: '유령이 누른 방송 버튼을 잘 보고 들은 다음, 똑같은 차례로 눌러요.' },
    { id: 'office', place: '교무실', icon: '📝', title: '우리 학교 퀴즈', goal: '선생님들이 남긴 우리 학교 문제를 맞혀요.' },
    { id: 'nurse', place: '보건실', icon: '🩹', title: '보건실 약상자', goal: '그림 식을 풀어 물음표에 들어갈 숫자를 찾아요. 곱셈이 섞여 있어요!' },
  ];
  const EXIT = { id: 'exit', place: '중앙 현관', icon: '🚪', title: '현관 자물쇠' };

  /* 교실 숨은 호박 자리 (그림 좌표 960×540). area 는 힌트에 쓰는 이름 */
  const SPOTS = [
    { x: 186, y: 240, area: '창틀' },
    { x: 64, y: 404, area: '휴지통' },
    { x: 262, y: 238, area: '책꽂이 위' },
    { x: 668, y: 222, area: '칠판 분필 받침' },
    { x: 820, y: 116, area: '시계 뒤' },
    { x: 866, y: 334, area: '사물함 안' },
    { x: 360, y: 380, area: '선생님 책상 밑' },
    { x: 604, y: 492, area: '책상 밑' },
    { x: 468, y: 34, area: '천장 장식' },
  ];
  const PUMPKINS = 5;

  /* 과학실 물약 */
  const POTIONS = ['빨강', '파랑', '노랑'];
  const MIXES = { '빨강+파랑': '보라', '노랑+파랑': '초록', '노랑+빨강': '주황', '노랑+빨강+파랑': '갈색' };
  const COLORS = {
    빨강: '#e8443a',
    파랑: '#2f6bff',
    노랑: '#ffd23f',
    보라: '#9b4dd8',
    초록: '#2fbf71',
    주황: '#ff8a1f',
    갈색: '#7a4a2a',
  };
  /** 고른 물약 병들(2~3개)을 섞은 색. 같은 색만 골랐으면 그 색 그대로 */
  function mix(list) {
    const uniq = Array.from(new Set(list)).sort();
    if (uniq.length === 1) return uniq[0];
    return MIXES[uniq.join('+')] || null;
  }

  /* 방송실 버튼: 미 솔 라 도 (5음계라 아무렇게 이어도 듣기 좋아요) */
  const PADS = [
    { icon: '🎃', name: '호박', midi: 64, color: '#ff8a1f' },
    { icon: '👻', name: '유령', midi: 67, color: '#e9e4ff' },
    { icon: '🦇', name: '박쥐', midi: 69, color: '#9b5de5' },
    { icon: '🕷️', name: '거미', midi: 72, color: '#2fbf71' },
  ];
  const ROUNDS = [4, 5, 6, 7];

  /* 도서관 초성 낱말: 할로윈·학교·안전 (3글자 둘 + 4글자 하나) */
  const WORDS = [
    ['보름달', '🌕'],
    ['빗자루', '🧹'],
    ['고양이', '🐈‍⬛'],
    ['운동장', '⚽'],
    ['선생님', '🧑‍🏫'],
    ['초콜릿', '🍫'],
    ['할로윈', '🎃'],
    ['비상구', '🚪'],
    ['소화기', '🧯'],
    ['대피로', '🗺️'],
    ['과학실', '🔬'],
    ['방송실', '📢'],
    ['동암초', '🏫'],
    ['잭오랜턴', '🎃'],
    ['연결통로', '🌉'],
    ['졸업앨범', '📸'],
    ['수학여행', '🚌'],
    ['체육대회', '🏃'],
  ];
  const TILES = 8;
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const HANGUL = 0xac00;
  const choIndex = (ch) => Math.floor((ch.charCodeAt(0) - HANGUL) / 588);
  const initials = (word) => Array.from(word).map((ch) => CHO[choIndex(ch)]).join('');
  const syllable = (cho, jung, jong) => String.fromCharCode(HANGUL + (cho * 21 + jung) * 28 + (jong || 0));
  const PLAIN_VOWELS = [0, 1, 4, 5, 8, 13, 18, 20]; // ㅏ ㅐ ㅓ ㅔ ㅗ ㅜ ㅡ ㅣ: 헷갈리는 카드도 흔한 글자로

  /* 교무실 기본 퀴즈: 대피 안내도에 나온 우리 학교 이야기 + 대피 안전 */
  const MAP_QUIZ = [
    { q: '보건실은 본관 몇 층에 있을까요?', options: ['1층', '2층', '3층'], a: 0 },
    { q: '도서관은 어느 건물에 있을까요?', options: ['본관', '신관'], a: 0 },
    { q: '과학실은 어디에 있을까요?', options: ['신관 3층', '본관 2층', '신관 1층'], a: 0 },
    { q: '6학년 교실이 있는 건물은 어디일까요?', options: ['본관', '신관'], a: 1 },
    { q: '교장실은 본관 몇 층에 있을까요?', options: ['1층', '2층', '3층'], a: 1 },
    { q: '1학년 교실은 본관 몇 층에 있을까요?', options: ['1층', '2층', '3층'], a: 0 },
    { q: '유치원은 어느 건물에 있을까요?', options: ['본관', '신관'], a: 1 },
    { q: '본관 1층에는 현관이 몇 개 있을까요?', options: ['1개', '2개', '3개'], a: 2 },
    { q: '방송실은 본관 몇 층에 있을까요?', options: ['1층', '2층', '3층'], a: 1 },
  ];
  const SAFETY_QUIZ = [
    { q: '불이 나서 대피할 때 타면 안 되는 것은?', options: ['계단', '엘리베이터'], a: 1 },
    { q: '연기가 나면 어떻게 대피할까요?', options: ['몸을 낮추고 코와 입을 막고 걸어요', '서서 큰 소리로 뛰어가요'], a: 0 },
    { q: '대피할 때 지켜야 할 약속은?', options: ['밀지 않고 차례로 걸어요', '친구를 앞질러 뛰어요'], a: 0 },
  ];

  /* ---------------- 복도: 경비원을 피해 몰래 지나가기 ----------------
     복도는 옆에서 본 한 줄 길이에요. 경비원 손전등 불빛 안에 들어가면 들켜서 쫓아와요.
     숨을 곳(화장실·열린 교실 문·사물함)에 숨으면 안전해요. 잡히면 복도 처음부터 다시. */
  const CELL = 300; // 복도에서 방 한 칸 너비 (px)
  const MARGIN = 120;
  const PLAYER_SPEED = 190;
  const CATCH = 30; // 이만큼 가까우면 잡혀요
  const HIDE_REACH = 46; // 숨을 곳에서 이만큼 안이면 숨을 수 있어요
  const CAUGHT_PENALTY = 30;

  /* fromIndex/toIndex 는 대피 안내도 복도 줄의 칸 번호 */
  const HALLS = [
    {
      id: 'h1',
      building: 'sin',
      floor: 3,
      fromIndex: 7,
      toIndex: 2,
      guard: { speed: 70, turn: 0, cone: 230 },
      intro: '가운데 계단으로 신관 3층에 올라왔어요. 경비 아저씨가 순찰 중이에요! 손전등 불빛에 들키지 말고 과학실까지 가요.',
    },
    {
      id: 'h2',
      building: 'bon',
      floor: 3,
      fromIndex: 4,
      toIndex: 1,
      guard: { speed: 80, turn: 0.1, cone: 240 },
      intro: '연결통로를 건너 본관 3층에 왔어요. 도서관은 복도 끝 왼쪽이에요.',
    },
    {
      id: 'h3',
      building: 'bon',
      floor: 2,
      fromIndex: 0,
      toIndex: 5,
      guard: { speed: 90, turn: 0.15, cone: 250 },
      intro: '왼쪽 계단으로 본관 2층에 내려왔어요. 방송실까지 몰래 가요. 경비 아저씨가 가끔 뒤를 돌아봐요!',
    },
    {
      id: 'h4',
      building: 'bon',
      floor: 2,
      fromIndex: 5,
      toIndex: 8,
      guard: { speed: 95, turn: 0.2, cone: 250 },
      intro: '회의실과 교장실 앞을 지나 교무실로 가요. 경비 아저씨가 점점 예민해져요.',
    },
    {
      id: 'h5',
      building: 'bon',
      floor: 1,
      fromIndex: 11,
      toIndex: 7,
      guard: { speed: 105, turn: 0.22, cone: 260 },
      intro: '동쪽 계단으로 1층에 내려왔어요. 동쪽 현관은 잠겨 있어요! 1학년 교실 앞을 지나 보건실로 가요.',
    },
  ];

  const isRoomCell = (name) => /^\d-\d$/.test(name) || /실$|관$/.test(name);

  /** 복도 하나를 만듭니다. 칸은 지도 순서(왼쪽→오른쪽) 그대로 놓고, 가는 방향(dir)만 바뀌어요. */
  function createHall(def, seed) {
    const row = BUILDINGS[def.building].floors[def.floor];
    const dir = def.toIndex > def.fromIndex ? 1 : -1;
    const lo = Math.min(def.fromIndex, def.toIndex);
    const hi = Math.max(def.fromIndex, def.toIndex);
    const center = (i) => MARGIN + (i - lo) * CELL + CELL / 2;
    const cells = [];
    for (let i = lo; i <= hi; i++) cells.push({ name: row[i], index: i, x0: MARGIN + (i - lo) * CELL, x1: MARGIN + (i - lo + 1) * CELL });
    const startX = center(def.fromIndex);
    const goalX = center(def.toIndex);

    // 숨을 곳: 화장실, 하나 건너 하나씩 열린 교실 문, 그리고 빈 곳을 사물함으로 메워요
    const spots = [];
    cells.forEach((c, k) => {
      if (c.index === def.fromIndex || c.index === def.toIndex) return;
      const mid = (c.x0 + c.x1) / 2;
      if (c.name === '화장실') spots.push({ x: mid, kind: 'toilet', label: '화장실' });
      else if (isRoomCell(c.name) && k % 2 === 0) spots.push({ x: mid - 60, kind: 'door', label: c.name + ' 문' });
    });
    const sorted = () => spots.sort((a, b) => a.x - b.x);
    sorted();
    // 출발 바로 앞과 도착 바로 앞에는 꼭 숨을 곳이 있게
    const near = (x) => spots.some((sp) => Math.abs(sp.x - x) < 90);
    const firstSafe = startX + dir * 230;
    const lastSafe = goalX - dir * 190;
    if (!near(firstSafe)) spots.push({ x: firstSafe, kind: 'locker', label: '사물함' });
    if (!near(lastSafe)) spots.push({ x: lastSafe, kind: 'locker', label: '사물함' });
    sorted();
    for (let i = 0; i + 1 < spots.length; i++) {
      if (spots[i + 1].x - spots[i].x > 1.35 * CELL) {
        spots.splice(i + 1, 0, { x: (spots[i].x + spots[i + 1].x) / 2, kind: 'locker', label: '사물함' });
      }
    }

    // 경비원은 출발 쪽 320px 밖에서부터 도착 문 140px 앞까지 순찰해요
    const a = startX + dir * 320;
    const b = goalX - dir * 140;
    const g = def.guard;
    const guard = {
      min: Math.min(a, b),
      max: Math.max(a, b),
      speed: g.speed,
      chaseSpeed: g.speed * 1.6 + 40,
      cone: g.cone,
      turn: g.turn,
      // 순찰하다가 교실 문을 열고 들어가 살펴봐요: 그때가 지나갈 기회!
      doors: cells
        .filter((c) => isRoomCell(c.name) && c.index !== def.fromIndex && c.index !== def.toIndex)
        .map((c) => c.x1 - 70)
        .filter((x) => x >= Math.min(a, b) + 40 && x <= Math.max(a, b) - 40),
      checkChance: 0.7,
    };
    const hall = {
      def,
      dir,
      length: MARGIN * 2 + (hi - lo + 1) * CELL,
      cells,
      startX,
      goalX,
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
    h.player = { x: h.startX, face: h.dir, hidden: -1, walking: false };
    const g = h.guard;
    g.x = (g.min + g.max) / 2;
    g.face = h.dir; // 처음엔 등을 보이며 도착 쪽으로 걸어가요
    g.state = 'walk';
    g.timer = 0;
    g.turnAfter = false;
    g.cool = 0;
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
    return d >= -8 && d <= g.cone;
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

  /** input: { move: -1|0|1, hide: true(누른 순간) } */
  function stepHall(h, input, dt) {
    if (h.done) return;
    h.t += dt;
    const p = h.player;
    const g = h.guard;
    const emit = (type, data) => h.events.push(Object.assign({ type }, data));

    // 아이 움직이기 / 숨기
    if (input.hide) {
      if (p.hidden >= 0) {
        p.hidden = -1;
        emit('unhide');
      } else {
        const i = spotNear(h, p.x);
        if (i >= 0) {
          p.hidden = i;
          p.x = h.spots[i].x;
          emit('hide');
        }
      }
    } else if (input.move && p.hidden >= 0) {
      p.hidden = -1;
      emit('unhide');
    }
    p.walking = false;
    if (input.move && p.hidden < 0) {
      p.x = Math.min(h.length - 40, Math.max(40, p.x + input.move * PLAYER_SPEED * dt));
      p.face = input.move;
      p.walking = true;
    }
    if (p.hidden < 0 && Math.abs(p.x - h.goalX) < 34) {
      h.done = true;
      emit('goal');
      return;
    }

    // 경비원
    const prev = g.x;
    if (g.cool > 0) g.cool -= dt;
    switch (g.state) {
      case 'walk': {
        if (g.x < g.min - 1) g.face = 1;
        else if (g.x > g.max + 1) g.face = -1;
        g.x += g.face * g.speed * dt;
        const end = (g.face > 0 && prev < g.max && g.x >= g.max) || (g.face < 0 && prev > g.min && g.x <= g.min);
        const door = g.cool <= 0 ? g.doors.find((d) => (prev - d) * (g.x - d) <= 0) : undefined;
        if (door !== undefined && h.rnd() < g.checkChance) {
          g.x = door;
          g.state = 'enter';
          g.timer = 0.35;
          emit('enterRoom');
        } else if (end) {
          g.x = g.face > 0 ? g.max : g.min;
          g.state = 'pause';
          g.timer = 0.8 + h.rnd() * 0.8;
          g.turnAfter = true;
        } else if (g.turn > 0 && h.rnd() < g.turn * dt) {
          g.state = 'pause'; // 갑자기 뒤돌아보기
          g.timer = 0.6 + h.rnd() * 0.6;
          g.turnAfter = true;
          g.face = -g.face;
          emit('look');
        }
        break;
      }
      case 'pause':
        g.timer -= dt;
        if (g.timer <= 0) {
          // 끝에 닿았을 때만 돌아서 걸어요 (갑자기 뒤돌아본 뒤에는 다시 원래 방향으로)
          g.face = -g.face;
          g.state = 'walk';
        }
        break;
      case 'enter':
        g.timer -= dt;
        if (g.timer <= 0) {
          g.state = 'inRoom';
          g.timer = 2.6 + h.rnd() * 1.6;
        }
        break;
      case 'inRoom':
        g.timer -= dt;
        if (g.timer <= 0) {
          g.state = 'exit';
          g.timer = 0.35;
          g.cool = 4;
          emit('exitRoom');
        }
        break;
      case 'exit':
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'walk';
        break;
      case 'alert':
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'chase';
        break;
      case 'chase':
        if (p.hidden >= 0) {
          g.state = 'search';
          g.timer = 1.6;
          emit('lost');
          break;
        }
        g.face = sign(p.x - g.x) || g.face;
        g.x += g.face * g.chaseSpeed * dt;
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
      g.timer = 0.45;
      g.face = sign(p.x - g.x) || g.face;
      emit('spotted');
    }
    if (p.hidden < 0 && inCorridor(g) && Math.abs(p.x - g.x) < CATCH) {
      h.caught++;
      emit('caught');
      resetHall(h);
    }
  }

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

  /** 초성 문제 하나: 정답 글자 + 같은 초성의 헷갈리는 글자 + 다른 글자로 카드 8장 */
  function makeWord(entry, rnd) {
    const word = entry[0];
    const chars = Array.from(word);
    const tiles = chars.slice();
    for (const ch of chars) {
      if (tiles.length >= TILES) break;
      const c = choIndex(ch);
      let fake = ch;
      for (let k = 0; k < 20 && (fake === ch || tiles.indexOf(fake) >= 0); k++) {
        fake = syllable(c, PLAIN_VOWELS[Math.floor(rnd() * PLAIN_VOWELS.length)], rnd() < 0.3 ? 4 : 0);
      }
      if (tiles.indexOf(fake) < 0) tiles.push(fake);
    }
    const pool = shuffle(WORDS.map((w) => w[0]).join('').split(''), rnd);
    for (const ch of pool) {
      if (tiles.length >= TILES) break;
      if (tiles.indexOf(ch) < 0) tiles.push(ch);
    }
    return { word, emoji: entry[1], cho: initials(word), tiles: shuffle(tiles, rnd) };
  }

  /** 한 판의 모든 수수께끼를 씨앗(seed)으로 정합니다. 같은 씨앗이면 새로고침해도 똑같아요. */
  function createRun(seed, settings) {
    const s = normalizeSettings(settings);
    const rnd = rng(seed);
    const steps = STEPS.map((st) => Object.assign({}, st, { place: st.place || s.myClass }));

    const spots = shuffle(SPOTS.map((_, i) => i), rnd).slice(0, PUMPKINS).sort((a, b) => a - b);
    const targets = shuffle(['보라', '초록', '주황'], rnd).concat(['갈색']);
    const seq = [];
    while (seq.length < ROUNDS[ROUNDS.length - 1]) {
      const p = Math.floor(rnd() * PADS.length);
      if (seq.length >= 2 && seq[seq.length - 1] === p && seq[seq.length - 2] === p) continue;
      seq.push(p);
    }
    const three = shuffle(WORDS.filter((w) => w[0].length === 3), rnd);
    const four = shuffle(WORDS.filter((w) => w[0].length === 4), rnd);
    const words = [three[0], three[1], four[0]].map((w) => makeWord(w, rnd));

    let quiz;
    if (s.quiz.length) {
      quiz = { custom: true, questions: s.quiz.map((q) => ({ q: q.q, a: q.a })) };
    } else {
      const picks = shuffle(MAP_QUIZ, rnd).slice(0, 3).concat(shuffle(SAFETY_QUIZ, rnd).slice(0, 1));
      quiz = {
        custom: false,
        questions: picks.map((p) => {
          const order = shuffle(p.options.map((_, i) => i), rnd);
          return { q: p.q, options: order.map((i) => p.options[i]), a: order.indexOf(p.a) };
        }),
      };
    }

    // 🩹+🩹+🩹 = 3a, 🩹×💊 = ab, 💊+🌡️×2 = b+2c → 🌡️ = c (곱셈을 먼저!)
    const a = 2 + Math.floor(rnd() * 8);
    let b = 2 + Math.floor(rnd() * 8);
    while (b === a) b = 2 + Math.floor(rnd() * 8);
    let c = 1 + Math.floor(rnd() * 9);
    while (c === a || c === b) c = 1 + Math.floor(rnd() * 9);

    const digits = {};
    steps.forEach((st) => (digits[st.id] = st.id === 'nurse' ? c : 1 + Math.floor(rnd() * 9)));

    return {
      seed,
      school: s.school,
      myClass: s.myClass,
      steps,
      exit: EXIT,
      digits,
      lock: shuffle(steps.map((st) => st.id), rnd),
      puzzles: {
        classroom: { spots },
        science: { targets },
        broadcast: { seq, rounds: ROUNDS.slice() },
        library: { words },
        office: quiz,
        nurse: { a, b, c },
      },
    };
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
    BUILDINGS,
    CLASSES,
    STEPS,
    EXIT,
    SPOTS,
    PUMPKINS,
    POTIONS,
    COLORS,
    PADS,
    WORDS,
    MAP_QUIZ,
    SAFETY_QUIZ,
    locate,
    HALLS,
    CELL,
    PLAYER_SPEED,
    CATCH,
    HIDE_REACH,
    CAUGHT_PENALTY,
    createHall,
    stepHall,
    inLight,
    inCorridor,
    spotNear,
    route,
    mix,
    initials,
    createRun,
    checkAnswer,
    checkLock,
    formatTime,
    normalizeSettings,
    encodeSettings,
    decodeSettings,
  };
})(typeof module === 'object' && module.exports ? module.exports : window);
