/* 죽림고스트 — 화면 그리기, 조작, 진행 */
(function () {
  'use strict';

  const J = window.JukrimCore;
  const art = HG.art;
  const W = J.W;
  const H = J.H;
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const view = HG.fitStage($('stageArea'), $('stage'), canvas, W, H);
  const ctx = view.ctx;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const boardKey = (mode) => 'jukrim-' + mode;
  const fmt = (s) => (Math.floor(s * 100 + 1e-6) / 100).toFixed(2) + '초'; // 9.79*100=978.99… 같은 오차를 막아요

  function seeded(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const LEVEL_NOTES = {
    2: '화살이 한꺼번에 여러 개 와요',
    3: '모여드는 화살과 빠른 빨간 화살!',
    4: '화살 벽의 구멍을 찾아요',
    5: '사방에서 빙 둘러 날아와요',
    6: '끝없는 화살비! 진짜 고수만 버텨요',
  };

  /* ---------------- 배경 ---------------- */
  // 화면 픽셀 크기 그대로 만들어 두면 매 화면 확대 없이 그대로 옮겨 그릴 수 있어요
  let backdrop = null;
  function makeBackdrop() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const b = c.getContext('2d');
    b.scale(canvas.width / W, canvas.height / H);
    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#080c20');
    sky.addColorStop(0.6, '#1d2346');
    sky.addColorStop(1, '#30294f');
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);
    const r = seeded(77);
    b.fillStyle = '#fff6dc';
    for (let i = 0; i < 90; i++) {
      b.globalAlpha = 0.25 + r() * 0.6;
      b.fillRect(r() * W, r() * H * 0.55, 1 + r() * 1.4, 1 + r() * 1.4);
    }
    b.globalAlpha = 1;
    art.moon(b, 735, 118, 54);
    for (let i = 0; i < 28; i++) {
      art.bamboo(b, r() * W, -30, H + 10, 6 + r() * 5, 'rgba(16, 44, 46, 0.95)', 'rgba(36, 78, 72, 0.95)', 0);
    }
    const mist = b.createLinearGradient(0, H * 0.5, 0, H);
    mist.addColorStop(0, 'rgba(130, 100, 180, 0)');
    mist.addColorStop(1, 'rgba(130, 100, 180, 0.3)');
    b.fillStyle = mist;
    b.fillRect(0, H * 0.5, W, H * 0.5);
    // 움직이지 않는 가운데 대나무와 바닥의 잭오랜턴도 미리 그려 둡니다
    for (const st of stalks) if (st.layer === 1) drawStalk(b, st, 0, 0);
    for (const p of pumpkins) {
      const glow = b.createRadialGradient(p.x, H - 16, 4, p.x, H - 16, 50 * p.s);
      glow.addColorStop(0, 'rgba(255, 170, 70, 0.35)');
      glow.addColorStop(1, 'rgba(255, 170, 70, 0)');
      b.fillStyle = glow;
      b.fillRect(p.x - 60, H - 70, 120, 70);
      art.pumpkin(b, p.x, H - 14, 17 * p.s, 13 * p.s, p.face);
    }
    return c;
  }

  let fogSprite = null;
  function makeFog() {
    const c = document.createElement('canvas');
    c.width = 260;
    c.height = 260;
    const f = c.getContext('2d');
    const g = f.createRadialGradient(130, 130, 5, 130, 130, 130);
    g.addColorStop(0, 'rgba(200, 180, 240, 0.12)');
    g.addColorStop(1, 'rgba(200, 180, 240, 0)');
    f.fillStyle = g;
    f.fillRect(0, 0, 260, 260);
    return c;
  }

  function drawStalk(c, s, t, swayOn) {
    const sway = swayOn ? Math.sin(t * 0.7 + s.p) * s.sway : 0;
    const col = s.layer === 1 ? '#15362f' : '#1b4237';
    const node = s.layer === 1 ? '#204a42' : '#295a4a';
    art.bamboo(c, s.x, -30, H + 10, s.w, col, node, sway);
    for (const l of s.leafs) {
      const k = 1 - l.y;
      const lx = s.x + sway * k * k;
      const ly = -30 + (H + 40) * l.y;
      art.leaf(c, lx, ly, (l.side < 0 ? Math.PI + 0.5 : -0.5) + (swayOn ? Math.sin(t + s.p) * 0.08 : 0), l.len, s.layer === 1 ? '#1a4639' : '#215443');
    }
  }

  const stalks = [];
  const pumpkins = [];
  const leaves = [];
  const flies = [];
  (function () {
    const r = seeded(4242);
    const add = (layer, n, w0, w1) => {
      for (let i = 0; i < n; i++) {
        const leafs = [];
        for (let k = 0; k < 3; k++) leafs.push({ y: 0.15 + r() * 0.6, side: r() < 0.5 ? -1 : 1, len: 26 + r() * 22 });
        stalks.push({ x: r() * W, w: w0 + r() * (w1 - w0), layer, p: r() * TAU, sway: 5 + r() * 7, leafs });
      }
    };
    add(1, 10, 10, 15);
    add(2, 5, 15, 20);
    [70, 250, 520, 700, 890].forEach((x, i) => pumpkins.push({ x: x + r() * 30, s: 0.8 + r() * 0.5, face: i % 2 ? 'wow' : 'happy' }));
    for (let i = 0; i < 14; i++) leaves.push({ x: r() * W, y: r() * H, v: 18 + r() * 22, a: r() * TAU, va: (r() - 0.5) * 2, len: 9 + r() * 7 });
    for (let i = 0; i < 12; i++) flies.push({ x: r() * W, y: H * 0.4 + r() * H * 0.55, p: r() * TAU, s: 0.4 + r() * 0.6 });
  })();

  function drawBackdrop() {
    if (!backdrop || backdrop.width !== canvas.width || backdrop.height !== canvas.height) backdrop = makeBackdrop();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0);
    ctx.restore();
  }

  function drawScenery(t) {
    if (!fogSprite) fogSprite = makeFog();
    for (const s of stalks) if (s.layer === 2) drawStalk(ctx, s, t, true);
    // 안개
    for (let i = 0; i < 2; i++) {
      const x = ((t * (12 + i * 8) + i * 400) % (W + 600)) - 300;
      ctx.drawImage(fogSprite, x - 260, H - 300 - i * 60, 520, 520);
    }
    // 반딧불이
    for (const f of flies) {
      const x = f.x + Math.sin(t * f.s + f.p) * 30;
      const y = f.y + Math.cos(t * f.s * 1.3 + f.p) * 18;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 3 + f.p);
      ctx.fillStyle = '#d9ff8a';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 떨어지는 댓잎
    for (const l of leaves) art.leaf(ctx, l.x, l.y, l.a, l.len, 'rgba(70, 140, 100, 0.45)');
  }

  function stepScenery(dt) {
    for (const l of leaves) {
      l.y += l.v * dt;
      l.x += Math.sin(game.t + l.a) * 12 * dt;
      l.a += l.va * dt;
      if (l.y > H + 20) {
        l.y = -20;
        l.x = Math.random() * W;
      }
    }
  }

  /* ---------------- 상태 ---------------- */
  const game = {
    mode: 'title', // title | board | count | play | hit | over | paused
    modeName: HG.store.get('jukrim:mode', 'normal'),
    world: J.createWorld('normal', 1),
    t: 0,
    modeT: 0,
    paused: null,
    shake: 0,
    flash: 0,
    banner: null,
    nearCool: 0,
  };
  if (!J.MODES[game.modeName]) game.modeName = 'normal';

  const trail = [];
  const texts = [];

  function setMode(m) {
    game.mode = m;
    game.modeT = 0;
  }

  const screens = {
    title: $('titleScreen'),
    board: $('boardScreen'),
    pause: $('pauseScreen'),
    result: $('resultScreen'),
  };
  function show(name) {
    Object.keys(screens).forEach((k) => (screens[k].hidden = k !== name));
  }
  function hideAll() {
    show(null);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  function paintModes() {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('picked', b.dataset.mode === game.modeName));
  }

  function goTitle() {
    HG.sound.stopMusic();
    game.world = J.createWorld(game.modeName, 1);
    setMode('title');
    paintModes();
    show('title');
  }

  function start(mode) {
    game.modeName = mode;
    HG.store.set('jukrim:mode', mode);
    game.world = J.createWorld(mode);
    trail.length = 0;
    texts.length = 0;
    game.banner = null;
    game.flash = 0;
    keys.clear();
    hideAll();
    setMode('count');
    HG.sound.play('start');
    HG.sound.music(SONG);
  }

  const isPlaying = () => game.mode === 'count' || game.mode === 'play' || game.mode === 'hit';

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
    keys.clear();
    drag = null;
    hideAll();
    HG.sound.resumeMusic();
  }

  /* ---------------- 조작 ---------------- */
  const KEYMAP = {
    ArrowLeft: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0],
    ArrowUp: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
  };
  const keys = new Set();
  let drag = null;
  const pull = { x: 0, y: 0 };

  function takeInput(dt) {
    if (pull.x || pull.y) {
      const d = Math.hypot(pull.x, pull.y);
      const lim = J.MOVE * 1.4 * dt;
      const k = d > lim ? lim / d : 1;
      const mx = pull.x * k;
      const my = pull.y * k;
      pull.x -= mx;
      pull.y -= my;
      if (Math.abs(pull.x) < 0.01) pull.x = 0;
      if (Math.abs(pull.y) < 0.01) pull.y = 0;
      return { mx, my };
    }
    let dx = 0;
    let dy = 0;
    keys.forEach((code) => {
      dx += KEYMAP[code][0];
      dy += KEYMAP[code][1];
    });
    return { dx, dy };
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
    if (KEYMAP[e.code]) {
      e.preventDefault();
      keys.add(e.code);
      return;
    }
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    if (e.target && e.target.closest && e.target.closest('button, a')) return;
    e.preventDefault();
    if (e.repeat) return;
    if (game.mode === 'title') start(game.modeName);
    else if (game.mode === 'over' && game.modeT > 0.8 && $('nameForm').hidden) start(game.modeName);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  canvas.addEventListener('pointerdown', (e) => {
    if (drag) return;
    e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 포인터 고정이 안 되는 브라우저도 있어요 */
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = canvas.getBoundingClientRect();
    const k = W / r.width;
    pull.x = clamp(pull.x + (e.clientX - drag.x) * k, -160, 160);
    pull.y = clamp(pull.y + (e.clientY - drag.y) * k, -160, 160);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => {
    if (drag && e.pointerId === drag.id) drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('blur', () => {
    keys.clear();
    drag = null;
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
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt);
    if (game.nearCool > 0) game.nearCool -= dt;
    if (game.banner) {
      game.banner.t += dt;
      if (game.banner.t > game.banner.life) game.banner = null;
    }
    const w = game.world;

    if (game.mode === 'count') {
      J.moveGhost(w, takeInput(dt), dt);
      [0, 0.6, 1.2].forEach((at) => {
        if (game.modeT >= at && game.modeT - dt < at) HG.sound.play('tick');
      });
      if (game.modeT >= 1.8) {
        setMode('play');
        HG.sound.play('go');
        game.banner = { big: '시작!', small: '화살촉만 조심해요', t: 0, life: 1.1 };
      }
    } else if (game.mode === 'play') {
      J.step(w, takeInput(dt), dt);
      for (const e of w.events) {
        if (e.type === 'level') {
          HG.sound.play('gold');
          HG.sound.setTempo(1 + (e.level - 1) * 0.05);
          game.banner = { big: '레벨 ' + e.level, small: LEVEL_NOTES[e.level] || '', t: 0, life: 1.8 };
        } else if (e.type === 'near' && game.nearCool <= 0) {
          game.nearCool = 0.35;
          HG.sound.play('whoosh');
          texts.push({ x: e.x, y: e.y - 34, text: '아슬!', life: 0.7, color: '#9ff0d8' });
        } else if (e.type === 'hit') {
          HG.sound.stopMusic();
          HG.sound.play('hit');
          game.shake = 0.4;
          game.flash = 0.35;
          setMode('hit');
        }
      }
      w.events.length = 0;
    } else if (game.mode === 'hit') {
      if (game.modeT >= 1.1) showResult();
    } else if (game.mode === 'title' || game.mode === 'board') {
      const g = w.ghost;
      g.x = W / 2 + Math.sin(game.t * 0.6) * 160;
      g.y = H / 2 + 40 + Math.sin(game.t * 1.1) * 30;
      g.vx = Math.cos(game.t * 0.6) * 96;
    }

    // 유령 꼬리
    const g = w.ghost;
    if ((game.mode === 'play' || game.mode === 'count' || game.mode === 'title') && Math.hypot(g.vx, g.vy) > 30 && Math.random() < 0.5) {
      trail.push({ x: g.x + (Math.random() - 0.5) * 16, y: g.y + 14, life: 0.45 });
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt;
      trail[i].y += 10 * dt;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      texts[i].life -= dt;
      texts[i].y -= 30 * dt;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
    stepScenery(dt);
  }

  function showResult() {
    const w = game.world;
    const secs = Math.floor(w.t * 100 + 1e-6) / 100;
    const key = boardKey(game.modeName);
    const prev = HG.best.get(key);
    const record = HG.best.submit(key, secs) && prev > 0;
    $('resultMode').textContent = J.MODES[game.modeName].label + ' 난이도';
    $('resultScore').textContent = fmt(secs);
    $('resultTitle').textContent = J.titleFor(secs);
    $('newRecord').hidden = !record;
    const stats = $('resultStats');
    stats.textContent = '';
    [
      ['피한 화살', w.dodged + '개'],
      ['아슬아슬', w.near + '번'],
      ['레벨', String(w.level)],
    ].forEach(([k, v]) => {
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = v;
      span.append(k + ' ', b);
      stats.appendChild(span);
    });
    HG.setupResultBoard({
      game: key,
      score: secs,
      form: $('nameForm'),
      input: $('nameInput'),
      list: $('resultBoard'),
      format: (row) => fmt(row.score),
      onSaved: () => $('retryBtn').focus(),
    });
    HG.sound.play('gameover');
    setMode('over');
    show('result');
  }

  /* ---------------- 그리기 ---------------- */
  function drawWarnings(w) {
    for (const a of w.arrows) {
      if (a.delay <= 0 || a.warn <= 0) continue;
      const p = 1 - a.delay / a.warn;
      const ex = clamp(a.x, 16, W - 16);
      const ey = clamp(a.y, 16, H - 16);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a.angle);
      ctx.globalAlpha = (0.6 + 0.4 * p) * (0.8 + 0.2 * Math.sin(game.t * 20));
      ctx.fillStyle = a.kind === 'fast' ? '#ff4d4d' : '#ffa64d';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawArrows(w) {
    for (const a of w.arrows) {
      if (a.delay > 0) continue;
      art.arrow(ctx, a.x, a.y, a.angle, a.kind);
    }
  }

  function drawGhost(w) {
    for (const p of trail) {
      ctx.globalAlpha = clamp(p.life / 0.45, 0, 1) * 0.5;
      ctx.fillStyle = '#e8e2ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 + p.life * 6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const g = w.ghost;
    const hit = game.mode === 'hit' || game.mode === 'over';
    const face = hit ? 'hit' : game.mode === 'title' || game.mode === 'board' ? 'happy' : 'normal';
    const bob = hit ? 0 : Math.sin(game.t * 4) * 2;
    art.ghost(ctx, g.x, g.y + bob, { t: game.t, r: 20, tilt: clamp(g.vx / 900, -0.3, 0.3), face });
  }

  function drawHUD(w) {
    const stroke = { stroke: 'rgba(5, 8, 20, 0.85)', strokeWidth: 6 };
    const secs = game.mode === 'count' ? 0 : w.t;
    HG.text(ctx, fmt(secs), W / 2, 36, Object.assign({ size: 40 }, stroke));
    const best = HG.best.get(boardKey(game.modeName));
    if (best > 0) HG.text(ctx, '최고 ' + fmt(best), W / 2, 72, Object.assign({ size: 17, color: '#ffd166' }, stroke));
    HG.text(ctx, J.MODES[game.modeName].label + ' · 레벨 ' + w.level, 20, 30, Object.assign({ size: 20, align: 'left', color: '#9ff0d8' }, stroke));
    HG.text(ctx, '피한 화살 ' + w.dodged, W - 20, 30, Object.assign({ size: 20, align: 'right' }, stroke));
  }

  function drawBanner() {
    if (game.mode === 'count') {
      const n = 3 - Math.floor(game.modeT / 0.6);
      const p = (game.modeT % 0.6) / 0.6;
      HG.text(ctx, String(Math.max(1, n)), W / 2, 170, { size: 110 - p * 30, font: HG.FONT_DISPLAY, color: '#9ff0d8', stroke: '#0b2a24', strokeWidth: 9 });
      HG.text(ctx, '방향키나 끌기로 움직여 봐요', W / 2, 238, { size: 22, stroke: 'rgba(5, 8, 20, 0.85)', strokeWidth: 5 });
      return;
    }
    const b = game.banner;
    if (!b) return;
    const a = clamp(Math.min(b.t * 4, (b.life - b.t) * 3), 0, 1);
    ctx.globalAlpha = a;
    HG.text(ctx, b.big, W / 2, H / 2 - 40, { size: 64, font: HG.FONT_DISPLAY, color: '#9ff0d8', stroke: '#0b2a24', strokeWidth: 8 });
    if (b.small) HG.text(ctx, b.small, W / 2, H / 2 + 14, { size: 24, stroke: 'rgba(5, 8, 20, 0.9)', strokeWidth: 5 });
    ctx.globalAlpha = 1;
  }

  function render() {
    view.begin();
    drawBackdrop();
    const w = game.world;
    ctx.save();
    if (game.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * game.shake / 0.4, (Math.random() - 0.5) * 10 * game.shake / 0.4);
    drawScenery(game.t);
    if (game.mode !== 'title' && game.mode !== 'board') {
      drawWarnings(w);
      drawArrows(w);
    }
    drawGhost(w);
    for (const tx of texts) {
      ctx.globalAlpha = clamp(tx.life / 0.4, 0, 1);
      HG.text(ctx, tx.text, tx.x, tx.y, { size: 20, color: tx.color, stroke: 'rgba(5, 8, 20, 0.85)', strokeWidth: 4 });
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (game.flash > 0) {
      ctx.fillStyle = 'rgba(255, 240, 240, ' + (game.flash / 0.35) * 0.5 + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (game.mode !== 'title' && game.mode !== 'board') {
      drawHUD(w);
      drawBanner();
    }
  }

  /* ---------------- 배경음 (오음계 + 북) ---------------- */
  const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];
  const MEL = [
    [5, -1, -1, 6, -1, -1, 7, -1, 8, -1, -1, -1, 9, -1, 8, -1],
    [7, -1, -1, 6, -1, -1, 5, -1, 4, -1, -1, -1, 5, -1, -1, -1],
    [5, -1, 6, -1, 7, -1, 9, -1, 8, -1, 7, -1, 6, -1, 7, -1],
    [8, -1, 7, -1, 6, -1, 4, -1, 5, -1, -1, -1, -1, -1, -1, -1],
  ];
  const SONG = {
    bpm: 104,
    play(step, when, dur, m) {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;
      if (s === 0 || s === 8) m.tone({ type: 'sine', f: 75, to: 40, dur: 0.28, vol: 0.55, when });
      if (s === 6 || s === 14) m.tone({ type: 'sine', f: 95, to: 50, dur: 0.16, vol: 0.28, when });
      if (s % 4 === 2) m.noise({ type: 'bandpass', f: 1900, q: 6, dur: 0.05, vol: 0.12, when });
      if (s === 0 && bar % 2 === 0) m.tone({ type: 'sine', f: m.N(45), dur: dur * 30, vol: 0.07, when, attack: 0.3 });
      const i = MEL[bar][s];
      if (i >= 0) {
        m.tone({ type: 'triangle', f: m.N(PENTA[i]), dur: dur * 3.2, vol: 0.13, when });
        m.tone({ type: 'sine', f: m.N(PENTA[i] + 12), dur: dur * 2, vol: 0.03, when });
      }
    },
  };

  /* ---------------- 버튼 연결 ---------------- */
  document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => start(b.dataset.mode)));

  let tab = game.modeName;
  function paintBoard() {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    HG.renderBoard($('boardList'), boardKey(tab), (row) => fmt(row.score), -1);
  }
  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      paintBoard();
    })
  );
  $('boardBtn').addEventListener('click', () => {
    tab = game.modeName;
    paintBoard();
    setMode('board');
    show('board');
    $('boardClose').focus();
  });
  $('boardClose').addEventListener('click', goTitle);
  $('resumeBtn').addEventListener('click', resume);
  $('quitBtn').addEventListener('click', goTitle);
  $('retryBtn').addEventListener('click', () => start(game.modeName));
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
  window.__jukrim = { game, keys };
})();
