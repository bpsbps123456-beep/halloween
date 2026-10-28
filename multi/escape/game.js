/* 동암초 탈출 3D — 진행, 조작(걷기·둘러보기·누르기), 방 수수께끼, 복도 몰래 가기, 현관 탈출 */
(function () {
  'use strict';

  const T = window.THREE;
  const E = window.EscapeCore;
  const W3 = window.EscapeWorld;
  const R = W3.rooms;
  const MAP = window.EscapeMap;
  const X = window.EscapeTex;
  const GAME = 'escape';
  const SAVE = 'escape:run3d';
  const SETTINGS = 'escape:settings';
  const ROUTE = E.route();
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const canvas = $('scene');

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (tag === 'button') n.type = 'button';
    return n;
  }
  const blurActive = () => document.activeElement && document.activeElement !== document.body && document.activeElement.blur();
  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  /* ---------------- 선생님 설정: 주소(#t-…)가 먼저, 없으면 이 기기에 저장된 것 ---------------- */
  function linkSettings() {
    const m = /^#t-([A-Za-z0-9_-]+)$/.exec(location.hash);
    return m ? E.decodeSettings(m[1]) : null;
  }
  let settings = linkSettings() || E.normalizeSettings(HG.store.get(SETTINGS, null));
  // 선생님 링크로 한 번 열면 이 기기에 기억해서, 다음에 게임 목록에서 들어와도 같은 설정이에요
  if (linkSettings()) HG.store.set(SETTINGS, settings);
  const shortName = (s) => s.replace('초등학교', '초');

  HG.bindMuteButton($('muteBtn'));
  HG.bindFullscreenButton($('fullBtn'));

  if (!W3.supported() || !T) {
    $('loading').hidden = true;
    $('noGlScreen').hidden = false;
    return;
  }

  /* ---------------- 3D 화면 ---------------- */
  let view;
  try {
    view = W3.createRenderer(canvas);
  } catch (err) {
    $('loading').hidden = true;
    $('noGlScreen').hidden = false;
    return;
  }
  const camera = view.camera;
  const torch = view.torch;
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    stage.style.fontSize = Math.max(10, Math.min(20, 16 * Math.min(w / 960, h / 540))).toFixed(2) + 'px';
    view.resize(w, h);
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  resize();

  /* ---------------- 상태 ---------------- */
  const game = {
    mode: 'title', // title | play | done
    team: '1모둠',
    seed: 0,
    run: null,
    stage: 0,
    startedAt: 0,
    penalty: 0,
    hints: 0,
    caught: 0,
    finalTime: 0,
    t: 0,
    paused: false,
    roomHints: 0,
    solved: false,
  };
  const player = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, bob: 0, moving: false, running: false, stepT: 0 };
  let level = null;
  let st = null; // 지금 단계의 상태 (방 수수께끼, 복도 …)

  const elapsed = () => (game.mode === 'done' ? game.finalTime : (Date.now() - game.startedAt) / 1000 + game.penalty);

  function save() {
    if (game.mode !== 'play') return;
    HG.store.set(SAVE, {
      v: 2,
      seed: game.seed,
      team: game.team,
      settings,
      startedAt: game.startedAt,
      penalty: game.penalty,
      hints: game.hints,
      caught: game.caught,
      stage: game.stage,
      at: Date.now(),
    });
  }
  function loadSave() {
    const s = HG.store.get(SAVE, null);
    if (!s || s.v !== 2 || typeof s.stage !== 'number' || !ROUTE[s.stage] || Date.now() - s.at > 3 * 3600 * 1000) return null;
    if (s.seed !== settings.seed) return null; // 예전 문제로 하던 판은 이어서 하지 않아요
    return s;
  }

  /* ---------------- 화면 전환 ---------------- */
  const overlays = ['titleScreen', 'mapScreen', 'rewardScreen', 'noteScreen', 'caughtScreen', 'resultScreen', 'boardScreen', 'teacherScreen'];
  function showOverlay(id) {
    overlays.forEach((o) => ($(o).hidden = o !== id));
    game.paused = !!id && id !== 'caughtScreen' && id !== 'titleScreen';
    if (id) releaseInput();
  }
  const shown = (id) => !$(id).hidden;

  const places = () => game.run.steps.map((s) => s.place).concat([E.EXIT.place]);
  const roomsDone = () => ROUTE.slice(0, game.stage).filter((r) => r.kind === 'room').length + (st && st.kind === 'room' && game.solved ? 1 : 0);
  function where(place) {
    const at = E.locate(place);
    return at ? E.BUILDINGS[at.building].name + ' ' + at.floor + '층 ' + place : place;
  }

  let mapDone = null;
  function showMap(title, text, button, then) {
    $('mapTitle').textContent = title;
    $('mapText').textContent = text;
    $('mapGo').textContent = button;
    mapDone = then;
    showOverlay('mapScreen');
    $('mapGo').focus();
  }
  $('mapGo').addEventListener('click', () => {
    const then = mapDone;
    mapDone = null;
    showOverlay(null);
    blurActive();
    if (then) then();
  });
  $('mapBtn').addEventListener('click', () => {
    $('mapBtn').blur();
    if (game.mode !== 'play' || mapDone || panelOpen()) return;
    showMap('학교 지도 · 대피 안내도', '빨간 화살표가 탈출 경로예요. 숫자는 지나갈 차례!', '닫기', null);
  });
  function drawMap() {
    const c = $('mapCanvas');
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0f1530';
    g.fillRect(0, 0, w, h);
    const k = Math.min(w / 960, (h * 0.78) / 540);
    g.setTransform(k, 0, 0, k, (w - 960 * k) / 2, 0);
    MAP.draw(g, game.t, places(), roomsDone());
  }

  /* ---------------- 말풍선 ---------------- */
  let bubbleTimer = 0;
  function say(text, ms) {
    const b = $('bubble');
    b.textContent = '👻 ' + text;
    b.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => (b.hidden = true), ms || 4500);
  }
  let talkTimer = 0;
  function guardSay(text, ms) {
    const b = $('guardTalk');
    b.textContent = text;
    b.hidden = false;
    clearTimeout(talkTimer);
    talkTimer = setTimeout(() => (b.hidden = true), ms || 2500);
  }

  /* ---------------- 수수께끼 판 ---------------- */
  const panelWrap = $('panelWrap');
  const panelBody = $('panelBody');
  let panelOnClose = null;
  let activePad = null;
  function openPanel(title, build, onClose) {
    $('panelTitle').textContent = title;
    panelBody.textContent = '';
    activePad = null;
    panelWrap.hidden = false;
    panelOnClose = onClose || null;
    releaseInput();
    build(panelBody);
  }
  function closePanel() {
    if (panelWrap.hidden) return;
    panelWrap.hidden = true;
    panelBody.textContent = '';
    activePad = null;
    const f = panelOnClose;
    panelOnClose = null;
    if (f) f();
    blurActive();
  }
  const panelOpen = () => !panelWrap.hidden;
  $('panelClose').addEventListener('click', closePanel);
  panelWrap.addEventListener('pointerdown', (e) => {
    if (e.target === panelWrap) closePanel();
  });

  /* 답이 틀리면 30초 동안 다시 낼 수 없어요 (마구 눌러 맞히기 막기) */
  const WRONG_WAIT = 30;
  let waitUntil = 0;
  const waitLeft = () => Math.max(0, Math.ceil((waitUntil - Date.now()) / 1000));
  function wrongWait() {
    waitUntil = Date.now() + WRONG_WAIT * 1000;
  }
  function mustWait() {
    const left = waitLeft();
    if (!left) return false;
    HG.sound.play('tick');
    say('⏳ 답이 틀려서 ' + left + '초 기다려야 해! 그동안 모둠 친구들과 다시 생각해 봐.', 2500);
    return true;
  }

  /** 숫자 자판: o = { len, onEnter(value) → 맞으면 true } */
  function keypad(body, o) {
    let value = '';
    const disp = el('div', 'display');
    const paint = () => (disp.textContent = value + '_'.repeat(Math.max(0, o.len - value.length)));
    const pad = el('div', 'numpad');
    const press = (d) => {
      if (value.length < o.len) value += d;
      HG.sound.play('tick');
      paint();
    };
    '1234567890'.split('').forEach((d) => {
      const b = el('button', 'num', d);
      b.addEventListener('click', () => press(d));
      pad.append(b);
    });
    const row = el('div', 'prow');
    const del = el('button', 'btn btn-quiet', '⌫ 지우기');
    const back = () => {
      value = value.slice(0, -1);
      paint();
    };
    del.addEventListener('click', back);
    const ok = el('button', 'btn', '확인');
    const enter = () => {
      if (!value || mustWait()) return;
      if (!o.onEnter(value)) {
        wrongWait();
        HG.sound.play('wrong');
        value = '';
        paint();
        shake(disp);
      }
    };
    ok.addEventListener('click', enter);
    row.append(del, ok);
    body.append(disp, pad, row);
    paint();
    activePad = { press, back, enter };
    return {
      set(v) {
        value = String(v).slice(0, o.len);
        paint();
      },
    };
  }
  function posterView(body, canvasMaker) {
    const img = el('img', 'poster-big');
    img.alt = '';
    img.src = canvasMaker().toDataURL();
    body.append(img);
  }

  /* ---------------- 시작 / 이어하기 ---------------- */
  function paintTitle() {
    $('titleName').textContent = shortName(settings.school) + ' 탈출';
    document.querySelector('.game-bar h1').firstChild.textContent = shortName(settings.school) + ' 탈출';
    $('titleStory').textContent =
      '할로윈 밤, ' + (settings.teacher ? settings.teacher + ' 선생님 반(' + settings.myClass + ')' : settings.myClass) + ' 교실에서 깜빡 잠들었다 깨어 보니 학교 문이 모두 잠겼어요! 장난꾸러기 유령 ‘부’가 방마다 수수께끼와 숫자를 숨겨 두었대요. ' +
      '손전등을 든 경비 아저씨를 피해 복도를 몰래 지나고, 숫자를 모아 중앙 현관 자물쇠를 열어요.';
    const saved = loadSave();
    const rb = $('resumeBtn');
    rb.hidden = !saved;
    if (saved) {
      const s = ROUTE[saved.stage];
      const label = s.kind === 'hall' ? '복도' : s.kind === 'exit' ? E.EXIT.place : E.STEPS.find((x) => x.id === s.id).place || E.normalizeSettings(saved.settings).myClass;
      rb.textContent = '이어서 하기 (' + saved.team + ' · ' + label + ')';
    }
  }

  function goTitle() {
    closePanel();
    HG.sound.stopMusic();
    game.mode = 'title';
    setHud(false);
    paintTitle();
    loadTitleScene();
    showOverlay('titleScreen');
  }

  function begin(team, seed, from) {
    game.team = team;
    game.seed = seed;
    game.run = E.createRun(seed, settings);
    game.mode = 'play';
    $('hudTeam').textContent = team;
    HG.sound.play('start');
    if (from) {
      game.startedAt = from.startedAt;
      game.penalty = from.penalty;
      game.hints = from.hints;
      game.caught = from.caught;
      enterStage(from.stage);
      return;
    }
    game.startedAt = Date.now();
    game.penalty = 0;
    game.hints = 0;
    game.caught = 0;
    game.stage = 0;
    enterStage(0);
    showMap(
      '탈출 경로',
      settings.myClass + ' 교실에서 시작해 ' + where(E.EXIT.place) + '으로 탈출해요. 대피 안내도의 빨간 화살표를 따라가요!',
      '교실에서 깨어나기',
      () => say('여기는 ' + game.run.myClass + ' 교실… 문이 잠겼어! 칠판에 뭔가 쓰여 있어. 가까이 가서 눌러 봐.', 6000)
    );
  }

  $('teamForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const team = $('teamInput').value.trim() || '1모둠';
    HG.store.set('escape:team', team);
    blurActive();
    const seed = settings.seed || (Math.random() * 1e9) | 0;
    playOpening(E.createRun(seed, settings), () => begin(team, seed));
  });
  $('resumeBtn').addEventListener('click', () => {
    const s = loadSave();
    if (!s) return goTitle();
    settings = E.normalizeSettings(s.settings);
    blurActive();
    begin(s.team, s.seed, s);
  });

  /* ---------------- 장면 바꾸기 ---------------- */
  function setLevel(L) {
    if (level) level.dispose();
    level = L;
    level.scene.add(camera);
    player.x = L.spawn.x;
    player.y = 0;
    player.z = L.spawn.z;
    player.yaw = L.spawn.yaw;
    player.pitch = L.spawn.pitch || 0;
  }

  function setHud(on) {
    $('hud').hidden = !on;
    $('mapBtn').hidden = !on;
    $('crosshair').hidden = !on;
    $('joy').hidden = !on || !touchUI;
    $('keysHint').hidden = !on || touchUI;
    if (!on) {
      $('roomCard').hidden = true;
      $('minimap').hidden = true;
      $('actBtn').hidden = true;
      $('peek').hidden = true;
      $('peekLabel').hidden = true;
      $('danger').hidden = true;
      $('prompt').hidden = true;
      $('bubble').hidden = true;
      $('guardTalk').hidden = true;
    }
  }

  function enterStage(i) {
    closePanel();
    waitUntil = 0;
    game.stage = i;
    game.solved = false;
    game.roomHints = 0;
    save();
    const s = ROUTE[i];
    setHud(true);
    $('peek').hidden = true;
    $('peekLabel').hidden = true;
    $('danger').hidden = true;
    $('guardTalk').hidden = true;
    $('bubble').hidden = true;
    clearTimeout(bubbleTimer);
    if (st && st.destroy) st.destroy();
    if (s.kind === 'hall') return startHall(E.HALLS.find((d) => d.id === s.id));
    if (s.kind === 'exit') return startExit();
    startRoom(s.id);
  }
  function nextStage() {
    enterStage(game.stage + 1);
  }

  /* ---------------- 조작 ---------------- */
  const keys = new Set();
  const input = { joy: null, hide: false };
  let touchUI = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  function releaseInput() {
    keys.clear();
    input.joy = null;
    $('joyBase').hidden = true;
    drag = null;
  }
  function readMove() {
    let f = 0;
    let s = 0;
    let run = false;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyA')) s -= 1;
    if (keys.has('KeyD')) s += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) run = true;
    if (input.joy) {
      f -= input.joy.y;
      s += input.joy.x;
      if (input.joy.mag > 0.88) run = true;
    }
    const len = Math.hypot(f, s);
    if (len > 1) {
      f /= len;
      s /= len;
    }
    return { f, s, run: run && len > 0.2 };
  }
  function look(dx, dy) {
    player.yaw -= dx;
    player.pitch = Math.max(-1.25, Math.min(1.1, player.pitch - dy));
  }
  const canControl = () => game.mode === 'play' && !game.paused && !panelOpen() && level && level.kind !== 'outside';

  window.addEventListener('keydown', (e) => {
    if (HG.isTyping(e)) return;
    if (op.on && ['Escape', 'Enter', 'NumpadEnter', 'Space'].indexOf(e.code) >= 0) {
      e.preventDefault();
      opFinish();
      return;
    }
    if (e.code === 'KeyM') {
      HG.sound.toggle();
      return;
    }
    if (e.code === 'Escape') {
      if (panelOpen()) closePanel();
      else if (shown('noteScreen')) $('noteClose').click();
      else if (shown('boardScreen')) $('boardClose').click();
      else if (shown('teacherScreen')) $('tClose').click();
      else if (shown('mapScreen') && !mapDone) $('mapGo').click();
      return;
    }
    if (panelOpen() && activePad) {
      const d = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (d) {
        activePad.press(d[1]);
        e.preventDefault();
      } else if (e.code === 'Backspace') {
        activePad.back();
        e.preventDefault();
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        activePad.enter();
        e.preventDefault();
      }
      return;
    }
    if (!canControl()) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    keys.add(e.code);
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if ((e.code === 'KeyE' || e.code === 'Space' || (e.code === 'Enter' && !onButton)) && !e.repeat) action();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', releaseInput);

  // 화면 끌어서 둘러보기, 짧게 누르면 살펴보기
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !touchUI) {
      touchUI = true;
      if (game.mode === 'play') setHud(true);
    }
    if (!canControl() || drag) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 포인터 고정이 안 되는 브라우저도 있어요 */
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, type: e.pointerType };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (!canControl()) return;
    const k = (drag.type === 'mouse' ? 0.0042 : 0.0068) * (900 / Math.max(500, stage.clientWidth)) ** 0.3;
    look(dx * k, dy * k);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = drag.moved < 12 && performance.now() - drag.t < 500;
    drag = null;
    if (tap && canControl()) tapAt(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => (drag = null));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // 왼쪽 아래 조이스틱 (터치)
  const joy = $('joy');
  const joyBase = $('joyBase');
  const joyKnob = $('joyKnob');
  let joyPtr = null;
  joy.addEventListener('pointerdown', (e) => {
    if (!canControl()) return;
    e.preventDefault();
    try {
      joy.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 그대로 */
    }
    const r = joy.getBoundingClientRect();
    joyPtr = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
    joyBase.style.left = e.clientX - r.left + 'px';
    joyBase.style.top = e.clientY - r.top + 'px';
    joyBase.hidden = false;
    $('joyTip').hidden = true;
    input.joy = { x: 0, y: 0, mag: 0 };
  });
  joy.addEventListener('pointermove', (e) => {
    if (!joyPtr || e.pointerId !== joyPtr.id) return;
    const R0 = joyBase.offsetWidth / 2 || 50;
    let dx = (e.clientX - joyPtr.cx) / R0;
    let dy = (e.clientY - joyPtr.cy) / R0;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    input.joy = { x: dx, y: dy, mag: Math.min(1, mag) };
    joyKnob.style.transform = `translate(${dx * R0}px, ${dy * R0}px)`;
    joyBase.classList.toggle('run', mag > 0.88);
  });
  const joyEnd = (e) => {
    if (!joyPtr || e.pointerId !== joyPtr.id) return;
    joyPtr = null;
    input.joy = null;
    joyBase.hidden = true;
    joyKnob.style.transform = '';
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  // 숨기 버튼 (복도)
  $('actBtn').addEventListener('click', () => {
    $('actBtn').blur();
    if (canControl()) action();
  });

  /* ---------------- 가리키기 (raycast) ---------------- */
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  function pickAt(nx, ny) {
    if (!level) return null;
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    ray.far = 14;
    const hits = ray.intersectObject(level.scene, true);
    for (const h of hits) {
      const o = h.object;
      const info = o.userData.info;
      if (info) return { info, dist: h.distance, obj: o };
      if (!o.visible || o.isSprite || o.isPoints || o.isLine) continue;
      if (o.material && (o.material.transparent || o.material.visible === false)) continue;
      return null; // 벽이나 가구가 가려요
    }
    return null;
  }
  function tapAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const hit = pickAt(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    if (hit) use(hit);
  }
  function use(hit) {
    const reach = hit.info.reach || 2.6;
    if (hit.dist > reach) {
      say('조금 더 가까이 가서 눌러 봐!', 1800);
      return;
    }
    if (st && st.interact) st.interact(hit.info, hit);
  }
  /** E / Space / 숨기 버튼 */
  function action() {
    if (st && st.kind === 'hall') {
      input.hide = true;
      return;
    }
    const hit = pickAt(0, 0);
    if (hit) use(hit);
  }
  let hoverT = 0;
  function updateHover(dt) {
    hoverT -= dt;
    if (hoverT > 0) return;
    hoverT = 0.12;
    const p = $('prompt');
    const c = $('crosshair');
    if (!canControl() || !st || st.kind === 'hall') {
      p.hidden = true;
      c.classList.remove('hot');
      return;
    }
    const hit = pickAt(0, 0);
    const ok = hit && hit.dist <= (hit.info.reach || 2.6) && !hit.info.quiet;
    p.hidden = !ok;
    c.classList.toggle('hot', !!(hit && hit.dist <= (hit.info.reach || 2.6)));
    if (ok) p.textContent = hit.info.label + (touchUI ? '' : '  (클릭 · E)');
  }

  /* ---------------- 걷기 (방 안) ---------------- */
  function blocked(x, z) {
    const r = 0.27;
    return level.colliders.some((c) => x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1);
  }
  function walkRoom(dt) {
    const m = readMove();
    const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    player.yaw += turn * 2.3 * dt;
    const speed = m.run ? 3.3 : 2.0;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const vx = (-sin * m.f + cos * m.s) * speed;
    const vz = (-cos * m.f - sin * m.s) * speed;
    const b = level.bounds;
    const nx = Math.max(b.x0, Math.min(b.x1, player.x + vx * dt));
    if (!blocked(nx, player.z)) player.x = nx;
    const nz = Math.max(b.z0, Math.min(b.z1, player.z + vz * dt));
    if (!blocked(player.x, nz)) player.z = nz;
    player.moving = Math.abs(m.f) + Math.abs(m.s) > 0.05;
    player.running = player.moving && m.run;
    footsteps(dt, 0.06);
    // 열린 문으로 걸어 들어가도 나가요
    if (game.solved && level.exitOpen && level.exitAt && !level.leaving && Math.abs(player.x - level.exitAt.x) < 0.55 && player.z < 0.5) {
      level.leaving = true;
      if (st.onExit) st.onExit();
      else leaveRoom();
    }
  }
  function footsteps(dt, quiet) {
    if (!player.moving) {
      player.stepT = 0.15;
      return;
    }
    player.bob += dt * (player.running ? 13 : 8.5);
    player.stepT -= dt;
    if (player.stepT <= 0) {
      player.stepT = player.running ? 0.3 : 0.46;
      HG.sound.play('step', { vol: player.running ? 0.9 : quiet });
    }
  }

  function placeCamera() {
    const bob = player.moving ? Math.sin(player.bob) * (player.running ? 0.05 : 0.025) : 0;
    camera.position.set(player.x, W3.EYE + bob + (player.y || 0), player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  /* ---------------- 방 공통 ---------------- */
  const HINTS_PER_ROOM = 2;
  function paintHintBtn() {
    const b = $('hintBtn');
    const can = st && st.hint && !game.solved;
    const left = HINTS_PER_ROOM - game.roomHints;
    b.hidden = !can && !(st && st.kind === 'room');
    b.disabled = !can || left <= 0;
    b.textContent = left > 0 ? '💡 힌트 +30초 (' + left + ')' : '💡 힌트 없음';
    if (st && st.kind === 'hall') b.hidden = true;
  }
  $('hintBtn').addEventListener('click', () => {
    $('hintBtn').blur();
    if (!st || !st.hint || game.solved || game.roomHints >= HINTS_PER_ROOM || game.mode !== 'play') return;
    game.roomHints++;
    game.hints++;
    game.penalty += E.HINT_PENALTY;
    save();
    HG.sound.play('boo');
    say(st.hint(game.roomHints), 9000);
    paintHintBtn();
  });

  function roomCard(whereText, title, goal) {
    $('roomWhere').textContent = whereText;
    $('roomTitle').textContent = title;
    $('roomGoal').textContent = goal;
    $('roomCard').hidden = false;
    $('minimap').hidden = true;
    $('actBtn').hidden = true;
  }

  function startRoom(id) {
    const step = game.run.steps.find((s) => s.id === id);
    setLevel(R[id](game.run));
    st = Object.assign({ kind: 'room', id, step }, ROOMS[id](step));
    roomCard(where(step.place), step.icon + ' ' + step.title, step.goal);
    $('hudPlace').textContent = step.place;
    HG.sound.music(SONG);
    HG.sound.play('creak');
    paintHintBtn();
  }

  /** 방 수수께끼를 풀었어요: 숫자 카드 → 문이 열려요 */
  function solved() {
    if (game.solved) return;
    game.solved = true;
    closePanel();
    paintHintBtn();
    HG.sound.play('clear');
    const step = st.step;
    const digit = game.run.digits[step.id];
    setTimeout(() => {
      $('rewardTitle').textContent = step.place + ' 통과!';
      $('rewardDigit').textContent = String(digit);
      $('rewardNote').textContent = '📒 숫자 수첩의 ' + step.icon + ' 칸에 적어 두었어요. 이제 문으로 나가요!';
      showOverlay('rewardScreen');
      $('rewardNext').focus();
    }, 700);
  }
  $('rewardNext').addEventListener('click', () => {
    showOverlay(null);
    blurActive();
    if (level && level.openExit) {
      level.openExit();
      HG.sound.play('unlock');
      say('문이 열렸어! 반짝이는 문으로 나가자.', 4000);
    }
  });
  function leaveRoom() {
    if (!game.solved) {
      say('문이 잠겨 있어! 이 방의 수수께끼를 먼저 풀어야 해.', 3000);
      HG.sound.play('wrong');
      return;
    }
    HG.sound.play('creak');
    if (ROUTE[game.stage].id === 'classroom') return startFirstHall();
    nextStage();
  }

  /** 6-3 교실을 나와 신관 2층 복도로: 교실 앞 신발장을 지나 바로 옆 계단으로 1층 현관까지 */
  function startFirstHall() {
    closePanel();
    game.stage = 1; // 이어서 하면 신관 3층 복도부터
    save();
    startHall(E.FIRST_HALL, { next: '신관 1층 현관', onGoal: startLobby });
  }

  /* ---------------- 신관 1층 현관: 잠겼어요! (화이트데이처럼 돌아서 가야 해요) ----------------
     교실을 나와 1층 현관으로 내려왔지만 쇠사슬과 셔터로 막혀 있어요.
     유령 부가 나타나 3층 연결통로로 본관에 건너가라고 알려 줘요. */
  function startLobby() {
    closePanel();
    ['peek', 'peekLabel', 'danger', 'guardTalk'].forEach((id) => ($(id).hidden = true));
    setLevel(R.lobby(game.run));
    let tried = 0;
    st = {
      kind: 'lobby',
      onExit: () => st.interact({ action: 'exit' }),
      interact(info) {
        if (info.action === 'blocked') {
          tried++;
          level.rattle();
          HG.sound.play('clang');
          if (tried === 1) {
            say('덜컹덜컹! 쇠사슬로 꽁꽁 잠겼어… 밖에는 셔터까지 내려와 있어!', 3200);
            setTimeout(() => {
              if (!st || st.kind !== 'lobby') return;
              level.showGhost();
              HG.sound.play('boo');
              say('히히! 신관 현관은 내가 잠가 버렸지! 진짜 출구는 본관 1층 중앙 현관이야. 3층 연결통로로 본관에 건너가 봐!', 7500);
              level.openExit();
              $('roomGoal').textContent = '신관 현관은 막혔어요! 계단으로 3층까지 올라가 연결통로로 본관에 건너가요.';
            }, 2600);
          } else say('꿈쩍도 안 해… 계단으로 올라가서 본관으로 가자!', 2600);
        } else if (info.action === 'note') {
          openPanel('유령 부의 쪽지', (b) => {
            b.append(el('p', 'q', '“신관 현관은 내가 잠갔지롱! 진짜 출구는 본관 중앙 현관 👻”'));
            b.append(el('p', 'step', '대피 안내도를 보면 신관과 본관은 3층 연결통로로 이어져 있어요.'));
          });
        } else if (info.action === 'exit') {
          if (!level.exitOpen) return say('먼저 현관문을 열어 볼까?', 2500);
          HG.sound.play('creak');
          enterStage(1);
        }
      },
    };
    roomCard('신관 1층 현관', '🚪 잠긴 신관 현관', '교실을 빠져나와 계단으로 1층까지 내려왔어요. 현관문으로 나가 볼까요?');
    $('hudPlace').textContent = '신관 1층 현관';
    HG.sound.stopMusic();
    paintHintBtn();
    say('드디어 1층 현관이야! 이제 나가기만 하면 돼…', 4000);
  }

  /* ---------------- 오프닝 (화이트데이처럼) ----------------
     밤의 학교 → 교문이 철컹 닫혀요 → 복도 끝에서 경비 아저씨가 다가와요 → 제목.
     만든이(담임 선생님)와 출연(우리 반 친구들)은 선생님 설정(링크)에서 와요. 건너뛰기·Enter·Esc 로 넘어가요. */
  const op = { on: false, t: 0, plan: [], i: 0, end: 0, cam: null, shotAt: 0, shake: 0, done: null, hall: null, speed: 1 };
  function opCaption(text) {
    const c = $('opCaption');
    if (text) c.textContent = text;
    c.classList.toggle('on', !!text);
  }
  function opCredit(role, who, names) {
    const c = $('opCredit');
    if (!role) return c.classList.remove('on');
    c.textContent = '';
    c.append(el('p', 'role', role));
    if (who) c.append(el('p', 'who', who));
    if (names && names.length) {
      const g = el('div', 'names');
      names.forEach((n, i) => {
        const sp = el('span', null, n);
        sp.style.animationDelay = 0.4 + i * 0.12 + 's';
        g.append(sp);
      });
      c.append(g);
    }
    c.classList.add('on');
  }
  const opFade = (black) => ($('opFade').style.opacity = black ? '1' : '0');
  const ease = (k) => {
    const v = Math.max(0, Math.min(1, k));
    return v * v * (3 - 2 * v);
  };
  /** 운동장: 교문을 지나 학교로 걸어가다가… 철컹! 뒤돌아봐요 */
  function opYard(run) {
    setLevel(R.outside(run, { opening: true }));
    op.hall = null;
    op.shotAt = op.t;
    op.cam = (t) => {
      player.x = Math.sin(t * 0.5) * 0.12;
      player.y = Math.abs(Math.sin(t * 3.2)) * 0.03 * (t < 6 ? 1 : 0);
      player.z = -27 + ease(t / 6.2) * 15.5;
      player.yaw = Math.PI + ease((t - 6.9) / 1.3) * Math.PI;
      player.pitch = 0.12 - ease((t - 6.9) / 1.3) * 0.1;
    };
  }
  /** 복도: 캄캄한 복도 끝에서 손전등을 든 경비 아저씨가 다가와요 */
  function opHall(run) {
    const h = E.createHall(E.HALLS[0], 77);
    h.player.hidden = 0; // 경비원에게 안 들켜요 (화면만)
    const g = h.guard;
    g.turn = 0;
    g.checkChance = 0;
    g.min = 6;
    g.x = 25;
    g.face = -1;
    g.ang = Math.PI;
    setLevel(W3.buildHall(h, run));
    op.hall = h;
    op.shotAt = op.t;
    op.cam = (t) => {
      player.x = 3 + t * 0.12;
      player.y = -0.35;
      player.z = -0.25;
      player.yaw = -Math.PI / 2 + Math.sin(t * 0.3) * 0.05;
      player.pitch = 0.04;
    };
  }
  function playOpening(run, done) {
    closePanel();
    showOverlay(null);
    setHud(false);
    game.mode = 'opening';
    st = { kind: 'opening' };
    Object.assign(op, { on: true, t: 0, i: 0, cam: null, shake: 0, done, hall: null });
    $('opening').hidden = false;
    $('opTitle').hidden = true;
    opFade(true);
    opCaption('');
    opCredit(null);
    HG.sound.stopMusic();
    const friends = run.friends || [];
    const maker = run.teacher || run.myClass + ' 담임 선생님';
    $('opTitleName').textContent = shortName(settings.school) + ' 탈출';
    $('opMotto').textContent = run.motto ? '“' + run.motto + '”  ·  ' + run.myClass : run.school + ' ' + run.myClass;
    const plan = [
      [0.4, () => (opCaption('10월 31일, 할로윈 밤'), HG.sound.play('tick'))],
      [2.4, () => opCaption('')],
      [2.8, () => (opYard(run), opFade(false), HG.sound.music(SONG))],
      [3.6, () => opCredit('만든이', maker)],
      [7.4, () => opCredit(null)],
      [9.0, () => (level.closeGate && level.closeGate(), HG.sound.play('clang'), (op.shake = 0.7), opCaption('철컹—!'))],
      [10.6, () => opCaption('…교문이 닫혔다.')],
      [12.4, () => (opFade(true), opCaption(''))],
      [13.4, () => (opHall(run), opFade(false))],
      [14.0, () => opCredit('출연', run.myClass + ' 친구들', friends.length ? friends : ['우리 반 친구 모두'])],
      [19.6, () => opCredit(null)],
      [20.4, () => (run.noisy && run.noisy.length ? opCredit('특별 출연 (칠판에 이름 적힌 사람)', run.noisy.join('  ·  ')) : opCredit('특별 출연', '경비 아저씨  ·  유령 부'))],
      [23.4, () => (opCredit(null), HG.sound.play('heart'))],
      [24.2, () => (opFade(true), HG.sound.stopMusic())],
      [25.2, () => (($('opTitle').hidden = false), HG.sound.play('boo'))],
      [29.4, () => ($('opTitle').hidden = true)],
      [29.9, () => opCaption('…깜빡 잠들었다 깨어 보니, 교실에는 아무도 없었다.')],
    ];
    op.plan = plan;
    op.end = 33;
  }
  function opUpdate(rawDt) {
    const dt = rawDt * op.speed; // 자동 검사에서 멈춰 놓고 화면을 찍을 때 0
    op.t += dt;
    while (op.i < op.plan.length && op.plan[op.i][0] <= op.t) op.plan[op.i++][1]();
    if (op.hall) {
      E.stepHall(op.hall, {}, dt);
      op.hall.events.length = 0;
      level.guard.sync(op.hall.guard, dt, game.t);
    }
    if (op.cam) op.cam(op.t - op.shotAt);
    if (op.shake > 0) {
      op.shake = Math.max(0, op.shake - dt);
      player.yaw += (Math.random() - 0.5) * op.shake * 0.1;
      player.pitch += (Math.random() - 0.5) * op.shake * 0.07;
    }
    player.moving = false;
    if (op.t >= op.end) opFinish();
  }
  function opFinish() {
    if (!op.on) return;
    op.on = false;
    op.cam = null;
    op.hall = null;
    $('opening').hidden = true;
    $('opTitle').hidden = true;
    opCaption('');
    opCredit(null);
    HG.sound.stopMusic();
    const d = op.done;
    op.done = null;
    if (d) d();
  }
  $('opSkip').addEventListener('click', () => {
    $('opSkip').blur();
    opFinish();
  });

  /* ================ 방마다 수수께끼 ================ */
  const ROOMS = {};

  const teacherOf = () => (game.run && game.run.teacher ? game.run.teacher + ' 선생님' : '선생님');

  /* ---------- 1. 교실: 칠판의 수수께끼 ---------- */
  ROOMS.classroom = function () {
    const pz = game.run.puzzles.classroom;
    const parts = E.COUNT_FORMS[pz.form].parts;
    const formula = parts.join(' ') + ' = ?';
    const showBoard = () =>
      openPanel('칠판의 수수께끼', (b) => {
        b.append(el('p', 'formula', formula));
        b.append(el('p', 'q', '교실 곳곳에 숨어 있는 호박🎃 · 박쥐🦇 · 거미🕷️ 를 모두 세어 식을 풀어요. (칠판 그림은 빼고!)'));
        b.append(el('p', 'step', '찾은 것을 누르면 민트색 표시가 생겨요. 같은 것을 두 번 세지 않게 표시해 두세요. 숫자는 직접 세어야 해요!'));
        b.append(el('p', 'step', '답은 ' + teacherOf() + ' 책상 서랍의 비밀번호예요.'));
        // 칠판 「떠든 사람」에 이름이 있으면 유령이 놀려요
        const noisy = game.run.noisy || [];
        if (noisy.length && !boardSeen) say('어? 칠판 「떠든 사람」에 ' + noisy[0] + ' 이름이 있네? 히히, 쉿! 조용히 탈출하자.', 5000);
        boardSeen = true;
      });
    let boardSeen = false;
    return {
      interact(info) {
        if (info.action === 'item') {
          level.setMarked(info.item, !info.item.marked);
          HG.sound.play(info.item.marked ? 'candy' : 'click');
        } else if (info.action === 'board') showBoard();
        else if (info.action === 'drawer') {
          if (game.solved) return say('서랍은 이미 열렸어!', 2000);
          openPanel(teacherOf() + ' 책상 서랍', (b) => {
            b.append(el('p', 'formula', formula));
            b.append(el('p', 'step', '두 자리 비밀번호를 눌러요'));
            keypad(b, {
              len: 2,
              onEnter(v) {
                if (Number(v) !== pz.answer) {
                  say('삐빅! 틀렸어. 다시 세어 볼까? 책상 밑, 사물함 위, 천장도 살펴봐.', 4000);
                  return false;
                }
                level.openDrawer();
                HG.sound.play('unlock');
                say('찰칵! 서랍 안에 뒷문 열쇠와 숫자 카드가 있어!', 4000);
                setTimeout(solved, 500);
                return true;
              },
            });
          });
        } else if (info.action === 'lockedDoor') say('앞문은 꽉 잠겼어. 열쇠는 선생님 책상 서랍에 있을 거야!', 3000);
        else if (info.action === 'exit') leaveRoom();
      },
      hint(n) {
        if (n === 1) return '책상 밑, 의자 위, 사물함 위, 창틀, 커튼 뒤, 쓰레기통 안, TV, 시계 근처도 봐! 박쥐는 높은 곳과 창문에, 거미는 벽과 구석에 많아.';
        return '호박🎃은 모두 ' + pz.counts.pumpkin + '개야! 박쥐와 거미는 직접 세어 봐.';
      },
    };
  };

  /* ---------- 2. 과학실: 마녀의 물약 ---------- */
  ROOMS.science = function () {
    const recipes = game.run.puzzles.science.recipes;
    let k = 0;
    let amounts = { 빨강: 0, 파랑: 0, 노랑: 0 };
    function potionPanel() {
      const rc = recipes[k];
      openPanel('마녀의 물약 ' + (k + 1) + ' / ' + recipes.length, (b) => {
        const p = el('p', 'recipe');
        p.append(document.createTextNode('칠판 ' + (k + 1) + '번: '), el('b', null, rc.color + ' 물약'));
        b.append(p);
        rc.lines.forEach((ln) => b.append(el('p', 'q', ln)));
        const grid = el('div', 'beakers');
        const views = {};
        E.POTIONS.forEach((c) => {
          const box = el('div', 'beaker');
          const liquid = el('div', 'liquid');
          liquid.style.setProperty('--c', E.COLORS[c]);
          const ml = el('div', 'ml');
          const steps = el('div', 'steps');
          [-100, -10, 10, 100].forEach((d) => {
            const btn = el('button', null, (d > 0 ? '+' : '−') + Math.abs(d));
            btn.addEventListener('click', () => {
              amounts[c] = Math.max(0, Math.min(600, amounts[c] + d));
              HG.sound.play('tick');
              paint();
            });
            steps.append(btn);
          });
          box.append(el('div', 'name', c), liquid, ml, steps);
          grid.append(box);
          views[c] = { liquid, ml };
        });
        function paint() {
          E.POTIONS.forEach((c) => {
            views[c].ml.textContent = amounts[c] + 'mL';
            views[c].liquid.style.setProperty('--f', Math.round((amounts[c] / 600) * 100) + '%');
          });
        }
        paint();
        const row = el('div', 'prow');
        const empty = el('button', 'btn btn-quiet', '비우기');
        empty.addEventListener('click', () => {
          amounts = { 빨강: 0, 파랑: 0, 노랑: 0 };
          paint();
        });
        const pour = el('button', 'btn', '🫕 솥에 붓기');
        pour.addEventListener('click', () => {
          if (mustWait()) return;
          const res = E.potionResult(rc, amounts);
          amounts = { 빨강: 0, 파랑: 0, 노랑: 0 };
          if (res === rc.color) {
            level.setCauldron(E.COLORS[rc.color]);
            HG.sound.play('gold');
            k++;
            if (k >= recipes.length) {
              say('물약 세 가지 완성! 솥에서 숫자 카드가 둥실 떠올랐어!', 4000);
              setTimeout(solved, 400);
              return;
            }
            say(rc.color + ' 물약 성공! 이번엔 ' + recipes[k].color + ' 물약이야.', 3500);
            potionPanel();
          } else {
            wrongWait();
            level.setCauldron(res === 'almost' ? '#8fa38f' : E.COLORS['탁함']);
            level.puff();
            HG.sound.play('wrong');
            say(res === 'almost' ? '색은 비슷한데 양이 틀렸어! 비율을 다시 계산해 봐.' : '퍼엉! 탁한 물약이 됐어. 어떤 색을 섞어야 할까?', 3800);
            paint();
            shake(grid);
          }
        });
        row.append(empty, pour);
        b.append(grid, row, el('p', 'step', '눈금은 10mL씩 · 전체 양도 맞아야 해요'));
      });
    }
    return {
      interact(info) {
        if (info.action === 'cauldron') {
          if (game.solved) return say('물약은 다 만들었어!', 2000);
          potionPanel();
        } else if (info.action === 'board')
          openPanel('칠판: 마녀의 물약 만들기', (b) => {
            recipes.forEach((rc, i) =>
              b.append(el('p', 'q', i + 1 + '. ' + rc.color + ' 물약 — ' + rc.lines.join(' · ') + (i < k ? '  ✓' : '')))
            );
            b.append(el('p', 'step', '솥을 누르면 물약을 부을 수 있어요'));
          });
        else if (info.action === 'lockedDoor') say('앞문은 잠겼어. 물약을 다 만들면 뒷문이 열릴 거야!', 3000);
        else if (info.action === 'exit') leaveRoom();
      },
      hint(n) {
        const rc = recipes[Math.min(k, recipes.length - 1)];
        if (n === 1) return '먼저 나눗셈으로 첫 물약 양을 구해! 소수는 소수점을 같이 옮기고, 분수는 나누는 수를 뒤집어 곱해. 그다음 「○○에 대한 비율」은 기준량(○○) × 비율이야. 예: 200의 50% → 100, 10% → 20, 100% → 200!';
        return '지금 ' + rc.color + ' 물약은 ' + rc.parts.map((c, i) => c + ' ' + rc.amounts[i] + 'mL').join(', ') + '!';
      },
    };
  };

  /* ---------- 3. 도서관: 속담 책장 ---------- */
  const BOOK_ZONE = ['왼쪽 벽 책장', '왼쪽 벽 책장', '왼쪽 벽 책장', '가운데 책장 앞쪽', '가운데 책장 앞쪽', '가운데 책장', '가운데 책장', '가운데 책장 안쪽', '가운데 책장 안쪽', '창가 낮은 책장', '창가 낮은 책장', '오른쪽 벽 책장'];
  ROOMS.library = function () {
    const lib = game.run.puzzles.library;
    const done = new Set();
    const prefill = {};
    function bookPanel(i) {
      const book = lib.books[i];
      const answer = Array.from(book.blank);
      let picked = (prefill[i] || []).slice();
      openPanel('속담 책 ' + (done.size + 1) + ' / 3', (b) => {
        const line = el('p', 'proverb');
        const blank = el('span', 'blank');
        const tiles = el('div', 'tiles');
        function render() {
          line.textContent = '';
          blank.textContent = '';
          answer.forEach((_, k) => {
            const s = el('span', 'slot' + (picked[k] ? '' : ' empty'), picked[k] ? picked[k].ch : book.cho[k]);
            blank.append(s);
          });
          line.append(document.createTextNode(book.before), blank, document.createTextNode(book.after));
          tiles.textContent = '';
          book.tiles.forEach((ch, idx) => {
            const t = el('button', 'tile', ch);
            t.disabled = picked.some((p) => p.idx === idx);
            t.addEventListener('click', () => pick(ch, idx));
            tiles.append(t);
          });
        }
        function pick(ch, idx) {
          if (mustWait()) return;
          picked.push({ ch, idx });
          HG.sound.play('click');
          render();
          if (picked.length < answer.length) return;
          if (picked.map((p) => p.ch).join('') === book.blank) {
            done.add(i);
            level.bookDone(i);
            HG.sound.play('gold');
            if (done.size === lib.books.length) {
              say('세 권 모두 맞혔어! 책장 뒤에서 숫자 카드가 툭!', 4000);
              setTimeout(solved, 400);
            } else {
              say('딩동댕! 「' + book.before + book.blank + book.after + '」 빛나는 책이 ' + (lib.books.length - done.size) + '권 더 있어.', 4500);
              closePanel();
            }
          } else {
            wrongWait();
            HG.sound.play('wrong');
            shake(line);
            setTimeout(() => {
              picked = (prefill[i] || []).slice();
              render();
            }, 450);
          }
        }
        render();
        const row = el('div', 'prow');
        const undo = el('button', 'btn btn-quiet', '⌫ 한 글자 지우기');
        undo.addEventListener('click', () => {
          if (picked.length > (prefill[i] || []).length) picked.pop();
          render();
        });
        row.append(undo);
        b.append(el('p', 'step', '빈칸의 초성(첫 자음)을 보고 글자 카드를 차례로 눌러요'), line, tiles, row);
      });
    }
    return {
      interact(info) {
        if (info.action === 'book') {
          if (done.has(info.book)) return say('이 책은 이미 풀었어!', 2000);
          bookPanel(info.book);
        } else if (info.action === 'poster') openPanel('책의 주소 (십진분류)', (b) => posterView(b, () => X.kdcPoster()));
        else if (info.action === 'lockedDoor') say('이쪽 문은 잠겼어. 빛나는 책 세 권을 먼저 찾아!', 3000);
        else if (info.action === 'exit') leaveRoom();
      },
      hint(n) {
        const left = lib.books.map((bk, i) => i).filter((i) => !done.has(i));
        if (!left.length) return '이미 다 풀었어!';
        const i = left[0];
        const book = lib.books[i];
        if (n === 1) {
          const zones = Array.from(new Set(left.map((j) => BOOK_ZONE[lib.slots[j]])));
          return '아직 못 찾은 책은 ' + zones.join(', ') + '에 있어. 그리고 이 속담의 뜻: “' + book.mean + '”';
        }
        const first = Array.from(book.blank)[0];
        prefill[i] = [{ ch: first, idx: book.tiles.indexOf(first) }];
        return '「' + book.before + book.cho + book.after + '」의 빈칸 첫 글자는 「' + first + '」야! (책을 열면 채워져 있어)';
      },
    };
  };

  /* ---------- 4. 방송실: 유령의 모스 부호 ---------- */
  ROOMS.broadcast = function () {
    const code = game.run.puzzles.broadcast.code;
    let slow = false;
    let timers = [];
    let playing = false;
    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      playing = false;
      if (level && level.setOnAir) level.setOnAir(false);
    };
    const SYM = { '.': '●', '-': '▬' };
    function play(lamp, tape) {
      stop();
      playing = true;
      const unit = slow ? 0.3 : 0.22;
      let t = 0.5;
      // 받아 적기 종이: 소리가 날 때마다 ● ▬ 가 숫자 칸에 저절로 찍혀요
      if (tape) tape.forEach((cell) => (cell.textContent = ''));
      E.morseTimeline(code, unit).forEach((s) => {
        const on = t;
        timers.push(
          setTimeout(() => {
            level.setOnAir(true);
            if (lamp) lamp.classList.add('on');
            if (tape) {
              tape[s.digit].textContent += SYM[s.sym];
              tape[s.digit].classList.add('now');
            }
            HG.sound.beep(s.on, 760);
          }, on * 1000)
        );
        timers.push(
          setTimeout(() => {
            level.setOnAir(false);
            if (lamp) lamp.classList.remove('on');
            if (tape) tape[s.digit].classList.remove('now');
          }, (on + s.on) * 1000)
        );
        t += s.on + Math.max(s.off, unit);
      });
      timers.push(setTimeout(() => (playing = false), t * 1000));
    }
    /** 패널 안에 작은 모스 부호표 */
    function morseTable() {
      const tb = el('div', 'mtable');
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach((d) => {
        const it = el('div', 'mrow');
        it.append(el('b', null, String(d)), el('span', null, Array.from(E.MORSE[d]).map((c) => SYM[c]).join('')));
        tb.append(it);
      });
      return tb;
    }
    function consolePanel() {
      openPanel('유령 방송 장비', (b) => {
        const lamp = el('div', 'lamp');
        const listen = el('button', 'btn', '▶ 유령 방송 듣기');
        const r1 = el('div', 'prow');
        r1.append(lamp, listen);
        b.append(el('p', 'step', '방송을 들으면 ● (짧게 삐) 와 ▬ (길게 삐—) 가 종이에 저절로 찍혀요. 숫자 4개예요.'), r1);
        const tapeRow = el('div', 'tape');
        const tape = [0, 1, 2, 3].map((i) => {
          const box = el('div', 'tcell');
          const sy = el('div', 'tsym', '');
          box.append(el('span', 'tnum', i + 1 + '번째'), sy);
          tapeRow.append(box);
          return sy;
        });
        listen.addEventListener('click', () => play(lamp, tape));
        b.append(tapeRow, el('p', 'step', '모스 부호표와 똑같은 모양을 찾아요'), morseTable());
        keypad(b, {
          len: 4,
          onEnter(v) {
            if (v !== code) {
              say('지지직… 비밀번호가 틀렸어. 종이에 찍힌 모양을 표와 다시 맞춰 봐!', 3000);
              return false;
            }
            stop();
            say('방송실 금고가 열렸어!', 3000);
            HG.sound.play('unlock');
            setTimeout(solved, 400);
            return true;
          },
        });
      }, stop);
    }
    return {
      interact(info) {
        if (info.action === 'console') {
          if (game.solved) return say('방송은 끝났어!', 2000);
          consolePanel();
        } else if (info.action === 'poster') openPanel('모스 부호표', (b) => posterView(b, () => X.morsePoster(E.MORSE)));
        else if (info.action === 'exit') {
          stop();
          leaveRoom();
        }
      },
      hint(n) {
        if (n === 1) {
          slow = true;
          return '● 로 시작하면 ● 의 개수가 그 숫자야 (●●●▬▬ = 3). ▬ 로 시작하면 ▬ 개수에 5를 더해 (▬▬●●● = 7). ▬▬▬▬▬ 는 0!';
        }
        return '비밀번호 앞의 두 자리는 「' + code.slice(0, 2) + '」야!';
      },
      destroy: stop,
    };
  };

  /* ---------- 5. 교무실: 선생님 자리 ---------- */
  ROOMS.office = function () {
    const office = game.run.puzzles.office;
    const quiz = game.run.puzzles.quiz;
    const seats = [null, null, null, null, null]; // seats[자리] = 선생님 번호
    const fixed = new Set();
    let seatsDone = false;
    let quizK = 0;
    const clueList = () => {
      const ol = el('ol', 'clues');
      office.clues.forEach((c) => ol.append(el('li', null, E.clueText(office, c))));
      return ol;
    };
    function seatPanel() {
      openPanel('선생님 자리 찾기', (b) => {
        let chosen = null;
        const grid = el('div', 'seats');
        const chips = el('div', 'prow');
        function render() {
          grid.textContent = '';
          seats.forEach((t, seat) => {
            const box = el('div', 'seat');
            const btn = el('button', t == null ? 'empty' : '', t == null ? '비어 있음' : office.teachers[t] + (fixed.has(seat) ? ' 🔒' : ''));
            btn.addEventListener('click', () => {
              if (fixed.has(seat)) return;
              if (chosen != null) {
                const old = seats.indexOf(chosen);
                if (old >= 0 && !fixed.has(old)) seats[old] = null;
                seats[seat] = chosen;
                chosen = null;
              } else seats[seat] = null;
              HG.sound.play('tick');
              render();
            });
            box.append(el('span', 'no', seat + 1 + '번 자리'), btn);
            grid.append(box);
          });
          chips.textContent = '';
          office.teachers.forEach((name, t) => {
            const used = seats.indexOf(t) >= 0;
            const c = el('button', 'btn ' + (chosen === t ? '' : 'btn-quiet'), name);
            c.style.fontSize = '0.85em';
            c.style.opacity = used && chosen !== t ? '0.55' : '1';
            c.addEventListener('click', () => {
              chosen = chosen === t ? null : t;
              render();
            });
            chips.append(c);
          });
        }
        render();
        const ok = el('button', 'btn', '확인');
        ok.addEventListener('click', () => {
          if (seats.some((t) => t == null)) {
            say('다섯 자리를 모두 채워야 해!', 2500);
            HG.sound.play('wrong');
            return;
          }
          if (mustWait()) return;
          if (!E.checkSeats(office, seats)) {
            wrongWait();
            say('음… 단서와 맞지 않는 자리가 있어. 하나씩 다시 확인해 봐!', 3500);
            HG.sound.play('wrong');
            shake(grid);
            return;
          }
          seatsDone = true;
          level.setNames(seats.map((t) => office.teachers[t]));
          HG.sound.play('gold');
          if (quiz.length) {
            say('맞았어! 그런데 교무실 컴퓨터에 선생님이 낸 문제가 떠 있어!', 4000);
            quizPanel();
          } else {
            say('딩동댕! ' + (game.run.teacher ? game.run.teacher + ' 선생님' : game.run.myClass + ' 담임 선생님') + ' 서랍에서 숫자 카드가 나왔어!', 4000);
            setTimeout(solved, 400);
          }
        });
        b.append(el('p', 'step', '① 아래에서 선생님 이름을 누르고 ② 앉을 자리를 눌러요 (문에서 볼 때 왼쪽이 1번)'), grid, chips, clueList(), ok);
      });
    }
    function quizPanel() {
      openPanel('교무실 컴퓨터 · 선생님 문제 ' + (quizK + 1) + ' / ' + quiz.length, (b) => {
        const q = quiz[quizK];
        b.append(el('p', 'q', q.q));
        const row = el('form', 'answer-row');
        const inputEl = el('input');
        inputEl.maxLength = 40;
        inputEl.placeholder = '답을 써요';
        inputEl.setAttribute('aria-label', '답');
        const ok = el('button', 'btn', '확인');
        ok.type = 'submit';
        row.append(inputEl, ok);
        row.addEventListener('submit', (e) => {
          e.preventDefault();
          if (mustWait()) return;
          if (!E.checkAnswer(inputEl.value, q.a)) {
            wrongWait();
            HG.sound.play('wrong');
            shake(row);
            say('땡! 다시 생각해 봐.', 2000);
            return;
          }
          HG.sound.play('candy');
          quizK++;
          if (quizK >= quiz.length) {
            say('컴퓨터 잠금이 풀렸어! 화면에 숫자가 떴어!', 3500);
            setTimeout(solved, 400);
          } else quizPanel();
        });
        b.append(row);
        setTimeout(() => inputEl.focus(), 50);
      });
    }
    return {
      interact(info) {
        if (info.action === 'clues') openPanel('화이트보드 단서', (b) => b.append(el('p', 'step', '선생님 자리 (문에서 볼 때 왼쪽부터 1~5번)'), clueList()));
        else if (info.action === 'seats') {
          if (game.solved) return say('자리를 다 찾았어!', 2000);
          if (seatsDone) quizPanel();
          else seatPanel();
        } else if (info.action === 'lockedDoor') say('뒷문은 잠겼어. 들어온 문으로 나가야 해.', 3000);
        else if (info.action === 'exit') leaveRoom();
      },
      hint(n) {
        if (seatsDone) return quiz.length ? '선생님 문제는 우리 학교 이야기야. 모둠 친구들과 의논해 봐!' : '이미 다 풀었어!';
        const order = [0, 1, 2, 3, 4].filter((t) => !fixed.has(office.solution[t]));
        const give = order.slice(0, n === 1 ? 1 : 2);
        give.forEach((t) => {
          const seat = office.solution[t];
          const other = seats.indexOf(t);
          if (other >= 0) seats[other] = null;
          seats[seat] = t;
          fixed.add(seat);
        });
        return give.map((t) => office.teachers[t] + ' 선생님은 ' + (office.solution[t] + 1) + '번 자리').join(', ') + '! (자리판에 🔒로 채워 뒀어)';
      },
    };
  };

  /* ---------- 6. 보건실: 처방전 쪽지 ---------- */
  const NOTE_ZONE = ['첫 번째 침대 베개 옆', '곰 인형이 있는 침대 이불 위', '보건 선생님 책상', '체중계 위', '시력표 아래', '세면대', '약장 꼭대기', '두 침대 사이 바닥'];
  ROOMS.nurse = function () {
    const nurse = game.run.puzzles.nurse;
    const found = new Set();
    const noteText = (i) => nurse.notes[i].join(' ');
    function cabinetPanel() {
      openPanel('보건실 약장', (b) => {
        b.append(el('p', 'step', '찾은 처방전 ' + found.size + ' / 4'));
        const list = el('div', 'notes');
        nurse.notes.forEach((_, i) => list.append(el('p', found.has(i) ? '' : 'missing', found.has(i) ? '처방전 ' + (i + 1) + ': ' + noteText(i) : '처방전 ' + (i + 1) + ': ???')));
        b.append(list);
        if (!found.has(3)) {
          b.append(el('p', 'q', '약장 비밀번호 식이 적힌 처방전 4를 찾아야 해요!'));
          return;
        }
        b.append(el('p', 'step', '곱셈·나눗셈, 괄호를 먼저 계산해요'));
        keypad(b, {
          len: 3,
          onEnter(v) {
            if (Number(v) !== nurse.answer) {
              say('땡! 그림 하나하나가 얼마인지 먼저 구해 봐.', 3000);
              return false;
            }
            level.openCabinet();
            HG.sound.play('unlock');
            say('철컥! 약장이 열렸어. 반창고 상자에 숫자 카드가!', 3500);
            setTimeout(solved, 400);
            return true;
          },
        });
      });
    }
    return {
      interact(info) {
        if (info.action === 'note') {
          const i = info.note;
          found.add(i);
          level.noteFound(i);
          HG.sound.play('candy');
          openPanel('처방전 ' + (i + 1), (b) => {
            b.append(el('p', 'formula', noteText(i)));
            b.append(el('p', 'step', '수첩에 적었어요 · 찾은 쪽지 ' + found.size + ' / 4 (약장에서 다시 볼 수 있어요)'));
          });
        } else if (info.action === 'cabinet') {
          if (game.solved) return say('약장은 이미 열렸어!', 2000);
          cabinetPanel();
        } else if (info.action === 'exit') leaveRoom();
      },
      hint(n) {
        const left = nurse.slots.map((s, i) => i).filter((i) => !found.has(i));
        if (n === 1)
          return (left.length ? '아직 못 찾은 쪽지는 ' + left.map((i) => NOTE_ZONE[nurse.slots[i]]).join(', ') + ' 쪽에 있어. ' : '') + '첫 쪽지로 🩹를 먼저 구하고, 곱셈·나눗셈과 괄호는 먼저 계산해!';
        return '🩹 = ' + nurse.a + ', 💊 = ' + nurse.b + ' 이야! 🌡️는 직접 구해 봐.';
      },
    };
  };

  /* ---------------- 복도: 경비원 피해 몰래 가기 ---------------- */
  /** opts: { next: 다음 목적지 이름, onGoal: 도착하면 할 일 (없으면 다음 단계) } */
  function startHall(def, opts) {
    const o = opts || {};
    const h = E.createHall(def, game.seed + game.stage * 7919 + (def.id === 'h0' ? 13 : 0));
    setLevel(W3.buildHall(h, game.run));
    const at = E.BUILDINGS[def.building].name + ' ' + def.floor + '층 복도';
    $('hudPlace').textContent = at;
    $('roomCard').hidden = true;
    $('minimap').hidden = false;
    $('actBtn').hidden = false;
    HG.sound.stopMusic();
    const next = ROUTE[game.stage + 1];
    const nextPlace = o.next || (next.kind === 'room' ? game.run.steps.find((s) => s.id === next.id).place : E.EXIT.place);
    st = {
      kind: 'hall',
      hall: h,
      onGoal: o.onGoal || null,
      notes: hallNotes(h, nextPlace),
      noteCool: 0,
      lastNote: null,
      caughtT: 0,
      heart: 0,
      steps: 0,
      lit: null,
      room: null, // 지금 들어가 있는 열린 교실
      roomsSeen: new Set(),
      interact() {},
    };
    player.y = 0;
    paintHintBtn();
    showMap('다음 목적지: ' + (o.next ? nextPlace : where(nextPlace)), def.intro, '복도로 나가기', () => {
      say('노랗게 빛나는 ' + nextPlace + ' 문으로 가요! 숨을 곳 앞에서 「숨기」 (E · Space). 문이 열린 교실은 걸어 들어갈 수 있어요', 5500);
    });
  }

  /** 복도에서 가까이 가면 알려 주는 것: 잠긴 실, 정전된 엘리베이터, 잠긴 현관, 연결다리 */
  function hallNotes(h, nextPlace) {
    const list = [];
    h.locked.forEach((l) =>
      l.doors.forEach((dx) =>
        list.push({
          x: dx,
          side: 1,
          r: 0.6,
          text: l.why === 'done' ? '이미 다녀온 ' + l.name + '이야. 이제 ' + nextPlace + '!' : l.why === 'later' ? '🔒 ' + l.name + ' — 지금은 잠겨 있어. 먼저 ' + nextPlace + '!' : '🔒 ' + l.name + ' — 문이 잠겨 있어요',
        })
      )
    );
    h.evs.forEach((x) => list.push({ x, side: 1, r: 0.75, text: '⚡ 엘리베이터는 전원이 나가서 움직이지 않아요. 계단으로 가요!' }));
    h.entrances.forEach((en) =>
      list.push({ x: en.x, side: 1, r: 1.8, text: en.name === E.EXIT.place ? '🔒 ' + en.name + ' — 큰 자물쇠가 걸려 있어! ' + nextPlace + '부터 가요' : '🔒 ' + en.name + ' — 쇠사슬로 잠겨 있어요' })
    );
    if (h.bridgeX != null)
      list.push({ x: h.bridgeX, side: -1, r: 1.1, text: h.def.fromBridge ? '🌉 연결다리 — 신관으로 돌아갈 필요는 없어. ' + nextPlace + '(으)로 가자!' : '🌉 연결다리 — 본관으로 가는 길이야. 먼저 ' + nextPlace + '부터!' });
    return list;
  }
  function checkNotes(h, dt) {
    if (st.noteCool > 0) st.noteCool -= dt;
    const p = h.player;
    const n = p.hidden < 0 ? st.notes.find((q) => Math.abs(q.x - p.x) < q.r && (q.side > 0 ? p.z > E.Z_MAX - 0.15 && p.z < E.WALL_Z : p.z < E.Z_MIN + 0.2)) : null;
    if (n && n !== st.lastNote && st.noteCool <= 0) {
      say(n.text, 3000);
      HG.sound.play('wrong');
      st.noteCool = 1.2;
    }
    st.lastNote = n || null;
  }

  /** 숨은 곳에서 보는 자리: 청소함 틈 / 화장실 문 안 / 아래층 계단참 */
  function hideView(sp) {
    if (sp.kind === 'locker') return { x: sp.x, z: -1.22, y: 0, yaw: Math.PI };
    if (sp.kind === 'stairs') return { x: sp.downX, z: E.WALL_Z + 3.55, y: -1.53, yaw: 0 };
    return { x: sp.x, z: 2.15, y: 0, yaw: 0 };
  }

  function updateHall(dt) {
    const h = st.hall;
    if (st.caughtT > 0) {
      st.caughtT -= dt;
      if (st.caughtT <= 0) {
        showOverlay(null);
        guardSay('👻 다시 해 보자! 불빛에 오래 비치지 말고, 숨을 곳에서 숨을 곳으로!', 4000);
      }
      return;
    }
    const m = readMove();
    const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    player.yaw += turn * 2.3 * dt;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const speed = m.run ? E.RUN : E.WALK;
    const vx = (-sin * m.f + cos * m.s) * speed;
    const vz = (-cos * m.f - sin * m.s) * speed;
    const moving = Math.abs(m.f) + Math.abs(m.s) > 0.05;
    E.stepHall(h, { vx: moving ? vx : 0, vz: moving ? vz : 0, run: m.run, hide: input.hide }, dt);
    input.hide = false;
    const p = h.player;
    player.moving = p.walking;
    player.running = p.running;
    if (p.hidden < 0) {
      player.x = p.x;
      player.z = p.z;
      player.y += (0 - player.y) * Math.min(1, dt * 10);
    }
    footsteps(dt, 0.12);
    const g = h.guard;
    for (const e of h.events) {
      if (e.type === 'spotted') {
        HG.sound.play('whistle');
        guardSay('👮 “거기 누구냐!” — 열린 교실이나 계단으로 도망쳐서 따돌려요!', 3000);
      } else if (e.type === 'suspect') guardSay('👮 “응? 거기 누구 있나?” — 살피러 와요! 그 자리 말고 다른 곳으로 피해요', 2800);
      else if (e.type === 'lost') {
        if (e.saw) guardSay('👮 “거기 숨었지!” — 숨는 걸 봤어요! 얼른 나와서 도망가요!', 3000);
        else guardSay('👮 “이상하다… 어디 갔지?” — 마지막으로 본 곳을 찾아봐요', 2600);
      } else if (e.type === 'heard') guardSay('👮 “무슨 소리지?” — 소리 난 곳을 살피러 와요! 뛰지 마요', 2600);
      else if (e.type === 'look') guardSay('👀 경비 아저씨가 멈춰 섰어요… 곧 뒤돌아봐요!', 1800);
      else if (e.type === 'check') {
        HG.sound.play('creak');
        guardSay(e.kind === 'toilet' ? '👮 끼익… 화장실 문을 열어 봐요!' : '👮 덜컹! 청소함을 열어 봐요!', 2000);
      } else if (e.type === 'empty') guardSay('👮 “없네… 잘못 봤나?”', 2000);
      else if (e.type === 'stairsLook') guardSay('👮 “아래층으로 도망갔나…?” — 계단 위에서 비춰 봐요. 조금 기다렸다 올라가요', 3200);
      else if (e.type === 'roomSearch') guardSay('🔦 경비 아저씨가 교실 안을 뒤져요! 다른 문으로 빠져나가요', 3000);
      else if (e.type === 'peekRoom') {
        if (st.room === e.cell) guardSay('🔦 경비 아저씨가 이 교실 문 안을 비춰요! 문 옆 벽에 바짝 붙어요', 2600);
      } else if (e.type === 'enterRoom') {
        HG.sound.play('creak');
        guardSay('🔦 경비 아저씨가 교실을 살피러 들어갔어요. 지금이 기회!', 3000);
        level.lightRoom(e.cell, true);
        st.lit = e.cell;
      } else if (e.type === 'exitRoom') {
        HG.sound.play('creak');
        level.lightRoom(e.cell, false);
        st.lit = null;
      } else if (e.type === 'hide') {
        HG.sound.play(e.kind === 'stairs' ? 'step' : 'click');
        const v = hideView(h.spots[e.spot]);
        // 숨은 곳에서 복도 쪽을 봐요
        player.yaw = v.yaw;
        player.pitch = e.kind === 'stairs' ? 0.32 : 0;
        if (e.kind === 'stairs') guardSay('🏃 아래층 계단으로 내려왔어요! 경비 아저씨 발소리가 멀어지면 올라가요', 3200);
      } else if (e.type === 'unhide') HG.sound.play(e.kind === 'stairs' ? 'step' : 'click');
      else if (e.type === 'caught') {
        game.caught++;
        game.penalty += E.CAUGHT_PENALTY;
        save();
        HG.sound.play('hit');
        if (st.lit != null) level.lightRoom(st.lit, false);
        st.lit = null;
        $('caughtWhy').textContent = e.why === 'found' ? '“찾았다!” 숨은 곳을 경비 아저씨가 열어 봤어요' : '“거기 누구냐!” 경비 아저씨에게 잡혔어요';
        showOverlay('caughtScreen');
        st.caughtT = 1.8;
        player.x = h.player.x;
        player.z = h.player.z;
        player.y = 0;
        player.yaw = h.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        player.pitch = 0;
      } else if (e.type === 'goal') {
        h.events.length = 0;
        HG.sound.play('creak');
        if (st.onGoal) st.onGoal();
        else nextStage();
        return;
      }
    }
    h.events.length = 0;
    checkNotes(h, dt);
    // 열린 교실에 들어왔을 때
    const room = h.player.hidden < 0 ? E.roomAt(h, h.player.x, h.player.z) : null;
    st.room = room ? room.cell : null;
    if (room && !st.roomsSeen.has(room.cell)) {
      st.roomsSeen.add(room.cell);
      say('🚪 ' + room.name + (room.type === 'classroom' ? ' 교실' : '') + '에 들어왔어요. 복도에서는 안 보여요!' + (room.doors.length > 1 ? ' 다른 문으로 빠져나갈 수도 있어요' : ' 문이 하나뿐이라 쫓길 때는 막다른 곳이에요'), 4200);
    }
    // 숨었을 때: 청소함 틈 / 화장실 문 안 / 계단참
    const nowHidden = h.player.hidden >= 0;
    const sp = nowHidden ? h.spots[h.player.hidden] : null;
    $('peek').hidden = !nowHidden;
    $('peekLabel').hidden = !nowHidden;
    if (sp) {
      $('peek').classList.toggle('door', sp.kind === 'toilet');
      $('peek').classList.toggle('stairs', sp.kind === 'stairs');
      $('peekLabel').textContent = sp.kind === 'stairs' ? '🏃 아래층 계단에 숨었어요 · 움직이면 올라가요' : '🙈 ' + sp.label + '에 숨었어요 · 움직이면 나가요';
      const v = hideView(sp);
      const k = Math.min(1, dt * 7);
      player.x += (v.x - player.x) * k;
      player.z += (v.z - player.z) * k;
      player.y += (v.y - player.y) * k;
      let d = player.yaw - v.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.yaw = v.yaw + Math.max(-1.1, Math.min(1.1, d));
    }
    torch.intensity = nowHidden ? 0 : 4.5;
    const act = $('actBtn');
    const near = E.spotNear(h, h.player.x, h.player.z);
    const stairsNear = !nowHidden && near >= 0 && h.spots[near].kind === 'stairs';
    act.setAttribute('aria-pressed', String(nowHidden));
    act.textContent = nowHidden ? (sp.kind === 'stairs' ? '올라가기' : '나가기') : stairsNear ? '계단으로' : '숨기';
    act.classList.toggle('far', !nowHidden && near < 0);
    // 경비원 모습·소리
    level.guard.sync(g, dt, game.t);
    const chase = E.hunting(g);
    $('danger').hidden = !chase;
    const dx = g.x - player.x;
    const dz = g.z - player.z;
    const dist = Math.hypot(dx, dz);
    if (E.inCorridor(g) && g.moving) {
      st.steps -= dt;
      if (st.steps <= 0) {
        st.steps = g.state === 'chase' ? 0.27 : 0.55;
        const vol = Math.max(0, 1 - dist / 22);
        if (vol > 0.02) {
          // 소리가 들리는 쪽 (왼쪽·오른쪽)
          const ang = Math.atan2(dx, dz) - (player.yaw + Math.PI);
          HG.sound.play('step', { vol: vol * 1.4, pan: Math.max(-1, Math.min(1, -Math.sin(ang))) });
        }
      }
    }
    // 경비원이 이쪽을 보고 가까이 있으면 심장이 두근두근
    const facing = Math.cos(Math.atan2(h.player.z - g.z, h.player.x - g.x) - g.ang) > 0.5;
    if (E.inCorridor(g) && dist < g.cone + 4 && (facing || chase)) {
      st.heart -= dt;
      if (st.heart <= 0) {
        HG.sound.play('heart', { vol: 0.6 + 0.4 * (1 - dist / (g.cone + 4)) });
        st.heart = 0.32 + (dist / (g.cone + 4)) * 0.6;
      }
    }
    drawMinimap(h);
  }

  function drawMinimap(h) {
    const c = $('minimap');
    const g = c.getContext('2d');
    const w = c.width;
    const hh = c.height;
    g.clearRect(0, 0, w, hh);
    g.fillStyle = 'rgba(10, 8, 20, 0.75)';
    X.rr(g, 0, 0, w, hh, 18);
    g.fill();
    const x0 = 24;
    const x1 = w - 24;
    const k = (x1 - x0) / h.length;
    const y = hh / 2 + 6;
    g.fillStyle = 'rgba(255, 255, 255, 0.18)';
    g.fillRect(x0, y - 3, x1 - x0, 6);
    // 열린 교실 (위쪽 칸), 숨을 곳, 계단
    h.rooms.forEach((r) => {
      g.fillStyle = 'rgba(159, 240, 216, 0.22)';
      g.fillRect(x0 + r.x0 * k + 2, y - 30, (r.x1 - r.x0) * k - 4, 18);
      g.fillStyle = '#9ff0d8';
      r.doors.forEach((d) => g.fillRect(x0 + d * k - 3, y - 14, 6, 10));
    });
    h.spots.forEach((sp) => {
      g.fillStyle = sp.kind === 'stairs' ? '#7dd3fc' : '#9ff0d8';
      g.fillRect(x0 + sp.x * k - 4, y - 14, 8, 28);
    });
    const gd = h.guard;
    const inRoomY = (z) => (z >= E.WALL_Z ? y - 21 : y);
    if (E.inCorridor(gd) && gd.z < E.WALL_Z) {
      const cx = Math.cos(gd.ang);
      if (Math.abs(cx) > 0.3) {
        g.fillStyle = E.hunting(gd) ? 'rgba(255, 80, 80, 0.55)' : 'rgba(255, 240, 170, 0.5)';
        const a = x0 + gd.x * k;
        const b = x0 + (gd.x + cx * gd.cone) * k;
        g.fillRect(Math.min(a, b), y - 10, Math.abs(b - a), 20);
      }
    }
    const dot = (x, yy, color, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(x0 + x * k, yy, r, 0, Math.PI * 2);
      g.fill();
    };
    g.fillStyle = '#ffd166';
    g.fillRect(x0 + h.goalX * k - 9, y - 18, 18, 36);
    dot(gd.x, inRoomY(gd.z), E.inCorridor(gd) ? '#ff6b6b' : 'rgba(255,107,107,0.35)', 11);
    dot(h.player.x, inRoomY(h.player.z), '#ff8a1f', 11);
    X.txt(g, '도착', x0 + h.goalX * k, 14, 20, '#ffd166');
    X.txt(g, '나', x0 + h.player.x * k, 14, 20, '#ffb066');
    X.txt(g, '경비', x0 + gd.x * k, hh - 10, 20, '#ff9a9a');
  }

  /* ---------------- 중앙 현관: 자물쇠 + 다 같이 문 밀기 ---------------- */
  function startExit() {
    setLevel(R.entrance(game.run));
    roomCard(where(E.EXIT.place), '🚪 ' + E.EXIT.title, '숫자 수첩을 보고, 자물쇠의 그림 순서대로 숫자 6개를 맞춰요. 그다음 다 같이 문을 밀어요!');
    $('hudPlace').textContent = E.EXIT.place;
    HG.sound.music(SONG);
    const lockIds = game.run.lock;
    const values = lockIds.map(() => 0);
    let pushing = false;
    let push = 0;
    let meter = null;
    const icon = (id) => game.run.steps.find((s) => s.id === id).icon;
    function lockPanel() {
      openPanel('현관 자물쇠 · 6자리', (b) => {
        const lock = el('div', 'lock');
        lockIds.forEach((id, i) => {
          const d = el('div', 'dial');
          const up = el('button', null, '▲');
          const down = el('button', null, '▼');
          const num = el('div', 'digit', String(values[i]));
          up.setAttribute('aria-label', i + 1 + '번째 숫자 올리기');
          down.setAttribute('aria-label', i + 1 + '번째 숫자 내리기');
          up.addEventListener('click', () => {
            values[i] = (values[i] + 1) % 10;
            num.textContent = String(values[i]);
            HG.sound.play('tick');
          });
          down.addEventListener('click', () => {
            values[i] = (values[i] + 9) % 10;
            num.textContent = String(values[i]);
            HG.sound.play('tick');
          });
          d.append(el('span', 'icon', icon(id)), up, num, down);
          lock.append(d);
        });
        const open = el('button', 'btn', '🔓 열기');
        open.addEventListener('click', () => {
          if (mustWait()) return;
          if (!E.checkLock(game.run, values)) {
            wrongWait();
            HG.sound.play('wrong');
            shake(lock);
            say('철컥… 안 열려. 그림과 같은 방의 숫자를 그 자리에 맞춰야 해!', 3500);
            return;
          }
          HG.sound.play('unlock');
          level.unlock();
          game.solved = true;
          paintHintBtn();
          startPush();
        });
        const note = el('button', 'btn btn-quiet', '📒 숫자 수첩 보기');
        note.addEventListener('click', () => {
          closePanel();
          $('noteBtn').click();
        });
        b.append(el('p', 'step', '그림이 있는 방에서 받은 숫자를 그 자리에 맞춰요'), lock, el('div', 'prow'), open, note);
      });
    }
    function startPush() {
      openPanel('다 같이 문을 밀어요!', (b) => {
        b.append(el('p', 'q', '자물쇠가 풀렸어요! 그런데 문이 너무 무거워요…'), el('p', 'step', '모둠 친구들 모두 이 버튼을 마구 눌러요! (컴퓨터는 Space)'));
        const m = el('div', 'meter');
        meter = el('i');
        m.append(meter);
        const btn = el('button', 'btn', '💪 영차!');
        btn.style.fontSize = '1.6em';
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          shove();
        });
        btn.addEventListener('keydown', (e) => {
          if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            if (!e.repeat) shove();
          }
        });
        b.append(m, btn);
        setTimeout(() => btn.focus(), 50);
        pushing = true;
      });
    }
    function shove() {
      if (!pushing) return;
      push = Math.min(1, push + 0.07);
      HG.sound.play('step', { vol: 1 });
      if (meter) meter.style.width = push * 100 + '%';
      if (push >= 1) {
        // 문이 열려요!
        pushing = false;
        closePanel();
        HG.sound.play('creak');
        st.opening = true;
      }
    }
    st = {
      kind: 'room',
      id: 'exit',
      step: E.EXIT,
      interact(info) {
        if (info.action === 'lock') {
          if (pushing) return startPush();
          lockPanel();
        } else if (info.action === 'exit') say('들어온 문으로는 나갈 수 없어. 현관 유리문 자물쇠를 열자!', 3000);
      },
      step2(dt) {
        if (!pushing) return;
        push = Math.max(0, push - dt * 0.2);
        if (meter) meter.style.width = push * 100 + '%';
        level.doorOpen = Math.max(level.doorOpen, push * 0.15);
      },
      opening: false,
      hint(n) {
        if (n === 1) return '숫자 수첩을 열어 봐! 자물쇠 위의 그림(🎃🧪📚📢📝🩹)과 같은 방에서 받은 숫자를 그 칸에 맞추면 돼.';
        lockIds.slice(0, 3).forEach((id, i) => (values[i] = game.run.digits[id]));
        return '앞의 세 자리는 맞춰 줬어! 자물쇠를 다시 눌러 봐.';
      },
    };
    paintHintBtn();
    say('여기가 중앙 현관! 유리문의 자물쇠를 눌러 봐.', 4000);
  }

  /* ---------------- 탈출 성공 ---------------- */
  /* ---------------- 반 전체 명예의 전당 (구글 시트) ----------------
     선생님 설정에 시트 웹 앱 주소가 있으면, 어느 기기에서 탈출해도 기록이 한 시트에 모여요.
     인터넷이 안 되면 이 기기에만 저장해 두었다가 다음에 다시 보내요. */
  const PENDING = 'escape:pending';
  const classKey = () => settings.school + ' ' + settings.myClass;
  function sheetCall(url, params) {
    const q = Object.keys(params)
      .map((k) => k + '=' + encodeURIComponent(params[k]))
      .join('&');
    const ctrl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 12000);
    return fetch(url + '?' + q, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then((r) => r.json())
      .then((d) => {
        clearTimeout(timer);
        if (!d || !d.ok) throw new Error((d && d.error) || '시트 응답이 이상해요');
        return d;
      })
      .catch((err) => {
        clearTimeout(timer);
        throw err;
      });
  }
  function flushPending() {
    const list = HG.store.get(PENDING, []);
    if (!Array.isArray(list) || !list.length) return Promise.resolve();
    const rec = list[0];
    return sheetCall(rec.sheet, Object.assign({ action: 'add' }, rec.params)).then(
      () => {
        HG.store.set(PENDING, HG.store.get(PENDING, []).filter((r) => r.params.id !== rec.params.id));
        return flushPending();
      },
      () => {}
    );
  }
  const sharedList = () => flushPending().then(() => sheetCall(settings.sheet, { action: 'list', cls: classKey() }));
  function renderRows(ol, rows, me) {
    ol.textContent = '';
    if (!rows.length) {
      ol.append(el('li', 'empty', '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!'));
      return;
    }
    rows.forEach((row, i) => {
      const li = el('li', i === me ? 'me' : null);
      li.append(el('span', 'who', row.name), el('span', 'what', boardFormat(row)));
      ol.append(li);
    });
  }
  function boardNote(id, text) {
    $(id).textContent = text;
    $(id).hidden = !text;
  }
  /** 탈출 성공 화면: 이름을 적으면 반 전체 명예의 전당(시트)에 올려요 */
  function sharedResult() {
    const form = $('nameForm');
    const input = $('nameInput');
    const list = $('resultBoard');
    form.hidden = false;
    input.value = game.team || HG.store.get('lastName', '');
    list.textContent = '';
    boardNote('resultBoardNote', '📡 반 전체 기록을 불러오는 중…');
    sharedList().then(
      (d) => {
        if (form.hidden) return;
        renderRows(list, d.rows, -1);
        boardNote('resultBoardNote', '우리 반 전체 명예의 전당이에요');
      },
      () => {
        if (form.hidden) return;
        HG.renderBoard(list, GAME, boardFormat, -1);
        boardNote('resultBoardNote', '반 전체 기록을 못 불러와서 이 기기 기록을 보여 줘요');
      }
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return input.focus();
      HG.store.set('lastName', name);
      form.hidden = true;
      HG.board.add(GAME, name, game.finalTime, { hints: game.hints, caught: game.caught }, true);
      const params = { cls: classKey(), name, score: game.finalTime, hints: game.hints, caught: game.caught, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) };
      boardNote('resultBoardNote', '📡 반 전체 명예의 전당에 올리는 중…');
      sheetCall(settings.sheet, Object.assign({ action: 'add' }, params)).then(
        (d) => {
          renderRows(list, d.rows, d.rank < 10 ? d.rank : -1);
          boardNote('resultBoardNote', '✅ 올렸어요! 우리 반 ' + (d.rank + 1) + '등' + (d.rank >= 10 ? ' (10등 안에 들면 여기 보여요)' : ''));
          HG.sound.play('gold');
          $('againBtn').focus();
        },
        () => {
          HG.store.set(PENDING, HG.store.get(PENDING, []).concat([{ sheet: settings.sheet, params }]));
          HG.renderBoard(list, GAME, boardFormat, -1);
          boardNote('resultBoardNote', '인터넷이 안 돼서 이 기기에만 저장했어요. 다음에 명예의 전당을 열면 다시 보내요.');
          $('againBtn').focus();
        }
      );
    };
  }

  const boardFormat = (row) => E.formatTime(row.score) + (row.hints ? ' · 💡' + row.hints : '') + (row.caught ? ' · 👮' + row.caught : '');
  function finish() {
    game.finalTime = Math.round(elapsed() * 10) / 10;
    game.mode = 'done';
    HG.store.set(SAVE, null);
    HG.sound.stopMusic();
    HG.sound.play('clear');
    setHud(false);
    setLevel(R.outside(game.run));
    level.onBurst = () => HG.sound.play('whoosh');
    st = { kind: 'outside' };
    $('resultTitle').textContent = game.team + ' 탈출 성공!';
    $('resultTime').textContent = E.formatTime(game.finalTime);
    const stats = $('resultStats');
    stats.textContent = '';
    [
      ['힌트', game.hints + '번'],
      ['경비원에게 잡힘', game.caught + '번'],
      ['더해진 시간', E.formatTime(game.penalty)],
    ].forEach(([k, v]) => {
      const span = el('span');
      span.append(k + ' ', el('b', null, v));
      stats.append(span);
    });
    HG.best.submit(GAME, game.finalTime, true);
    $('resultBoardNote').hidden = true;
    if (settings.sheet) sharedResult();
    else
      HG.setupResultBoard({
        game: GAME,
        score: game.finalTime,
        asc: true,
        name: game.team,
        extra: { hints: game.hints, caught: game.caught },
        form: $('nameForm'),
        input: $('nameInput'),
        list: $('resultBoard'),
        format: boardFormat,
        onSaved: () => $('againBtn').focus(),
      });
    setTimeout(() => {
      if (game.mode === 'done') showOverlay('resultScreen');
    }, 3200);
  }
  $('againBtn').addEventListener('click', () => {
    blurActive();
    begin(game.team, settings.seed || (Math.random() * 1e9) | 0);
  });
  $('homeBtn').addEventListener('click', goTitle);

  /* ---------------- 선생님 정답지: 시계(⏱)를 2.5초 안에 5번 누르면 열려요 ---------------- */
  function answerKey() {
    const run = game.run;
    const P = run.puzzles;
    const icon = (id) => run.steps.find((s) => s.id === id).icon;
    openPanel('🔑 선생님 정답지', (b) => {
      b.append(el('p', 'step', '이 기기에서 지금 하는 판의 정답이에요. 판마다 달라요. 학생들에게는 살짝만!'));
      const ol = el('ol', 'clues');
      const add = (title, text) => {
        const li = el('li');
        li.append(el('b', null, title + ': '), document.createTextNode(text));
        ol.append(li);
      };
      const c = P.classroom;
      add('교실 서랍', c.answer + '  (🎃' + c.counts.pumpkin + ' 🦇' + c.counts.bat + ' 🕷️' + c.counts.spider + ', 식 ' + E.COUNT_FORMS[c.form].parts.join(' ') + ')');
      add('과학실 물약', P.science.recipes.map((rc, i) => i + 1 + ') ' + rc.color + ' ' + rc.parts.map((p, k) => p + ' ' + rc.amounts[k]).join(' + ')).join('  '));
      add('도서관 속담', P.library.books.map((bk) => bk.before + '「' + bk.blank + '」' + bk.after).join(' / '));
      add('방송실 비밀번호', P.broadcast.code);
      const seats = [];
      P.office.solution.forEach((seat, t) => (seats[seat] = P.office.teachers[t]));
      add('교무실 자리', seats.map((n, i) => i + 1 + '번 ' + n).join(', ') + (P.quiz.length ? ' · 선생님 문제 답: ' + P.quiz.map((q) => q.a).join(' / ') : ''));
      add('보건실 약장', P.nurse.answer + '  (🩹=' + P.nurse.a + ', 💊=' + P.nurse.b + ', 🌡️=' + P.nurse.c + ')');
      add('현관 자물쇠', run.lock.map((id) => run.digits[id]).join('') + '  (' + run.lock.map((id) => icon(id) + run.digits[id]).join(' ') + ')');
      b.append(ol);
    });
  }
  let keyTaps = [];
  $('hudTime').addEventListener('click', () => {
    const now = Date.now();
    keyTaps = keyTaps.filter((t) => now - t < 2500);
    keyTaps.push(now);
    if (keyTaps.length >= 5 && game.mode === 'play' && game.run) {
      keyTaps = [];
      answerKey();
    }
  });

  /* ---------------- 수첩·명예의 전당·선생님 설정 ---------------- */
  let noteBack = null;
  $('noteBtn').addEventListener('click', () => {
    $('noteBtn').blur();
    if (game.mode !== 'play') return;
    const list = $('noteList');
    list.textContent = '';
    const doneIds = new Set(ROUTE.slice(0, game.stage).filter((r) => r.kind === 'room').map((r) => r.id));
    if (st && st.kind === 'room' && game.solved && st.id !== 'exit') doneIds.add(st.id);
    game.run.steps.forEach((s) => {
      const li = el('li');
      li.append(el('span', null, s.icon), el('span', null, s.place), el('b', null, doneIds.has(s.id) ? String(game.run.digits[s.id]) : '?'));
      list.append(li);
    });
    noteBack = overlays.find((o) => !$(o).hidden) || null;
    showOverlay('noteScreen');
    $('noteClose').focus();
  });
  $('noteClose').addEventListener('click', () => {
    showOverlay(noteBack);
    noteBack = null;
    blurActive();
  });
  $('boardBtn').addEventListener('click', () => {
    HG.renderBoard($('boardList'), GAME, boardFormat, -1);
    $('boardHint').textContent = settings.sheet ? '📡 우리 반 전체 기록을 불러오는 중…' : '이 기기에서 가장 빨리 탈출한 10모둠';
    showOverlay('boardScreen');
    $('boardClose').focus();
    if (!settings.sheet) return;
    sharedList().then(
      (d) => {
        renderRows($('boardList'), d.rows, -1);
        $('boardHint').textContent = '우리 반 전체에서 가장 빨리 탈출한 10모둠';
      },
      () => ($('boardHint').textContent = '반 전체 기록을 못 불러왔어요 (인터넷 확인). 이 기기 기록이에요')
    );
  });
  $('boardClose').addEventListener('click', () => showOverlay('titleScreen'));

  const tClass = $('tClass');
  E.CLASSES.forEach((c) => {
    const o = el('option', null, c);
    o.value = c;
    tClass.append(o);
  });
  function fillTeacher(s) {
    $('tSchool').value = s.school;
    tClass.value = s.myClass;
    [1, 2, 3].forEach((n) => {
      const q = s.quiz[n - 1];
      $('tQ' + n).value = q ? q.q : '';
      $('tA' + n).value = q ? q.a : '';
    });
    $('tTeacher').value = s.teacher || '';
    $('tMotto').value = s.motto || '';
    $('tDuty').value = (s.duty || []).join(', ');
    $('tNoisy').value = (s.noisy || []).join(', ');
    $('tFriends').value = (s.friends || []).join(', ');
    $('tSheet').value = s.sheet || '';
    $('tSheetNote').textContent = '만드는 법은 게임 목록의 README 「반 전체 명예의 전당」에 있어요';
  }
  $('tSheetTest').addEventListener('click', () => {
    const url = E.sheetUrl($('tSheet').value);
    const note = $('tSheetNote');
    if (!url) {
      note.textContent = '❌ 주소가 맞지 않아요. https://script.google.com/macros/s/…/exec 모양이어야 해요';
      return;
    }
    note.textContent = '📡 확인하는 중…';
    sheetCall(url, { action: 'list', cls: E.normalizeSettings({ school: $('tSchool').value, myClass: tClass.value }).school + ' ' + tClass.value }).then(
      (d) => (note.textContent = '✅ 연결됐어요! 지금 우리 반 기록 ' + d.rows.length + '개 · 「저장하기」를 눌러 주세요'),
      () => (note.textContent = '❌ 연결이 안 돼요. 배포할 때 액세스 권한을 「모든 사용자」로 했는지 확인해 주세요')
    );
  });
  $('teacherBtn').addEventListener('click', () => {
    fillTeacher(settings);
    $('tShare').hidden = true;
    showOverlay('teacherScreen');
    $('tSchool').focus();
  });
  $('tClose').addEventListener('click', goTitle);
  $('tReset').addEventListener('click', () => fillTeacher(E.normalizeSettings({})));
  $('teacherForm').addEventListener('submit', (e) => {
    e.preventDefault();
    settings = E.normalizeSettings({
      school: $('tSchool').value,
      myClass: tClass.value,
      quiz: [1, 2, 3].map((n) => ({ q: $('tQ' + n).value, a: $('tA' + n).value })),
      teacher: $('tTeacher').value,
      motto: $('tMotto').value,
      duty: $('tDuty').value,
      noisy: $('tNoisy').value,
      friends: $('tFriends').value,
      sheet: $('tSheet').value,
      seed: settings.seed, // 문제 고정은 그대로
    });
    HG.store.set(SETTINGS, settings);
    const code = E.encodeSettings(settings);
    try {
      history.replaceState(null, '', '#t-' + code); // 새로고침해도 방금 설정 그대로
    } catch (err) {
      /* 주소를 못 바꾸는 곳에서는 이 기기 저장만 써요 */
    }
    HG.sound.play('gold');
    paintTitle();
    const web = /^https?:$/.test(location.protocol) && !/^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
    $('tShare').hidden = false;
    $('tQr').hidden = !web;
    if (!web) {
      $('tLink').textContent = '저장했어요! 이 기기에서는 바로 선생님 설정으로 해요. 학생 기기용 주소와 QR은 인터넷 주소(GitHub Pages)로 열었을 때 나와요.';
      return;
    }
    const url = location.origin + location.pathname + '#t-' + code;
    $('tLink').textContent = url;
    drawQr($('tQr'), url);
  });
  function drawQr(c, text) {
    const g = c.getContext('2d');
    const done = () => {
      const qr = window.qrcode(0, 'L');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const cell = Math.max(1, Math.floor(c.width / (n + 6)));
      const off = Math.floor((c.width - cell * n) / 2);
      g.fillStyle = '#fffaf0';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#120d1c';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
    };
    if (window.qrcode) return done();
    const tag = document.createElement('script');
    tag.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    tag.onload = () => window.qrcode && done();
    tag.onerror = () => (c.hidden = true);
    document.head.appendChild(tag);
  }

  /* ---------------- 제목 화면 배경: 경비원이 순찰하는 복도 ---------------- */
  let titleHall = null;
  function loadTitleScene() {
    const def = E.HALLS[0];
    titleHall = E.createHall(def, 77);
    // 아이는 맨 끝 청소함에 숨어 있어요 (경비원이 못 봐요)
    titleHall.player.hidden = 0;
    const run = game.run || E.createRun(1, settings);
    setLevel(W3.buildHall(titleHall, run));
    st = { kind: 'title' };
  }
  function updateTitle(dt) {
    E.stepHall(titleHall, { vx: 0, vz: 0, hide: false }, dt);
    titleHall.events.length = 0;
    level.guard.sync(titleHall.guard, dt, game.t);
    const k = game.t * 0.05;
    player.x = titleHall.startX - 3 + Math.sin(k) * 1.5;
    player.z = -0.3;
    player.yaw = (titleHall.dir > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.sin(game.t * 0.21) * 0.25;
    player.pitch = -0.04;
    player.moving = false;
  }

  /* ---------------- 배경음: 오르골처럼 으스스하게 ---------------- */
  const MEL = [69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 76, 0, 74, 0, 72, 0, 67, 0, 71, 0, 74, 0, 71, 0, 67, 0, 74, 0, 72, 0, 71, 0];
  const SONG = {
    bpm: 80,
    play(step, when, dur, m) {
      const s = step % 32;
      if (MEL[s]) {
        m.tone({ type: 'triangle', f: m.N(MEL[s]), dur: dur * 3, vol: 0.08, when });
        m.tone({ type: 'sine', f: m.N(MEL[s] + 12), dur: dur * 2, vol: 0.022, when });
      }
      if (s % 16 === 0) m.tone({ type: 'sine', f: m.N(s ? 43 : 45), dur: dur * 15, vol: 0.05, when, attack: 0.4 });
    },
  };

  /* ---------------- 그리기 ---------------- */
  function update(dt) {
    game.t += dt;
    if (!level) return;
    if (game.mode === 'opening') opUpdate(dt);
    else if (game.mode === 'title' && st && st.kind === 'title') updateTitle(dt);
    else if (game.mode === 'play' && st) {
      if (st.kind === 'hall') {
        if (!game.paused && !panelOpen()) updateHall(dt);
        else level.guard.sync(st.hall.guard, 0, game.t);
      } else if (canControl()) walkRoom(dt);
      if (st.step2) st.step2(dt);
      if (st.opening && level.doorOpen < 1) {
        level.doorOpen = Math.min(1, level.doorOpen + dt * 0.7);
        player.z += dt * 1.6 * level.doorOpen;
        if (level.doorOpen >= 1) {
          st.opening = false;
          finish();
        }
      }
      updateHover(dt);
    } else if (game.mode === 'done') {
      player.yaw = Math.sin(game.t * 0.15) * 0.25;
      player.pitch = 0.3;
    }
    level.update(dt, game.t);
  }

  function render() {
    if (!level) return;
    if (game.mode === 'opening') torch.intensity = 0;
    else if (st && st.kind !== 'hall') torch.intensity = level.kind === 'outside' ? 0 : 4.5;
    placeCamera();
    view.renderer.render(level.scene, camera);
    if (game.mode === 'play') $('hudTime').textContent = '⏱ ' + E.formatTime(elapsed());
    const w = waitLeft();
    const pw = $('panelWait');
    pw.hidden = !w || !panelOpen();
    if (w) pw.textContent = '⏳ 틀렸어요! ' + w + '초 뒤에 다시 낼 수 있어요';
    if (shown('mapScreen')) drawMap();
  }

  /* ---------------- 처음 ---------------- */
  $('teamInput').value = HG.store.get('escape:team', '1모둠');
  function boot() {
    $('loading').hidden = true;
    goTitle();
    HG.loop(update, render);
  }
  // 그림 글자(한글 글꼴)가 준비되면 학교를 지어요 (최대 2.5초 기다려요)
  const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('40px "Jua"'), document.fonts.load('40px "Kirang Haerang"')]) : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2500))]).then(boot, boot);

  // 자동 검사용 창 (게임에는 쓰이지 않아요)
  window.__escape = {
    game,
    ROUTE,
    player,
    input,
    level: () => level,
    st: () => st,
    use: (info) => st && st.interact && st.interact(info, null),
    jump(k) {
      enterStage(k);
      mapDone = null;
      showOverlay(null);
    },
    solve: () => solved(),
    finish: () => finish(),
    opening: () => op,
    answerKey: () => answerKey(),
    pick: (nx, ny) => pickAt(nx || 0, ny || 0),
  };
})();
