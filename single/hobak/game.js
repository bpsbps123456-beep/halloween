/* 호박분투 — 화면 그리기, 조작, 단계 진행 */
(function () {
  'use strict';

  const C = window.HobakCore;
  const art = HG.art;
  const W = C.W;
  const H = C.H;
  const TAU = Math.PI * 2;
  const GAME = 'hobak';
  const LIVES = 3;
  const DOOR = 70; // 결승선에서 파티장 문까지

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const view = HG.fitStage($('stageArea'), $('stage'), canvas, W, H);
  const ctx = view.ctx;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* 단계마다 하늘과 건물 색이 바뀝니다 */
  const THEMES = [
    { skyTop: '#2a1650', skyBottom: '#b0506a', far: '#4a2557', mid: '#331a40', walls: ['#3e2445', '#4a2b4f', '#382040'], roof: '#26142c', edge: '#140a18', lit: '#ffc65c', dark: '#22122a', moon: [770, 150, 44], mark: 'patch' },
    { skyTop: '#160d2e', skyBottom: '#5a2d73', far: '#2c1a45', mid: '#22143a', walls: ['#2e2148', '#372856', '#291d40'], roof: '#1a1030', edge: '#0d0818', lit: '#ffd27a', dark: '#1a1230', moon: [700, 110, 40], mark: 'church' },
    { skyTop: '#0c1a26', skyBottom: '#2f6a63', far: '#163a3c', mid: '#10292d', walls: ['#1d3a3d', '#24484a', '#183133'], roof: '#0f2224', edge: '#071314', lit: '#c8ff8a', dark: '#102326', moon: [800, 120, 38], mark: 'witch' },
    { skyTop: '#0b1030', skyBottom: '#30488a', far: '#1a2652', mid: '#141d42', walls: ['#222b55', '#2a3463', '#1d244a'], roof: '#141a38', edge: '#0a0d1f', lit: '#ffe08a', dark: '#151b3a', moon: [660, 100, 42], mark: 'clock' },
    { skyTop: '#1b0a14', skyBottom: '#6a2333', far: '#3a1520', mid: '#2a0f18', walls: ['#3a1b24', '#46222c', '#33161f'], roof: '#22101a', edge: '#12070c', lit: '#ff9f5a', dark: '#2a121a', moon: [780, 130, 46], mark: 'castle' },
    { skyTop: '#060812', skyBottom: '#2a3366', far: '#1a2048', mid: '#12163a', walls: ['#1f2348', '#272c57', '#1a1e40'], roof: '#11142e', edge: '#080a18', lit: '#fff1a8', dark: '#14183a', moon: [720, 120, 58], mark: 'castle' },
  ];

  function seeded(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 배경 만들기 (단계마다 한 번) ---------------- */
  function makeScene(si, level) {
    const r = seeded(900 + si * 31);
    const stars = [];
    for (let i = 0; i < 70; i++) stars.push({ x: r() * W, y: r() * H * 0.62, s: 0.8 + r() * 1.6, p: r() * TAU });
    const hills = [];
    for (let x = 0; x <= 2400; x += 80) hills.push(H - 170 - 38 * Math.sin((x / 2400) * TAU * 2 + si) - r() * 26);
    hills[hills.length - 1] = hills[0];
    const trees = [];
    for (let i = 0; i < 8; i++) trees.push({ x: r() * 2300 + 50, h: 36 + r() * 46, lean: (r() - 0.5) * 0.35 });
    const houses = [];
    for (let x = 0; x < 1800; ) {
      const w = 70 + r() * 90;
      houses.push({ x, w, h: 90 + r() * 110, peak: r() < 0.65, win: [r() < 0.4, r() < 0.4, r() < 0.4] });
      x += w + 12 + r() * 40;
    }
    const bats = [];
    for (let i = 0; i < 5; i++) bats.push({ x: r() * W, y: 60 + r() * 170, v: 25 + r() * 35, s: 0.6 + r() * 0.5, p: r() * TAU });
    const buildings = level.roofs.map((roof, i) => {
      const w = roof.x1 - roof.x0;
      const cols = Math.max(1, Math.floor((w - 30) / 48));
      const rows = Math.max(1, Math.floor((H - roof.top - 30) / 56));
      const left = roof.x0 + (w - (cols * 48 - 26)) / 2;
      const windows = [];
      for (let c = 0; c < cols; c++) {
        for (let k = 0; k < rows; k++) {
          windows.push({ x: left + c * 48, y: roof.top + 34 + k * 56, lit: r() < 0.32, face: r() < 0.07 });
        }
      }
      return {
        wall: i % 3,
        windows,
        chimney: w > 200 && r() < 0.5 ? { x: roof.x0 + w * (0.15 + r() * 0.65), h: 16 + r() * 12 } : null,
        garland: w > 260 && r() < 0.45,
      };
    });
    return { stars, hills, trees, houses, bats, buildings };
  }

  /* ---------------- 상태 ---------------- */
  const game = {
    mode: 'title', // title | board | intro | play | dead | ready | goal | clear | over | paused
    stage: 0,
    level: null,
    world: null,
    scene: null,
    lives: LIVES,
    total: 0,
    candies: 0,
    golds: 0,
    fast: false,
    t: 0,
    modeT: 0,
    goT: 9,
    camX: 0,
    shake: 0,
    paused: null,
    stats: null,
    from: 0,
    banked: false, // 이번 단계 점수를 총점에 이미 넣었는지
  };

  const particles = [];
  const texts = [];
  const confetti = [];
  const fx = { miss: null, hook: 0 };

  function setMode(m) {
    game.mode = m;
    game.modeT = 0;
    if (m === 'play') game.goT = 0;
  }

  function loadStage(si) {
    game.stage = si;
    game.level = C.buildLevel(si);
    game.world = C.createWorld(game.level);
    game.scene = makeScene(si, game.level);
    game.lives = LIVES;
    game.banked = false;
    game.camX = -60;
    particles.length = 0;
    texts.length = 0;
    confetti.length = 0;
    fx.miss = null;
  }

  /* ---------------- 화면 전환 ---------------- */
  const screens = {
    title: $('titleScreen'),
    board: $('boardScreen'),
    pause: $('pauseScreen'),
    clear: $('clearScreen'),
    result: $('resultScreen'),
  };
  function show(name) {
    Object.keys(screens).forEach((k) => (screens[k].hidden = k !== name));
  }
  function hideAll() {
    show(null);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  const unlocked = () => clamp(HG.store.get('hobak:unlocked', 0) | 0, 0, C.STAGES.length - 1);

  function paintStagePick() {
    const box = $('stagePick');
    box.querySelectorAll('button').forEach((b) => b.remove());
    const top = unlocked();
    C.STAGES.forEach((st, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(i + 1);
      b.disabled = i > top;
      b.title = i > top ? '앞 단계를 성공하면 열려요' : i + 1 + '단계 · ' + st.name;
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => startGame(i));
      box.appendChild(b);
    });
  }

  function goTitle() {
    HG.sound.stopMusic();
    loadStage(0);
    setMode('title');
    paintStagePick();
    $('fastBadge').hidden = !game.fast;
    show('title');
  }

  function startGame(si) {
    game.total = 0;
    game.candies = 0;
    game.golds = 0;
    game.from = si;
    loadStage(si);
    hideAll();
    setMode('intro');
    HG.sound.play('start');
    HG.sound.music(SONG);
  }

  function nextStage() {
    if (game.mode !== 'clear') return;
    loadStage(game.stage + 1);
    hideAll();
    setMode('intro');
    HG.sound.music(SONG);
  }

  const isPlaying = () => ['intro', 'play', 'dead', 'ready', 'goal'].indexOf(game.mode) >= 0;

  function pause() {
    if (!isPlaying()) return;
    game.paused = game.mode;
    game.mode = 'paused';
    HG.sound.pauseMusic();
    show('pause');
    $('resumeBtn').focus();
  }

  function resume() {
    if (game.mode !== 'paused') return;
    game.mode = game.paused;
    hideAll();
    clearInput();
    HG.sound.resumeMusic();
  }

  /* ---------------- 조작 ---------------- */
  const input = { keys: new Set(), pointers: new Set(), held: false, press: false, release: false };
  const ACTION = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyX']);

  function refresh() {
    const held = input.keys.size > 0 || input.pointers.size > 0;
    if (held && !input.held) input.press = true;
    if (!held && input.held) input.release = true;
    input.held = held;
  }
  function takeInput() {
    const r = { pressed: input.press, released: input.release, held: input.held || input.press };
    input.press = false;
    input.release = false;
    return r;
  }
  function eatInput() {
    input.press = false;
    input.release = false;
  }
  function clearInput() {
    input.keys.clear();
    input.pointers.clear();
    input.held = false;
    eatInput();
  }

  let egg = [];
  function eggKey(code) {
    egg.push(code);
    if (egg.length > 3) egg.shift();
    if (egg.join() === 'KeyB,KeyO,KeyO') {
      egg = [];
      game.fast = !game.fast;
      $('fastBadge').hidden = !game.fast;
      HG.sound.play('boo');
    }
  }

  function menuKey() {
    if (game.mode === 'title') {
      startGame(0);
      return true;
    }
    if (game.mode === 'clear' && game.modeT > 0.5) {
      nextStage();
      return true;
    }
    if (game.mode === 'over' && game.modeT > 0.8 && $('nameForm').hidden) {
      startGame(0);
      return true;
    }
    return game.mode !== 'play';
  }

  window.addEventListener('keydown', (e) => {
    if (HG.isTyping(e)) return;
    if (e.code === 'KeyM') {
      HG.sound.toggle();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (game.mode === 'paused') resume();
      else if (game.mode === 'board') goTitle();
      else pause();
      return;
    }
    if (game.mode === 'title') eggKey(e.code);
    if (!ACTION.has(e.code) && e.code !== 'Enter') return;
    const onButton = e.target && e.target.closest && e.target.closest('button, a');
    if (onButton && game.mode !== 'play') return; // 버튼 위에서는 버튼이 눌리게 둡니다
    e.preventDefault();
    if (e.repeat) return;
    if (game.mode !== 'play' && menuKey()) {
      if (ACTION.has(e.code)) input.keys.add(e.code);
      input.held = input.keys.size > 0 || input.pointers.size > 0;
      return;
    }
    if (ACTION.has(e.code)) {
      input.keys.add(e.code);
      refresh();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (input.keys.delete(e.code)) refresh();
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 일부 브라우저는 포인터 고정을 못 해요 */
      }
    }
    input.pointers.add(e.pointerId);
    refresh();
  });
  const pointerUp = (e) => {
    if (input.pointers.delete(e.pointerId)) refresh();
  };
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('lostpointercapture', pointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('blur', () => {
    clearInput();
    pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  /* ---------------- 진행 ---------------- */
  function update(dt) {
    game.t += dt;
    game.modeT += dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
    const w = game.world;
    const h = w.hero;
    const sdt = dt * (game.fast ? 1.5 : 1);

    switch (game.mode) {
      case 'intro':
        eatInput();
        if (game.modeT >= 0.9 && game.modeT - dt < 0.9) HG.sound.play('tick');
        if (game.modeT >= 1.45 && game.modeT - dt < 1.45) HG.sound.play('tick');
        if (game.modeT >= 2.0) {
          setMode('play');
          HG.sound.play('go');
        }
        break;
      case 'play':
        game.goT += dt;
        C.step(w, takeInput(), sdt);
        handleEvents();
        break;
      case 'dead':
        eatInput();
        if (game.modeT >= 1.3) {
          if (game.lives <= 0) {
            finish(false);
          } else {
            C.respawn(w);
            setMode('ready');
          }
        }
        break;
      case 'ready':
        eatInput();
        if (game.modeT >= 1.2) {
          h.state = 'run';
          setMode('play');
          HG.sound.play('go');
        }
        break;
      case 'goal':
        eatInput();
        if (h.x < game.level.goalX + DOOR) h.x = Math.min(game.level.goalX + DOOR, h.x + game.level.speed * 0.55 * dt);
        if (game.modeT >= 1.7) showClear();
        break;
      default:
        eatInput();
    }
    stepFx(dt);
  }

  function handleEvents() {
    const w = game.world;
    const h = w.hero;
    for (const e of w.events) {
      switch (e.type) {
        case 'jump':
          HG.sound.play('jump');
          break;
        case 'web':
          HG.sound.play('web');
          fx.hook = 0.3;
          break;
        case 'webMiss':
          HG.sound.play('miss');
          fx.miss = { t: 0, x: h.x, y: h.y };
          break;
        case 'flip':
          HG.sound.play('flip');
          floatText(h.x, h.y - 48, '공중제비!', '#9ff0d8', 20);
          break;
        case 'land':
          HG.sound.play('land');
          dust(h.x, h.y + C.HALF_H);
          break;
        case 'candy':
          onCandy(e);
          break;
        case 'bonk':
          HG.sound.play('bonk');
          game.shake = 0.25;
          burst(h.x, h.y - 26, 6, ['#ffd166', '#ffffff'], 120, 0.5, 3, 0);
          break;
        case 'fall':
          game.lives--;
          HG.sound.play('fall');
          setMode('dead');
          break;
        case 'goal':
          onGoal();
          break;
        default:
          break;
      }
    }
    w.events.length = 0;
  }

  function onCandy(e) {
    if (e.gold) {
      HG.sound.play('gold');
      burst(e.x, e.y, 16, ['#ffd166', '#fff3b0', '#ffffff'], 220, 0.8, 4, 200);
      floatText(e.x, e.y - 24, '+' + e.points + ' 황금!', '#ffd166', 22);
    } else {
      HG.sound.play('candy');
      burst(e.x, e.y, 6, ['#ff6fae', '#5fd9b6', '#b48cff', '#ffad42'], 120, 0.45, 3, 100);
      floatText(e.x, e.y - 18, '+' + e.points, '#ffe9f3', 16);
    }
  }

  function onGoal() {
    const w = game.world;
    const lv = game.level;
    const allGold = lv.goldTotal > 0 && w.golds >= lv.goldTotal;
    const bonus = C.CLEAR_BONUS + (allGold ? C.ALL_GOLD_BONUS : 0);
    game.stats = {
      candies: w.candies,
      golds: w.golds,
      goldTotal: lv.goldTotal,
      candyPoints: w.candies * C.CANDY_POINTS,
      goldPoints: w.golds * lv.goldPoints,
      allGold,
    };
    game.total += w.score + bonus;
    game.banked = true;
    game.candies += w.candies;
    game.golds += w.golds;
    if (game.stage + 1 < C.STAGES.length && game.stage + 1 > unlocked()) HG.store.set('hobak:unlocked', game.stage + 1);
    HG.sound.stopMusic();
    HG.sound.play('clear');
    setMode('goal');
    for (let i = 0; i < 90; i++) {
      confetti.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.6,
        vy: 90 + Math.random() * 120,
        vx: (Math.random() - 0.5) * 60,
        r: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 8,
        c: ['#ff8a1f', '#ffd166', '#b48cff', '#5fd9b6', '#ff6fae'][i % 5],
      });
    }
  }

  function showClear() {
    if (game.stage === C.STAGES.length - 1) {
      finish(true);
      return;
    }
    const s = game.stats;
    const st = C.STAGES[game.stage];
    $('clearStage').textContent = game.stage + 1 + '단계 · ' + st.name;
    const tally = $('clearTally');
    tally.textContent = '';
    const row = (label, value, cls) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      if (cls) {
        dt.className = cls;
        dd.className = cls;
      }
      tally.append(dt, dd);
    };
    row('사탕 ' + s.candies + '개', '+' + HG.formatNumber(s.candyPoints));
    row('황금 별사탕 ' + s.golds + ' / ' + s.goldTotal, '+' + HG.formatNumber(s.goldPoints));
    row('단계 성공', '+' + C.CLEAR_BONUS);
    if (s.allGold) row('황금 별사탕 모두 모음!', '+' + C.ALL_GOLD_BONUS, 'bonus');
    $('clearScore').textContent = '총 ' + HG.formatNumber(game.total) + '점';
    $('nextBtn').textContent = game.stage + 2 + '단계로 · ' + C.STAGES[game.stage + 1].name;
    setMode('clear');
    show('clear');
  }

  const boardFormat = (row) =>
    HG.formatNumber(row.score) + '점 · ' + (row.cleared ? '완주' : row.stage + '단계') + (row.fast ? ' 👻' : '');

  function finish(cleared) {
    const w = game.world;
    const score = cleared ? game.total : game.total + w.score;
    const candies = game.candies + (cleared ? 0 : w.candies);
    const golds = game.golds + (cleared ? 0 : w.golds);
    HG.sound.stopMusic();
    if (!cleared) HG.sound.play('gameover');
    setMode('over');
    $('resultTitle').textContent = cleared ? '할로윈 파티에 도착!' : '호박군이 지쳤어요';
    $('resultScore').textContent = HG.formatNumber(score) + '점';
    const stats = $('resultStats');
    stats.textContent = '';
    [
      ['도착', cleared ? (game.from === 0 ? '6단계 모두 성공' : game.from + 1 + '단계부터 끝까지 성공') : game.stage + 1 + '단계 · ' + game.level.name],
      ['사탕', candies + '개'],
      ['황금 별사탕', golds + '개'],
    ].forEach(([k, v]) => {
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = v;
      span.append(k + ' ', b);
      stats.appendChild(span);
    });
    HG.best.submit(GAME, score);
    HG.setupResultBoard({
      game: GAME,
      score,
      extra: { stage: game.stage + 1, cleared: cleared && game.from === 0, fast: game.fast },
      form: $('nameForm'),
      input: $('nameInput'),
      list: $('resultBoard'),
      format: boardFormat,
      onSaved: () => $('retryBtn').focus(),
    });
    show('result');
  }

  /* ---------------- 효과 ---------------- */
  function burst(x, y, n, colors, speed, life, size, gravity) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.4 + Math.random() * 0.6);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life, size, g: gravity, c: colors[i % colors.length] });
    }
  }
  function dust(x, y) {
    for (let i = 0; i < 5; i++) {
      particles.push({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 40, life: 0.35, max: 0.35, size: 4, g: 0, c: 'rgba(230, 220, 255, 0.6)' });
    }
  }
  function floatText(x, y, text, color, size) {
    texts.push({ x, y, text, color, size, life: 0.9 });
  }
  function stepFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].y -= 40 * dt;
      texts[i].life -= dt;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.y += c.vy * dt;
      c.x += c.vx * dt + Math.sin(game.t * 3 + i) * 0.4;
      c.r += c.vr * dt;
      if (c.y > H + 20) confetti.splice(i, 1);
    }
    if (fx.miss) {
      fx.miss.t += dt;
      if (fx.miss.t > 0.3) fx.miss = null;
    }
    if (fx.hook > 0) fx.hook = Math.max(0, fx.hook - dt);
  }

  /* ---------------- 그리기 ---------------- */
  function eachRepeat(offset, rep, fn) {
    let x = -(((offset % rep) + rep) % rep);
    for (; x < W; x += rep) fn(x);
  }

  function drawSky(th, sc) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff6dc';
    for (const s of sc.stars) {
      ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(game.t * 1.3 + s.p))) * (1 - s.y / (H * 0.75));
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    art.moon(ctx, th.moon[0] - game.camX * 0.02, th.moon[1], th.moon[2]);
  }

  function drawLandmark(mark, x, base, color, lit) {
    ctx.fillStyle = color;
    if (mark === 'patch') {
      // 커다란 호박 밭
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        art.pumpkin(ctx, x + i * 46, base - 12 - (i % 2) * 6, 20 - (i % 2) * 5, 15 - (i % 2) * 4, 'happy', false);
        ctx.restore();
      }
      return;
    }
    if (mark === 'church') {
      ctx.fillRect(x, base - 120, 70, 120);
      ctx.beginPath();
      ctx.moveTo(x - 6, base - 120);
      ctx.lineTo(x + 35, base - 200);
      ctx.lineTo(x + 76, base - 120);
      ctx.fill();
      ctx.fillRect(x + 32, base - 232, 6, 34);
      ctx.fillRect(x + 22, base - 222, 26, 6);
      ctx.fillStyle = lit;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x + 35, base - 85, 12, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (mark === 'witch') {
      ctx.fillRect(x, base - 140, 56, 140);
      ctx.beginPath();
      ctx.moveTo(x - 18, base - 140);
      ctx.quadraticCurveTo(x + 40, base - 170, x + 70, base - 245);
      ctx.quadraticCurveTo(x + 50, base - 165, x + 74, base - 140);
      ctx.fill();
      ctx.fillStyle = lit;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x + 20, base - 110, 14, 20);
      ctx.globalAlpha = 1;
      return;
    }
    if (mark === 'clock') {
      ctx.fillRect(x, base - 230, 64, 230);
      ctx.beginPath();
      ctx.moveTo(x - 8, base - 230);
      ctx.lineTo(x + 32, base - 300);
      ctx.lineTo(x + 72, base - 230);
      ctx.fill();
      ctx.fillStyle = lit;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(x + 32, base - 190, 20, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      const a = game.t * 0.4;
      ctx.beginPath();
      ctx.moveTo(x + 32, base - 190);
      ctx.lineTo(x + 32 + Math.cos(a) * 14, base - 190 + Math.sin(a) * 14);
      ctx.moveTo(x + 32, base - 190);
      ctx.lineTo(x + 32, base - 202);
      ctx.stroke();
      return;
    }
    // castle
    ctx.fillRect(x, base - 110, 200, 110);
    [0, 70, 150].forEach((dx, i) => {
      const th = i === 1 ? 190 : 150;
      ctx.fillRect(x + dx, base - th, 50, th);
      ctx.beginPath();
      ctx.moveTo(x + dx - 6, base - th);
      ctx.lineTo(x + dx + 25, base - th - 50);
      ctx.lineTo(x + dx + 56, base - th);
      ctx.fill();
    });
    ctx.fillStyle = lit;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + 90, base - 150, 10, 16);
    ctx.fillRect(x + 20, base - 120, 10, 14);
    ctx.globalAlpha = 1;
  }

  function drawFar(th, sc) {
    const off = game.camX * 0.15;
    eachRepeat(off, 2400, (ox) => {
      ctx.fillStyle = th.far;
      ctx.beginPath();
      ctx.moveTo(ox, H);
      sc.hills.forEach((y, i) => ctx.lineTo(ox + i * 80, y));
      ctx.lineTo(ox + 2400, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = th.far;
      ctx.lineCap = 'round';
      for (const tr of sc.trees) {
        const i = Math.floor(tr.x / 80);
        const base = sc.hills[i] + 6;
        const x = ox + tr.x;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, base);
        const tx = x + tr.lean * tr.h;
        ctx.lineTo(tx, base - tr.h);
        ctx.stroke();
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + tr.lean * tr.h * 0.6, base - tr.h * 0.6);
        ctx.lineTo(x + tr.lean * tr.h * 0.6 - 14, base - tr.h * 0.85);
        ctx.moveTo(tx, base - tr.h);
        ctx.lineTo(tx + 12, base - tr.h - 12);
        ctx.moveTo(x + tr.lean * tr.h * 0.8, base - tr.h * 0.8);
        ctx.lineTo(x + tr.lean * tr.h * 0.8 + 14, base - tr.h * 0.92);
        ctx.stroke();
      }
      drawLandmark(th.mark, ox + 1500, sc.hills[19] + 10, th.far, th.lit);
    });
  }

  function drawMid(th, sc) {
    const off = game.camX * 0.45;
    eachRepeat(off, 1800, (ox) => {
      for (const hs of sc.houses) {
        const x = ox + hs.x;
        if (x > W || x + hs.w < 0) continue;
        const top = H - 40 - hs.h;
        ctx.fillStyle = th.mid;
        ctx.fillRect(x, top, hs.w, hs.h + 40);
        if (hs.peak) {
          ctx.beginPath();
          ctx.moveTo(x - 8, top);
          ctx.lineTo(x + hs.w / 2, top - hs.w * 0.45);
          ctx.lineTo(x + hs.w + 8, top);
          ctx.fill();
        }
        ctx.fillStyle = th.lit;
        ctx.globalAlpha = 0.35;
        hs.win.forEach((on, k) => {
          if (on) ctx.fillRect(x + 12 + k * ((hs.w - 30) / 2), top + 22, 9, 12);
        });
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawBats(sc) {
    for (const b of sc.bats) {
      const x = ((((b.x - game.t * b.v - game.camX * 0.3) % (W + 80)) + W + 80) % (W + 80)) - 40;
      art.bat(ctx, x, b.y + Math.sin(game.t * 2 + b.p) * 10, game.t + b.p, b.s, 'rgba(8, 5, 14, 0.85)');
    }
  }

  function drawBuilding(roof, deco, th) {
    const x0 = roof.x0;
    const x1 = roof.x1;
    const top = roof.top;
    const w = x1 - x0;
    if (deco.chimney) {
      ctx.fillStyle = th.roof;
      ctx.fillRect(deco.chimney.x, top - deco.chimney.h, 16, deco.chimney.h + 4);
      ctx.fillStyle = th.edge;
      ctx.fillRect(deco.chimney.x - 3, top - deco.chimney.h - 4, 22, 5);
    }
    ctx.fillStyle = th.walls[deco.wall];
    ctx.fillRect(x0, top + 8, w, H - top);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x1 - 10, top + 8, 10, H - top);
    for (const win of deco.windows) {
      if (win.x + 22 > x1 - 6) continue;
      ctx.fillStyle = win.lit ? th.lit : th.dark;
      ctx.fillRect(win.x, win.y, 22, 30);
      if (win.lit) {
        ctx.fillStyle = th.walls[deco.wall];
        ctx.fillRect(win.x + 10, win.y, 2, 30);
        ctx.fillRect(win.x, win.y + 14, 22, 2);
        if (win.face) {
          ctx.fillStyle = 'rgba(60, 20, 0, 0.85)';
          ctx.beginPath();
          ctx.ellipse(win.x + 11, win.y + 22, 7, 5.5, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.fillStyle = th.roof;
    ctx.fillRect(x0 - 6, top, w + 12, 10);
    ctx.fillStyle = th.edge;
    ctx.fillRect(x0 - 6, top + 10, w + 12, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x0 - 6, top, w + 12, 2);
    if (deco.garland) {
      const n = Math.floor(w / 28);
      ctx.strokeStyle = 'rgba(20, 10, 20, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = x0 + 10 + i * ((w - 20) / n);
        const y = top + 18 + Math.sin((i / n) * Math.PI) * 10;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const x = x0 + 10 + (i + 0.5) * ((w - 20) / n);
        const y = top + 18 + Math.sin(((i + 0.5) / n) * Math.PI) * 10;
        ctx.fillStyle = i % 2 ? '#7b3fb8' : '#ff8a1f';
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 10);
        ctx.fill();
      }
    }
  }

  /* 결승 파티장 */
  function drawPartyHouse(th) {
    const lv = game.level;
    const door = lv.goalX + DOOR;
    const base = lv.roofs[lv.roofs.length - 1].top;
    if (door - 260 > game.camX + W || door + 260 < game.camX) return;
    // 탑
    ctx.fillStyle = th.walls[1];
    [door - 205, door + 150].forEach((x) => {
      ctx.fillRect(x, base - 270, 56, 270);
      ctx.fillStyle = th.roof;
      ctx.beginPath();
      ctx.moveTo(x - 8, base - 270);
      ctx.lineTo(x + 28, base - 345);
      ctx.lineTo(x + 64, base - 270);
      ctx.fill();
      ctx.fillStyle = th.lit;
      ctx.fillRect(x + 20, base - 230, 16, 22);
      ctx.fillStyle = th.walls[1];
    });
    // 본채
    ctx.fillStyle = th.walls[2];
    ctx.fillRect(door - 160, base - 210, 320, 210);
    ctx.fillStyle = th.roof;
    ctx.beginPath();
    ctx.moveTo(door - 185, base - 205);
    ctx.lineTo(door, base - 300);
    ctx.lineTo(door + 185, base - 205);
    ctx.fill();
    ctx.fillStyle = th.lit;
    [-120, -70, 50, 100].forEach((dx) => ctx.fillRect(door + dx, base - 175, 22, 30));
    // 줄 전구
    for (let i = 0; i <= 14; i++) {
      const x = door - 180 + i * (360 / 14);
      const y = base - 235 + Math.sin((i / 14) * Math.PI) * 26;
      ctx.fillStyle = ['#ff8a1f', '#ffd166', '#b48cff', '#5fd9b6'][(i + Math.floor(game.t * 4)) % 4];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.fill();
    }
    // 현수막
    ctx.fillStyle = '#ff8a1f';
    art.roundRect(ctx, door - 92, base - 138, 184, 40, 8);
    ctx.fill();
    HG.text(ctx, '할로윈 파티', door, base - 117, { size: 26, font: HG.FONT_DISPLAY, color: '#2b1400' });
    // 문 (빛)
    const g = ctx.createLinearGradient(0, base - 84, 0, base);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#ff8a1f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(door - 30, base);
    ctx.lineTo(door - 30, base - 56);
    ctx.arc(door, base - 56, 30, Math.PI, 0);
    ctx.lineTo(door + 30, base);
    ctx.closePath();
    ctx.fill();
    art.pumpkin(ctx, door - 58, base - 13, 16, 13, 'happy');
    art.pumpkin(ctx, door + 58, base - 13, 16, 13, 'wow');
  }

  function drawLanterns(lv, h) {
    const target = h.state === 'air' ? C.findAnchor(lv, h) : -1;
    lv.anchors.forEach((a, i) => {
      if (a.x < game.camX - 60 || a.x > game.camX + W + 60) return;
      const hooked = h.state === 'swing' && h.rope && h.rope.i === i;
      art.lantern(ctx, a.x, a.y + 15, game.t + i, { active: i === target || hooked });
    });
  }

  function drawCandies(lv) {
    const left = game.camX - 30;
    const right = game.camX + W + 30;
    for (const c of lv.candies) {
      if (c.taken || c.x < left) continue;
      if (c.x > right) break;
      if (c.gold) art.goldCandy(ctx, c.x, c.y, game.t);
      else art.candy(ctx, c.x, c.y, game.t, c.kind);
    }
  }

  function heroHand(h, rot) {
    const hx = 5;
    const hy = -12;
    return { x: h.x + hx * Math.cos(rot) - hy * Math.sin(rot), y: h.y + hx * Math.sin(rot) + hy * Math.cos(rot) };
  }

  function drawWeb(h) {
    if (h.state === 'swing' && h.rope) {
      const r = h.rope;
      const rot = Math.atan2(r.ax - h.x, h.y - r.ay);
      const hand = heroHand(h, rot);
      ctx.strokeStyle = 'rgba(245, 240, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hand.x, hand.y);
      ctx.lineTo(r.ax, r.ay);
      ctx.stroke();
      // 등불에 붙은 거미줄 모양
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(245, 240, 255, 0.7)';
      const len = Math.hypot(hand.x - r.ax, hand.y - r.ay) || 1;
      const dx = (hand.x - r.ax) / len;
      const dy = (hand.y - r.ay) / len;
      for (let k = 1; k <= 2; k++) {
        const px = r.ax + dx * 10 * k;
        const py = r.ay + dy * 10 * k;
        ctx.beginPath();
        ctx.moveTo(px - dy * 6, py + dx * 6);
        ctx.lineTo(px + dy * 6, py - dx * 6);
        ctx.stroke();
      }
    }
    if (fx.miss) {
      const p = fx.miss.t / 0.3;
      const len = 130 * Math.sin(Math.PI * p);
      const x = h.x + 4;
      const y = h.y - 12;
      ctx.strokeStyle = 'rgba(245, 240, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.5, y - len * 0.866);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawHero(h) {
    let pose = 'run';
    let rot = 0;
    let face = 'happy';
    let alpha = 1;
    switch (h.state) {
      case 'air':
        pose = 'air';
        rot = h.flipT > 0 ? (1 - h.flipT / 0.5) * TAU : clamp(h.vy / 1400, -0.3, 0.45) * 0.5;
        if (h.vy > 700) face = 'scared';
        break;
      case 'swing':
        pose = 'swing';
        rot = Math.atan2(h.rope.ax - h.x, h.y - h.rope.ay);
        break;
      case 'fallen':
        pose = 'air';
        face = 'scared';
        break;
      case 'ready':
        pose = 'idle';
        alpha = Math.floor(game.modeT * 8) % 2 ? 0.35 : 1;
        break;
      case 'goal':
        face = 'wow';
        alpha = clamp((game.level.goalX + DOOR - h.x) / 40, 0, 1);
        break;
      default:
        if (game.mode === 'title' || game.mode === 'intro' || game.mode === 'board') pose = 'idle';
    }
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    art.pumpkinBoy(ctx, h.x, h.y, { t: game.t, pose, rot, face });
    ctx.globalAlpha = 1;
  }

  function drawFx() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of texts) {
      ctx.globalAlpha = clamp(t.life / 0.5, 0, 1);
      HG.text(ctx, t.text, t.x, t.y, { size: t.size, color: t.color, stroke: 'rgba(15, 8, 25, 0.85)', strokeWidth: 4 });
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    const w = game.world;
    const lv = game.level;
    const stroke = { stroke: 'rgba(12, 7, 22, 0.85)', strokeWidth: 5 };
    HG.text(ctx, '점수 ' + HG.formatNumber(game.total + (game.banked ? 0 : w.score)), 20, 30, Object.assign({ size: 24, align: 'left' }, stroke));
    if (game.fast) HG.text(ctx, '👻 1.5배속', 20, 60, Object.assign({ size: 15, align: 'left', color: '#9ff0d8' }, stroke));

    // 단계 이름과 진행 막대
    HG.text(ctx, game.stage + 1 + '단계 · ' + lv.name, W / 2, 24, Object.assign({ size: 18 }, stroke));
    const bw = 280;
    const bx = W / 2 - bw / 2;
    const prog = clamp((w.hero.x - 120) / (lv.goalX - 120), 0, 1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    art.roundRect(ctx, bx, 42, bw, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ff8a1f';
    art.roundRect(ctx, bx, 42, Math.max(8, bw * prog), 8, 4);
    ctx.fill();
    art.pumpkin(ctx, bx + bw * prog, 46, 8, 7, 'happy');
    HG.text(ctx, '🏠', bx + bw + 14, 46, { size: 16 });

    // 남은 호박(목숨)과 황금 별사탕
    for (let i = 0; i < LIVES; i++) {
      ctx.globalAlpha = i < game.lives ? 1 : 0.25;
      art.pumpkin(ctx, W - 30 - i * 32, 30, 12, 10, 'happy', i < game.lives);
    }
    ctx.globalAlpha = 1;
    HG.text(ctx, '★ ' + w.golds + ' / ' + lv.goldTotal, W - 18, 62, Object.assign({ size: 18, align: 'right', color: '#ffd166' }, stroke));
  }

  function banner(big, small, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    HG.text(ctx, big, W / 2, H / 2 - 30, { size: 64, font: HG.FONT_DISPLAY, color: '#ff8a1f', stroke: '#1a0d00', strokeWidth: 8 });
    if (small) HG.text(ctx, small, W / 2, H / 2 + 28, { size: 26, stroke: 'rgba(12, 7, 22, 0.9)', strokeWidth: 6 });
    ctx.globalAlpha = 1;
  }

  function drawBanners() {
    const m = game.mode;
    if (m === 'intro') {
      const st = C.STAGES[game.stage];
      banner(game.stage + 1 + '단계', st.name);
      if (game.modeT > 0.9) HG.text(ctx, '준비…', W / 2, H / 2 + 74, { size: 24, color: '#ffd166', stroke: 'rgba(12, 7, 22, 0.9)', strokeWidth: 5 });
    } else if (m === 'play' && game.goT < 0.7) {
      banner('출발!', null, 1 - game.goT / 0.7);
    } else if (m === 'dead') {
      banner('앗!', game.lives > 0 ? '남은 호박 ' + '●'.repeat(game.lives) + '○'.repeat(LIVES - game.lives) : '호박이 하나도 안 남았어요');
    } else if (m === 'ready') {
      ctx.fillStyle = 'rgba(8, 5, 14, ' + clamp(0.6 - game.modeT * 2, 0, 0.6) + ')';
      ctx.fillRect(0, 0, W, H);
      banner('다시 출발!', '거미줄은 호박 등불에 걸 수 있어요', clamp(game.modeT * 3, 0, 1));
    } else if (m === 'goal') {
      banner('도착!', null, clamp(game.modeT * 2, 0, 1));
    }
  }

  function drawConfetti() {
    for (const c of confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillStyle = c.c;
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
  }

  function render() {
    view.begin();
    const th = THEMES[game.stage];
    const sc = game.scene;
    const lv = game.level;
    const h = game.world.hero;
    if (h.state !== 'fallen') game.camX = clamp(h.x - 280, -60, lv.end - W);
    drawSky(th, sc);
    drawFar(th, sc);
    drawMid(th, sc);
    drawBats(sc);
    ctx.save();
    const sx = game.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
    const sy = game.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.translate(-game.camX + sx, sy);
    for (let i = 0; i < lv.roofs.length; i++) {
      const r = lv.roofs[i];
      if (r.x1 + 20 < game.camX || r.x0 - 20 > game.camX + W) continue;
      drawBuilding(r, sc.buildings[i], th);
    }
    drawPartyHouse(th);
    drawLanterns(lv, h);
    drawCandies(lv);
    drawWeb(h);
    drawHero(h);
    drawFx();
    ctx.restore();
    drawConfetti();
    if (game.mode !== 'title' && game.mode !== 'board') {
      drawHUD();
      drawBanners();
    }
  }

  /* ---------------- 배경음 (으스스하지만 신나는 행진) ---------------- */
  const MELODY = [
    [74, 0, 69, 0, 65, 0, 69, 0, 74, 0, 76, 0, 77, 0, 76, 0],
    [74, 0, 70, 0, 65, 0, 70, 0, 74, 0, 72, 0, 70, 0, 69, 0],
    [67, 0, 70, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0],
    [69, 0, 73, 0, 76, 0, 81, 0, 79, 0, 76, 0, 73, 0, 69, 0],
  ];
  const ROOTS = [38, 34, 31, 33];
  const SONG = {
    bpm: 132,
    play(step, when, dur, m) {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;
      const loop = Math.floor(step / 64) % 2;
      if (s % 2 === 0) {
        const n = ROOTS[bar] + (s % 4 === 0 ? 0 : 7);
        m.tone({ type: 'triangle', f: m.N(n), dur: dur * 1.8, vol: 0.32, when });
      }
      const note = MELODY[bar][s];
      if (note && (loop === 0 || s % 4 === 0)) {
        m.tone({ type: 'square', f: m.N(note + (loop ? -12 : 0)), dur: dur * 1.6, vol: 0.08, when, lowpass: 2600 });
      }
      if (s % 4 === 2) m.noise({ type: 'highpass', f: 6000, dur: 0.04, vol: 0.05, when });
    },
  };

  /* ---------------- 버튼 연결 ---------------- */
  $('startBtn').addEventListener('click', () => startGame(0));
  $('boardBtn').addEventListener('click', () => {
    HG.renderBoard($('boardList'), GAME, boardFormat, -1);
    setMode('board');
    show('board');
    $('boardClose').focus();
  });
  $('boardClose').addEventListener('click', goTitle);
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', goTitle);
  $('nextBtn').addEventListener('click', nextStage);
  $('retryBtn').addEventListener('click', () => startGame(0));
  $('homeBtn').addEventListener('click', goTitle);
  $('pauseBtn').addEventListener('click', () => {
    $('pauseBtn').blur();
    if (game.mode === 'paused') resume();
    else pause();
  });
  HG.bindMuteButton($('muteBtn'));
  HG.bindFullscreenButton($('fullBtn'));

  goTitle();
  HG.loop(update, render);

  // 자동 검사용 창 (게임에는 쓰이지 않아요)
  window.__hobak = { game, input };
})();
