/* 동암초 탈출 — 3D 방 안 (교실·과학실·도서관·방송실·교무실·보건실·중앙 현관·운동장)
   방 좌표: x 0~W(왼쪽 벽 → 오른쪽 벽), z 0(복도 쪽 문 벽) ~ D(창문 벽). 들어오면 +z 쪽을 봐요.
   누를 수 있는 물건은 L.tag(물건, { action, label, reach }) 로 표시하고, game.js 가 action 을 보고 수수께끼를 열어요. */
(function () {
  'use strict';

  const T = window.THREE;
  const X = window.EscapeTex;
  const E = window.EscapeCore;
  const W3 = window.EscapeWorld;
  const R = (W3.rooms = {});
  const M = W3.M;
  const lam = W3.lam;
  const tmat = W3.tmat;
  const glowMat = W3.glowMat;
  const TAU = Math.PI * 2;
  const H = 3;

  /* ---------------- 방 껍데기 ---------------- */
  function shell(L, kit, o) {
    const Wd = o.W;
    const D = o.D;
    W3.nightLights(L, { mx: Wd / 2, mz: D + 8, tx: Wd / 2, tz: D / 2, density: o.fog == null ? 0.035 : o.fog, ambient: 0.6, hemi: 0.55, moon: 0.5 });
    kit.flat(Wd, D, Wd / 2, 0, D / 2, o.floor || M.wood, [0, 0, Wd / 2, D / 2]);
    kit.flat(Wd, D, Wd / 2, H, D / 2, M.ceiling, [0, 0, Wd / 1.2, D / 1.2], false);
    for (let x = 1.5; x < Wd - 0.5; x += 3) for (let z = 1.6; z < D - 0.5; z += 2.2) W3.ceilingLamp(kit, x, z, H, Math.PI / 2);
    const wallM = o.wall || M.wallClass;
    // 문 벽 (복도 쪽, z = 0)
    const doorHoles = o.doors.map((dx) => ({ a: dx - 0.5, b: dx + 0.5, y0: 0, y1: 2.1 }));
    const high = [];
    if (o.doors.length === 2 && o.doors[1] - o.doors[0] > 3) high.push({ a: o.doors[0] + 0.9, b: o.doors[1] - 0.9, y0: 1.75, y1: 2.5 });
    W3.wallRun(kit, { axis: 'x', fixed: 0, from: 0, to: Wd, face: 1, material: wallM, holes: doorHoles.concat(high) });
    high.forEach((hl) => {
      W3.windowFrame(kit, { axis: 'x', fixed: 0, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: 1, bars: 3 });
      kit.panel(hl.b - hl.a, hl.y1 - hl.y0, (hl.a + hl.b) / 2, (hl.y0 + hl.y1) / 2, -0.04, 0, M.glassFrost);
    });
    // 문 (복도 쪽 문 밖은 캄캄)
    const doors = o.doors.map((dx, i) => {
      kit.box(1.08, 0.06, 0.12, dx, 2.13, 0, M.darkWood);
      kit.box(0.05, 2.1, 0.12, dx - 0.52, 1.05, 0, M.darkWood);
      kit.box(0.05, 2.1, 0.12, dx + 0.52, 1.05, 0, M.darkWood);
      kit.panel(1.0, 2.1, dx, 1.05, -0.9, 0, M.void);
      const door = new T.Mesh(W3.rect(1.0, 2.08, 1, 0, 0, 1), i % 2 ? M.doorDark : M.door);
      door.position.set(dx, 1.04, -0.04);
      L.scene.add(door);
      return door;
    });
    // 창문 벽 (z = D)
    const winHoles = [];
    const n = Math.max(2, Math.round((Wd - 1) / 2.8));
    const step = (Wd - 0.8) / n;
    for (let i = 0; i < n; i++) winHoles.push({ a: 0.4 + i * step + 0.2, b: 0.4 + (i + 1) * step - 0.2, y0: 0.85, y1: 2.6 });
    if (o.windows !== false) {
      W3.wallRun(kit, { axis: 'x', fixed: D, from: 0, to: Wd, face: -1, material: wallM, holes: winHoles });
      winHoles.forEach((hl, i) => {
        W3.windowFrame(kit, { axis: 'x', fixed: D, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: -1, glass: i === 1 ? M.nightMoon : M.night, bars: 2, cross: true, uv: [i * 0.3, 0, i * 0.3 + 0.8, 1] });
        kit.flat(hl.b - hl.a, 1.8, (hl.a + hl.b) / 2, 0.012, D - 1.4, M.moonPatch);
      });
    } else {
      W3.wallRun(kit, { axis: 'x', fixed: D, from: 0, to: Wd, face: -1, material: wallM, holes: o.farHoles || [] });
    }
    W3.wallRun(kit, { axis: 'z', fixed: 0, from: 0, to: D, face: 1, material: o.left || wallM, holes: [] });
    W3.wallRun(kit, { axis: 'z', fixed: Wd, from: 0, to: D, face: -1, material: o.right || wallM, holes: [] });
    L.bounds = { x0: 0.32, x1: Wd - 0.32, z0: 0.32, z1: D - 0.32 };
    L.size = { W: Wd, D };
    return { doors, winHoles };
  }

  /** 나가는 문: 수수께끼를 풀면 열리고 빛나요 */
  function exitDoor(L, door, dx) {
    L.tag(door, { action: 'exit', label: '🚪 복도로 나가기', reach: 2.4 });
    const glow = new T.Mesh(new T.PlaneGeometry(1.1, 2.2), new T.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    L.own(glow.material);
    glow.position.set(dx, 1.1, 0.03);
    L.scene.add(glow);
    let open = 0;
    let opening = false;
    L.exitOpen = false;
    L.openExit = function () {
      opening = true;
      L.exitOpen = true;
    };
    L.updaters.push((dt, t) => {
      if (opening && open < 1) open = Math.min(1, open + dt * 1.5);
      door.position.x = dx + open * 0.85;
      glow.material.opacity = L.exitOpen ? 0.25 + 0.15 * Math.sin(t * 4) : 0;
    });
    L.spawn = { x: dx, z: 0.9, yaw: Math.PI };
  }

  /** 꼬마 유령 부: 둥실둥실 */
  function ghost(L, x, y, z) {
    const g = W3.sprite('ghost', () => X.ghost(), 0.7, 0.7);
    g.position.set(x, y, z);
    L.scene.add(g);
    const light = new T.PointLight(0xc8d8ff, 1.2, 3.5, 1.5);
    light.position.set(x, y, z);
    L.scene.add(light);
    L.updaters.push((dt, t) => {
      g.position.y = y + Math.sin(t * 1.6) * 0.08;
      g.material.rotation = Math.sin(t * 1.1) * 0.08;
      light.position.y = g.position.y;
    });
    L.ghost = g;
    return g;
  }

  /** 흔들리는 촛불 빛 */
  function candleLight(L, x, y, z, color, power) {
    const light = new T.PointLight(color || 0xffa040, power || 3, 6, 1.3);
    light.position.set(x, y, z);
    L.scene.add(light);
    L.updaters.push((dt, t) => {
      light.intensity = (power || 3) * (0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 27));
    });
    return light;
  }

  /** 포스터 (벽에 붙은 그림) */
  function poster(kit, key, draw, w, h, x, y, z, ry) {
    const m = tmat(key, draw, { clamp: true });
    kit.panel(w, h, x, y, z, ry, m);
    return m;
  }

  /** 누를 수 있는 판 (칠판·포스터처럼 따로 Mesh) */
  function board(L, material, w, h, x, y, z, ry) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    L.scene.add(m);
    return m;
  }

  function mark(L, obj, at) {
    const s = W3.sprite('mark', () => X.mark(), 0.2, 0.2, { depthTest: false });
    s.position.copy(at || obj.position);
    s.position.y += 0.22;
    s.visible = false;
    L.scene.add(s);
    return s;
  }

  /* ---------------- 가구 ---------------- */
  function studentDesk(kit, x, z) {
    kit.block(0.46, 0.03, 0.62, x, 0.7, z, M.deskTop);
    kit.block(0.4, 0.1, 0.56, x, 0.57, z, M.deskWood);
    [-0.19, 0.19].forEach((dx) => [-0.27, 0.27].forEach((dz) => kit.block(0.03, 0.7, 0.03, x + dx, 0, z + dz, M.metal)));
  }
  function chair(kit, x, z, mat, back) {
    kit.block(0.38, 0.03, 0.38, x, 0.42, z, mat);
    kit.block(0.03, 0.32, 0.36, x + (back || 0.19), 0.5, z, mat);
    [-0.16, 0.16].forEach((dx) => [-0.16, 0.16].forEach((dz) => kit.block(0.025, 0.42, 0.025, x + dx, 0, z + dz, M.metal)));
  }
  function stool(kit, x, z) {
    kit.cyl(0.17, 0.17, 0.04, x, 0.6, z, M.darkWood, 12);
    kit.cyl(0.03, 0.05, 0.58, x, 0.29, z, M.metal, 8);
    kit.cyl(0.16, 0.16, 0.02, x, 0.01, z, M.darkMetal, 12);
  }
  /** 책장: 앞면에 책 그림 (axis 'x' 이면 x축을 따라 놓이고 face 쪽을 봐요) */
  function shelf(kit, o) {
    const booksM = tmat('books-' + (o.seed || 1), () => X.books(61 + (o.seed || 1)));
    const frameM = o.frame || M.darkWood;
    const len = o.len;
    const h = o.h;
    const d = o.d || 0.36;
    const rows = Math.max(1, Math.round(h / 0.42));
    if (o.axis === 'x') {
      kit.block(len, h, d, o.x, 0, o.z, frameM);
      const fz = o.z + (o.face * d) / 2 + o.face * 0.005;
      kit.panel(len - 0.06, h - 0.1, o.x, h / 2, fz, o.face > 0 ? 0 : Math.PI, booksM, [0, 0, len / 1.4, rows / 2]);
      for (let i = 0; i <= rows; i++) kit.box(len, 0.03, 0.04, o.x, 0.05 + ((h - 0.1) * i) / rows, fz + o.face * 0.02, frameM);
    } else {
      kit.block(d, h, len, o.x, 0, o.z, frameM);
      const fx = o.x + (o.face * d) / 2 + o.face * 0.005;
      kit.panel(len - 0.06, h - 0.1, fx, h / 2, o.z, o.face > 0 ? Math.PI / 2 : -Math.PI / 2, booksM, [0, 0, len / 1.4, rows / 2]);
      for (let i = 0; i <= rows; i++) kit.box(0.04, 0.03, len, fx + o.face * 0.02, 0.05 + ((h - 0.1) * i) / rows, o.z, frameM);
    }
  }
  function curtain(kit, x, z, h, ry) {
    const m = tmat('curtain', () => X.curtain());
    kit.panel(0.5, h, x, 0.85 + h / 2, z, ry, m, [0, 0, 1, 1]);
  }
  /** 뚜껑 없는 쓰레기통 (안이 들여다보여요) */
  function trashCan(kit, x, z, color) {
    kit.add(new T.CylinderGeometry(0.19, 0.16, 0.52, 14, 1, true), lam(color || 0x3a7a5a, { side: T.DoubleSide }), x, 0.26, z);
    kit.add(new T.CircleGeometry(0.16, 14), lam(0x1a1a1a), x, 0.02, z, 0, -Math.PI / 2);
    kit.add(new T.TorusGeometry(0.19, 0.012, 6, 18), M.darkMetal, x, 0.52, z, 0, Math.PI / 2);
  }
  /** 가랜드 (할로윈 깃발 줄) */
  function garland(kit, x0, z0, x1, z1, y) {
    const n = Math.max(4, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.32));
    const cols = [lam(0xff8a1f), lam(0x9b4dd8), lam(0x1e1830), lam(0x9ff0d8)];
    const ang = Math.atan2(-(z1 - z0), x1 - x0);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const sag = Math.sin(k * Math.PI) * 0.35;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.22, 0], 3));
      g.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      g.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
      const m = cols[i % cols.length];
      kit.add(g, m, x0 + (x1 - x0) * k, y - sag, z0 + (z1 - z0) * k, ang);
      kit.add(g.clone(), m, x0 + (x1 - x0) * k, y - sag, z0 + (z1 - z0) * k, ang + Math.PI);
    }
  }

  /* ---------------- 숨은 것 놓기 ---------------- */
  function placeItems(L, list, make, kind, slots) {
    return slots.map((si, n) => {
      const s = list[si];
      const obj = make();
      obj.position.set(s[0], s[1], s[2]);
      if (s[3]) obj.rotation.y = s[3];
      if (s[4]) obj.rotation.x = s[4];
      L.scene.add(obj);
      const item = { kind, slot: si, obj, marked: false, mark: mark(L, obj) };
      L.tag(obj, { action: 'item', item, label: '표시하기', reach: 3.2, quiet: true });
      return item;
    });
  }

  /* ================ 1. 6-3 교실 ================ */
  // 숨을 자리: [x, y, z, ry, rx]
  const PUMPKIN_AT = [
    [4.1, 0, 2.0],
    [5.0, 0.87, 7.3],
    [8.7, 0.92, 6.4],
    [8.68, 0.47, 0.62],
    [1.15, 0, 6.95],
    [0.17, 2.36, 6.4],
    [0.75, 0, 5.95],
    [6.75, 0.45, 6.1],
    [4.5, 0.83, 7.12],
    [8.75, 0.87, 7.25],
    [0.13, 0.98, 2.3],
    [8.35, 0, 1.08],
    [5.2, 0, 4.05],
    [0.15, 2.84, 3.75],
  ];
  const BAT_AT = [
    [2.3, 2.1, 7.42, Math.PI],
    [4.1, 2.45, 3.4, Math.PI / 2],
    [8.97, 2.72, 2.0, -Math.PI / 2],
    [0.03, 2.62, 0.85, Math.PI / 2],
    [8.6, 2.96, 7.1, 0, Math.PI / 2],
    [4.5, 2.62, 0.03, 0],
    [3.95, 1.85, 7.38, Math.PI],
    [8.57, 0.6, 3.5, -Math.PI / 2],
    [0.115, 1.95, 6.2, Math.PI / 2],
  ];
  const SPIDER_AT = [
    [0.06, 2.88, 0.12, Math.PI / 2],
    [6.62, 1.5, 7.4, Math.PI],
    [1.87, 0.45, 5.6, Math.PI / 2],
    [8.96, 1.55, 5.0, -Math.PI / 2],
    [7.4, 1.65, 0.06, 0],
    [0.06, 2.3, 3.55, Math.PI / 2],
    [8.25, 0.56, 0.2, 0],
    [5.2, 2.96, 4.0, 0, Math.PI / 2],
    [0.05, 1.45, 0.98, Math.PI / 2],
    [2.0, 0.89, 7.33, 0, -Math.PI / 2],
  ];
  R.classroom = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'classroom';
    const kit = new W3.Kit();
    const Wd = 9;
    const D = 7.5;
    const { doors, winHoles } = shell(L, kit, { W: Wd, D, doors: [1.6, 7.4] });
    exitDoor(L, doors[1], 7.4);
    L.tag(doors[0], { action: 'lockedDoor', label: '앞문', reach: 2.4 });

    // 칠판 (앞 벽 x = 0)
    const form = E.COUNT_FORMS[run.puzzles.classroom.form].parts;
    const boardM = L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.classBoard(run, form))) }));
    kit.box(0.05, 1.42, 4.5, 0.025, 1.6, 3.75, M.darkWood);
    const bd = board(L, boardM, 4.4, 1.32, 0.06, 1.6, 3.75, Math.PI / 2);
    L.tag(bd, { action: 'board', label: '🔍 칠판 보기', reach: 6 });
    kit.box(0.12, 0.04, 4.4, 0.09, 0.93, 3.75, M.darkWood); // 분필 받침
    kit.box(0.04, 0.03, 0.08, 0.1, 0.96, 3.1, M.white);
    kit.box(0.04, 0.03, 0.06, 0.1, 0.96, 4.4, lam(0xffd166));
    // 시계·달력·시간표·TV
    poster(kit, 'clock', () => X.clock(11, 47), 0.5, 0.5, 0.03, 2.55, 3.75, Math.PI / 2);
    // 급훈 액자 (칠판 위, 시계 옆)
    const mottoM = L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.motto(run.motto || '서로 돕고 함께 웃자'))) }));
    board(L, mottoM, 1.7, 0.42, 0.04, 2.6, 2.25, Math.PI / 2);
    poster(kit, 'calendar', () => X.calendar(), 0.5, 0.58, 0.03, 1.55, 0.98, Math.PI / 2);
    poster(kit, 'timetable-' + run.myClass + run.teacher, () => X.timetable(run.myClass, run.teacher), 0.8, 0.8, 8.98, 1.75, 6.2, -Math.PI / 2);
    kit.box(0.08, 0.68, 1.15, 0.05, 2.0, 6.4, M.black);
    poster(kit, 'tvScreen', () => X.screen(['할로윈 파티', '방과 후 강당']), 1.05, 0.6, 0.095, 2.0, 6.4, Math.PI / 2);
    // 교탁과 선생님 책상
    kit.block(0.55, 1.05, 0.7, 1.35, 0, 3.75, M.deskWood);
    kit.block(0.6, 0.04, 0.75, 1.35, 1.05, 3.75, M.deskTop);
    kit.block(0.75, 0.04, 1.5, 1.5, 0.72, 5.9, M.deskTop);
    kit.block(0.75, 0.72, 0.04, 1.5, 0, 5.17, M.deskWood);
    kit.block(0.75, 0.72, 0.04, 1.5, 0, 6.63, M.deskWood);
    kit.block(0.04, 0.45, 1.46, 1.86, 0.27, 5.9, M.deskWood);
    chair(kit, 0.85, 5.9, M.chairGreen, -0.19);
    // 서랍 (비밀번호 자물쇠)
    const drawer = new T.Group();
    const front = new T.Mesh(new T.BoxGeometry(0.05, 0.16, 0.56), lam(0xa47548));
    const knob = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.14), M.metal);
    knob.position.x = 0.035;
    const pad = new T.Mesh(new T.BoxGeometry(0.02, 0.1, 0.08), lam(0x222222));
    pad.position.set(0.035, 0, 0.2);
    const led = new T.Mesh(new T.BoxGeometry(0.01, 0.015, 0.015), new T.MeshBasicMaterial({ color: 0xff3b3b }));
    led.position.set(0.047, 0.03, 0.2);
    drawer.add(front, knob, pad, led);
    drawer.position.set(1.9, 0.62, 5.6);
    L.scene.add(drawer);
    L.tag(drawer, { action: 'drawer', label: '🔒 ' + (run.teacher ? run.teacher + ' ' : '') + '선생님 책상 서랍', reach: 2.6 });
    let drawerOpen = 0;
    L.openDrawer = () => {
      led.material = new T.MeshBasicMaterial({ color: 0x3bff7a });
      L.own(led.material);
      L.drawerOpening = true;
    };
    L.updaters.push((dt) => {
      if (L.drawerOpening && drawerOpen < 1) drawerOpen = Math.min(1, drawerOpen + dt * 2);
      drawer.position.x = 1.9 + drawerOpen * 0.35;
    });
    // 전기 촛불 (책상 위) — 호박 모양은 헷갈리니까 유리병 촛불
    kit.cyl(0.06, 0.07, 0.16, 1.6, 0.82, 6.4, new T.MeshLambertMaterial({ color: 0xffd9a0, emissive: 0x553300 }), 12);
    candleLight(L, 1.6, 1.05, 6.4, 0xffa860, 2.6);
    kit.block(0.3, 0.06, 0.22, 1.45, 0.76, 5.5, lam(0xf2efe8)); // 출석부
    // 선생님 이름표 (학생 쪽을 봐요)
    const signM = L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.label(run.teacher ? '담임 ' + run.teacher : '담임 선생님', '#f7f3e6', '#1b2233'))), alphaTest: 0.5 }));
    const sign = new T.Mesh(new T.PlaneGeometry(0.42, 0.105), signM);
    sign.position.set(1.84, 0.82, 6.0);
    sign.rotation.set(0, Math.PI / 2, 0);
    sign.rotateX(-0.35);
    L.scene.add(sign);
    kit.box(0.06, 0.1, 0.42, 1.8, 0.79, 6.0, M.darkWood);
    // 학생 책상 24개 (칠판을 봐요)
    const rows = [3.0, 4.1, 5.2, 6.3];
    const cols = [1.35, 2.0, 3.4, 4.05, 5.45, 6.1];
    rows.forEach((x, r) =>
      cols.forEach((z, c) => {
        studentDesk(kit, x, z);
        chair(kit, x + 0.48, z, (r + c) % 2 ? M.chairBlue : M.chairGreen);
        L.collide(x - 0.25, z - 0.33, x + 0.7, z + 0.33);
      })
    );
    L.collide(1.1, 3.35, 1.65, 4.15);
    L.collide(1.1, 5.1, 1.9, 6.7);
    L.collide(0.5, 5.6, 1.1, 6.2);
    // 뒤 사물함과 환경판 (뒤 벽 x = 9)
    kit.block(0.42, 0.9, 5.9, 8.79, 0, 3.95, lam(0x8a6a4a));
    // 사물함 이름표: 선생님이 반 친구 이름을 적어 두면 그 이름이 나와요
    const cub = run.friends && run.friends.length ? L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.cubbies(51, run.friends))) })) : tmat('cubbies', () => X.cubbies(51), { clamp: true });
    kit.panel(5.9, 0.9, 8.575, 0.45, 3.95, -Math.PI / 2, cub);
    L.collide(8.55, 0.98, 9, 6.92);
    const env = tmat('bulletin-class', () => X.bulletin(44, '우리 반 할로윈', true), { clamp: true });
    kit.panel(4.2, 1.15, 8.98, 1.85, 3.0, -Math.PI / 2, env);
    // 창가: 커튼, 학급 문고, 화분
    winHoles.forEach((hl) => {
      curtain(kit, hl.a + 0.2, D - 0.1, 1.75, Math.PI);
      curtain(kit, hl.b - 0.2, D - 0.1, 1.75, Math.PI);
      kit.box(hl.b - hl.a + 0.6, 0.03, 0.03, (hl.a + hl.b) / 2, 2.68, D - 0.12, M.metal);
    });
    shelf(kit, { axis: 'x', x: 4.7, z: D - 0.22, len: 2.0, h: 0.8, d: 0.32, face: -1, seed: 3 });
    L.collide(3.7, D - 0.4, 5.7, D);
    W3.plant(kit, 6.9, D - 0.25);
    // 쓰레기통 두 개 (뒷문 옆 구석)
    trashCan(kit, 8.68, 0.62);
    trashCan(kit, 8.2, 0.4, 0x3a5aa0);
    L.collide(7.98, 0.2, 8.9, 0.84);
    // 할로윈 장식 (호박·박쥐·거미 모양은 세는 것과 헷갈리니까 깃발만)
    garland(kit, 0.2, 1.2, 8.8, 1.2, 2.85);
    garland(kit, 0.2, 6.3, 8.8, 6.3, 2.85);

    kit.build(L.scene);

    // 숨은 호박·박쥐·거미
    const cnt = run.puzzles.classroom;
    L.items = []
      .concat(placeItems(L, PUMPKIN_AT, () => W3.pumpkin(0.11), 'pumpkin', cnt.slots.pumpkin))
      .concat(placeItems(L, BAT_AT, () => W3.bat(1.25), 'bat', cnt.slots.bat))
      .concat(placeItems(L, SPIDER_AT, () => W3.spider(1.3), 'spider', cnt.slots.spider));
    L.setMarked = (item, on) => {
      item.marked = on;
      item.mark.visible = on;
    };
    ghost(L, 2.2, 2.35, 6.6);
    return L;
  };
  R.PUMPKIN_AT = PUMPKIN_AT;
  R.BAT_AT = BAT_AT;
  R.SPIDER_AT = SPIDER_AT;

  function texFrom(canvas) {
    const t = new T.CanvasTexture(canvas);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  /* ================ 2. 과학실 ================ */
  R.science = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'science';
    const kit = new W3.Kit();
    const Wd = 10.5;
    const D = 7.5;
    const { doors } = shell(L, kit, { W: Wd, D, doors: [1.6, Wd - 1.6], floor: M.vinylBlue, wall: M.wallBlue });
    exitDoor(L, doors[1], Wd - 1.6);
    L.tag(doors[0], { action: 'lockedDoor', label: '앞문', reach: 2.4 });
    // 칠판: 물약 비율
    const boardM = L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.potionBoard(run.puzzles.science.recipes))) }));
    kit.box(0.05, 1.52, 4.8, 0.025, 1.65, 3.75, M.darkWood);
    const bd = board(L, boardM, 4.7, 1.42, 0.06, 1.65, 3.75, Math.PI / 2);
    L.tag(bd, { action: 'board', label: '🔍 칠판 보기', reach: 7 });
    // 교사 실험대 + 비커 세 개
    kit.block(0.8, 0.85, 2.6, 1.45, 0, 3.75, lam(0x3a3f48));
    kit.block(0.86, 0.04, 2.66, 1.45, 0.85, 3.75, M.black);
    L.collide(1.0, 2.4, 1.9, 5.1);
    const beakerAt = [
      ['빨강', 2.95],
      ['파랑', 3.75],
      ['노랑', 4.55],
    ];
    beakerAt.forEach(([color, z]) => {
      kit.cyl(0.12, 0.12, 0.26, 1.5, 1.02, z, lam(new T.Color(E.COLORS[color]).getHex(), { emissive: new T.Color(E.COLORS[color]).multiplyScalar(0.25).getHex() }), 14);
      const glass = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 0.36, 16, 1, true), M.glass);
      glass.position.set(1.5, 1.05, z);
      L.scene.add(glass);
    });
    // 마녀의 솥 (교사 실험대 앞)
    const cauldron = new T.Group();
    const pot = new T.Mesh(new T.SphereGeometry(0.55, 24, 16, 0, TAU, Math.PI * 0.28, Math.PI * 0.72), new T.MeshLambertMaterial({ color: 0x1c1b22, side: T.DoubleSide }));
    pot.scale.set(1, 0.8, 1);
    pot.position.y = 0.55;
    const rim = new T.Mesh(new T.TorusGeometry(0.43, 0.05, 8, 24), lam(0x2c2b33));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.9;
    const liquidMat = L.own(new T.MeshBasicMaterial({ color: 0x3a4a3a }));
    const liquid = new T.Mesh(new T.CircleGeometry(0.42, 24), liquidMat);
    liquid.rotation.x = -Math.PI / 2;
    liquid.position.y = 0.86;
    cauldron.add(pot, rim, liquid);
    [0, 1, 2].forEach((i) => {
      const leg = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.3, 6), lam(0x1c1b22));
      const a = (i / 3) * TAU;
      leg.position.set(Math.cos(a) * 0.35, 0.12, Math.sin(a) * 0.35);
      cauldron.add(leg);
    });
    // 보글보글 거품
    const bubbles = [];
    const bubbleMat = L.own(new T.MeshBasicMaterial({ color: 0xbfffd0, transparent: true, opacity: 0.7 }));
    for (let i = 0; i < 6; i++) {
      const b = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), bubbleMat);
      cauldron.add(b);
      bubbles.push(b);
    }
    cauldron.position.set(2.75, 0, 3.75);
    L.scene.add(cauldron);
    L.tag(cauldron, { action: 'cauldron', label: '🧪 마녀의 솥', reach: 2.6 });
    L.collide(2.15, 3.15, 3.35, 4.35);
    const glowLight = new T.PointLight(0x7aff9a, 2.5, 5, 1.4);
    glowLight.position.set(2.75, 1.4, 3.75);
    L.scene.add(glowLight);
    let puff = 0;
    L.setCauldron = (hex) => {
      liquidMat.color.set(hex);
      bubbleMat.color.set(new T.Color(hex).lerp(new T.Color(0xffffff), 0.5));
      glowLight.color.set(hex);
    };
    L.puff = () => (puff = 1);
    L.setCauldron('#47d17a');
    L.updaters.push((dt, t) => {
      bubbles.forEach((b, i) => {
        const k = (t * 0.6 + i / 6) % 1;
        const a = i * 2.1 + t * 0.4;
        b.position.set(Math.cos(a) * 0.25 * (1 - k * 0.3), 0.87 + k * 0.3, Math.sin(a) * 0.25 * (1 - k * 0.3));
        b.scale.setScalar(0.6 + k * (0.8 + puff * 2));
      });
      bubbleMat.opacity = 0.7 * (1 - ((t * 0.6) % 1) * 0.5);
      if (puff > 0) puff = Math.max(0, puff - dt * 1.2);
      glowLight.intensity = 2.2 + Math.sin(t * 5) * 0.4 + puff * 4;
    });
    // 학생 실험대 6개 (개수대 + 수도꼭지) 와 둥근 의자
    [4.5, 6.5, 8.5].forEach((x) =>
      [2.75, 5.65].forEach((z) => {
        kit.block(1.15, 0.82, 1.9, x, 0, z, lam(0x2e5a7a));
        kit.block(1.2, 0.04, 1.95, x, 0.82, z, M.black);
        kit.block(0.4, 0.02, 0.5, x, 0.86, z, lam(0x55606c));
        kit.cyl(0.02, 0.02, 0.3, x, 1.0, z - 0.32, M.metal, 8);
        kit.box(0.03, 0.03, 0.18, x, 1.14, z - 0.24, M.metal);
        [-0.75, 0.75].forEach((dx) => [-0.55, 0.55].forEach((dz) => stool(kit, x + dx, z + dz)));
        L.collide(x - 0.62, z - 1.0, x + 0.62, z + 1.0);
        // 플라스크 몇 개
        kit.cyl(0.04, 0.09, 0.18, x + 0.3, 0.93, z + 0.5, lam(0x9ff0d8, { emissive: 0x0f3a2a }), 10);
      })
    );
    // 뒤쪽 약품장 (유리장 안에 병들)
    kit.block(0.45, 2.0, 5.0, Wd - 0.25, 0, 3.75, lam(0x5a6b7a));
    kit.panel(5.0, 1.9, Wd - 0.48, 1.0, 3.75, -Math.PI / 2, tmat('chemShelf', () => X.medicine(93, true), { clamp: true }));
    L.collide(Wd - 0.5, 1.2, Wd, 6.3);
    // 해골 모형 (구석)
    const bone = lam(0xeae2cc);
    kit.sphere(0.12, 0.6, 1.62, 6.9, bone, 1.1);
    kit.cyl(0.03, 0.03, 0.6, 0.6, 1.2, 6.9, bone, 6);
    for (let i = 0; i < 4; i++) kit.box(0.04, 0.03, 0.34 - i * 0.04, 0.6, 1.42 - i * 0.09, 6.9, bone);
    kit.box(0.04, 0.6, 0.04, 0.6, 0.6, 6.78, bone);
    kit.box(0.04, 0.6, 0.04, 0.6, 0.6, 7.02, bone);
    kit.cyl(0.2, 0.25, 0.06, 0.6, 0.03, 6.9, M.darkWood, 12);
    kit.cyl(0.015, 0.015, 1.6, 0.6, 0.85, 6.6, M.metal, 6);
    L.collide(0.3, 6.6, 0.9, 7.2);
    poster(kit, 'safety-sci', () => X.safetyPoster(2), 0.6, 0.82, 4.0, 1.6, 0.03, 0);
    poster(kit, 'halloween', () => X.halloweenPoster(), 0.62, 0.85, 6.0, 1.6, 0.03, 0);
    kit.build(L.scene);
    ghost(L, 1.6, 2.35, 6.4);
    return L;
  };

  /* ================ 3. 도서관 ================ */
  // 빛나는 책이 꽂힐 수 있는 자리: [x, y, z, ry]
  const BOOK_AT = [
    [0.38, 0.55, 1.6, Math.PI / 2],
    [0.38, 1.85, 3.2, Math.PI / 2],
    [0.38, 1.0, 5.6, Math.PI / 2],
    [2.6, 0.95, 2.4 - 0.2, Math.PI],
    [4.9, 0.25, 2.4 - 0.2, Math.PI],
    [3.8, 1.45, 2.4 + 0.2, 0],
    [6.0, 0.6, 2.4 + 0.2, 0],
    [2.9, 1.3, 4.6 - 0.2, Math.PI],
    [5.4, 0.95, 4.6 + 0.2, 0],
    [3.4, 0.5, 7.5 - 0.37, Math.PI],
    [7.2, 0.5, 7.5 - 0.37, Math.PI],
    [10.12, 1.4, 4.3, -Math.PI / 2],
  ];
  R.BOOK_AT = BOOK_AT;
  R.library = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'library';
    const kit = new W3.Kit();
    const Wd = 10.5;
    const D = 7.5;
    const { doors } = shell(L, kit, { W: Wd, D, doors: [1.6, Wd - 1.6], floor: M.wood, wall: M.wallClass });
    exitDoor(L, doors[1], Wd - 1.6);
    L.tag(doors[0], { action: 'lockedDoor', label: '앞문', reach: 2.4 });
    // 벽 책장
    shelf(kit, { axis: 'z', x: 0.2, z: 3.75, len: 6.4, h: 2.3, face: 1, seed: 1 });
    L.collide(0, 0.5, 0.4, 7.0);
    shelf(kit, { axis: 'z', x: Wd - 0.2, z: 4.3, len: 4.4, h: 2.3, face: -1, seed: 2 });
    L.collide(Wd - 0.4, 2.1, Wd, 6.5);
    // 가운데 양면 책장 두 줄
    [2.4, 4.6].forEach((z, i) => {
      shelf(kit, { axis: 'x', x: 4.3, z: z - 0.1, len: 4.0, h: 1.7, d: 0.2, face: -1, seed: 4 + i });
      shelf(kit, { axis: 'x', x: 4.3, z: z + 0.1, len: 4.0, h: 1.7, d: 0.2, face: 1, seed: 6 + i });
      L.collide(2.25, z - 0.25, 6.35, z + 0.25);
    });
    // 창가 낮은 책장
    shelf(kit, { axis: 'x', x: 5.3, z: D - 0.2, len: 7.0, h: 0.8, d: 0.34, face: -1, seed: 8 });
    L.collide(1.8, D - 0.4, 8.8, D);
    // 읽는 탁자
    [
      [8.2, 3.3],
      [8.2, 5.5],
    ].forEach(([x, z]) => {
      kit.block(1.3, 0.04, 1.6, x, 0.7, z, M.deskTop);
      kit.block(0.08, 0.7, 0.08, x - 0.55, 0, z - 0.7, M.metal);
      kit.block(0.08, 0.7, 0.08, x + 0.55, 0, z - 0.7, M.metal);
      kit.block(0.08, 0.7, 0.08, x - 0.55, 0, z + 0.7, M.metal);
      kit.block(0.08, 0.7, 0.08, x + 0.55, 0, z + 0.7, M.metal);
      chair(kit, x - 0.95, z - 0.4, M.chairBlue, -0.19);
      chair(kit, x - 0.95, z + 0.4, M.chairGreen, -0.19);
      L.collide(x - 0.7, z - 0.85, x + 0.7, z + 0.85);
    });
    // 대출대
    kit.block(1.8, 0.95, 0.6, 7.6, 0, 1.25, M.deskWood);
    kit.block(1.86, 0.04, 0.66, 7.6, 0.95, 1.25, M.deskTop);
    kit.block(0.45, 0.32, 0.05, 7.2, 1.0, 1.35, M.black);
    kit.panel(0.42, 0.28, 7.2, 1.16, 1.32, Math.PI, glowMat('libScreen', () => X.screen(['도서 대출', '반납일 확인'])));
    L.collide(6.65, 0.9, 8.55, 1.6);
    const quiet = tmat('quietSign', () => X.label('도서관에서는 조용히', '#2b6cb0', '#fff'), { clamp: true });
    kit.panel(1.4, 0.35, 5.2, 2.55, 0.03, 0, quiet);
    // 십진분류 포스터 (누르면 크게)
    const kdcM = tmat('kdc', () => X.kdcPoster(), { clamp: true });
    const kdc = board(L, kdcM, 0.66, 1.0, 9.9, 1.6, 0.03, 0);
    L.tag(kdc, { action: 'poster', poster: 'kdc', label: '🔍 포스터 보기', reach: 4 });
    // 독서 쿠션
    kit.cyl(0.35, 0.38, 0.25, 9.2, 0.12, 6.7, lam(0xff8a1f), 16);
    kit.cyl(0.35, 0.38, 0.25, 9.9, 0.12, 6.2, lam(0x9b4dd8), 16);
    kit.build(L.scene);

    // 빛나는 속담 책
    const lib = run.puzzles.library;
    L.books = lib.slots.map((slot, i) => {
      const at = BOOK_AT[slot];
      const grp = new T.Group();
      const mat = L.own(new T.MeshLambertMaterial({ color: 0xc58bff, emissive: 0x8a2be2 }));
      const book = new T.Mesh(new T.BoxGeometry(0.07, 0.27, 0.2), mat);
      book.position.z = 0.03; // 책장에서 조금 튀어나와요
      grp.add(book);
      const halo = W3.sprite('bookGlow', () => X.glow('rgba(200,130,255,1)'), 0.8, 0.8);
      halo.material = halo.material.clone();
      L.own(halo.material);
      halo.material.blending = T.AdditiveBlending;
      halo.material.depthWrite = false;
      grp.add(halo);
      grp.position.set(at[0], at[1] + 0.13, at[2]);
      grp.rotation.y = at[3];
      L.scene.add(grp);
      const entry = { i, slot, obj: grp, mat, halo, done: false };
      L.tag(grp, { action: 'book', book: i, label: '📕 빛나는 책', reach: 2.8 });
      return entry;
    });
    L.bookDone = (i) => {
      const b = L.books[i];
      b.done = true;
      b.mat.emissive.set(0x103a20);
      b.mat.color.set(0x2fbf71);
      b.halo.visible = false;
    };
    L.updaters.push((dt, t) => {
      L.books.forEach((b, i) => {
        if (b.done) return;
        const k = 0.5 + 0.5 * Math.sin(t * 3 + i);
        b.halo.material.opacity = 0.55 + 0.4 * k;
        b.halo.scale.setScalar(0.7 + 0.25 * k);
        b.mat.emissive.setRGB(0.45 + 0.3 * k, 0.12 + 0.1 * k, 0.75 + 0.2 * k);
      });
    });
    ghost(L, 3.0, 2.3, 6.6);
    return L;
  };

  /* ================ 4. 방송실 ================ */
  R.broadcast = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'broadcast';
    const kit = new W3.Kit();
    const Wd = 7.5;
    const D = 7.5;
    const { doors } = shell(L, kit, { W: Wd, D, doors: [Wd / 2], floor: M.vinyl, wall: M.foam, left: M.foam, right: M.foam, windows: false, fog: 0.03 });
    exitDoor(L, doors[0], Wd / 2);
    // 방송 장비 책상 (안쪽 벽)
    kit.block(5.2, 0.78, 0.9, Wd / 2, 0, D - 0.55, lam(0x2a2d36));
    kit.add(W3.rect(5.0, 0.7, 0, 0, 1, 1), tmat('consoleTop', () => X.console(), { clamp: true }), Wd / 2, 0.84, D - 0.6, 0, -1.2);
    L.collide(Wd / 2 - 2.65, D - 1.05, Wd / 2 + 2.65, D);
    // 모니터 두 대
    [Wd / 2 - 1.2, Wd / 2 + 1.2].forEach((x, i) => {
      kit.block(0.9, 0.55, 0.06, x, 1.2, D - 0.25, M.black);
      kit.panel(0.84, 0.5, x, 1.475, D - 0.28, Math.PI, glowMat('bcScreen' + i, () => X.screen(i ? ['아침 방송', '08:40'] : ['동암 방송국', 'DBS'], i ? '#ffd166' : '#9ff0d8')));
      kit.box(0.08, 0.4, 0.08, x, 1.0, D - 0.25, M.darkMetal);
    });
    // 마이크
    kit.cyl(0.012, 0.012, 0.45, Wd / 2 + 0.3, 1.0, D - 0.75, M.darkMetal, 6);
    kit.sphere(0.06, Wd / 2 + 0.3, 1.25, D - 0.8, lam(0x333333), 1.4);
    // 스피커
    [0.5, Wd - 0.5].forEach((x) => {
      kit.block(0.5, 0.8, 0.4, x, 1.6, D - 0.3, lam(0x1b1d24));
      kit.cyl(0.15, 0.15, 0.02, x, 2.05, D - 0.5, M.darkMetal, 16, Math.PI / 2);
      kit.cyl(0.08, 0.08, 0.02, x, 1.75, D - 0.5, M.darkMetal, 16, Math.PI / 2);
    });
    // 촬영 카메라 (삼각대)
    kit.block(0.3, 0.25, 0.45, 2.0, 1.35, 3.6, M.black);
    kit.cyl(0.07, 0.08, 0.15, 2.0, 1.47, 3.32, M.darkMetal, 12, Math.PI / 2);
    [0, 1, 2].forEach((i) => {
      const a = (i / 3) * TAU;
      kit.add(new T.CylinderGeometry(0.015, 0.015, 1.4, 6), M.metal, 2.0 + Math.cos(a) * 0.25, 0.66, 3.6 + Math.sin(a) * 0.25, 0, Math.sin(a) * 0.35, -Math.cos(a) * 0.35);
    });
    L.collide(1.6, 3.2, 2.4, 4.0);
    // 아나운서 탁자
    kit.block(1.6, 0.04, 0.8, 5.6, 0.72, 3.4, M.deskTop);
    kit.block(1.5, 0.72, 0.05, 5.6, 0, 3.75, M.deskWood);
    chair(kit, 5.3, 2.7, M.chairBlue, 0);
    chair(kit, 5.9, 2.7, M.chairGreen, 0);
    L.collide(4.75, 2.95, 6.45, 3.85);
    // ON AIR 등
    const onM = L.own(new T.MeshBasicMaterial({ map: W3.tex('onAirOn', () => X.onAir(true), { clamp: true }) }));
    const offM = L.own(new T.MeshLambertMaterial({ map: W3.tex('onAirOff', () => X.onAir(false), { clamp: true }) }));
    const lamp = new T.Mesh(new T.PlaneGeometry(1.2, 0.38), offM);
    lamp.position.set(Wd / 2, 2.55, D - 0.04);
    lamp.rotation.y = Math.PI;
    L.scene.add(lamp);
    const lampLight = new T.PointLight(0xff3030, 0, 6, 1.3);
    lampLight.position.set(Wd / 2, 2.4, D - 0.6);
    L.scene.add(lampLight);
    L.setOnAir = (on) => {
      lamp.material = on ? onM : offM;
      lampLight.intensity = on ? 6 : 0;
    };
    // 모스 부호표 (왼쪽 벽, 누르면 크게)
    const morseM = tmat('morse', () => X.morsePoster(E.MORSE), { clamp: true });
    kit.box(0.03, 1.36, 0.92, 0.02, 1.6, 3.4, M.frameDark);
    const ps = board(L, morseM, 0.86, 1.28, 0.045, 1.6, 3.4, Math.PI / 2);
    L.tag(ps, { action: 'poster', poster: 'morse', label: '🔍 모스 부호표 보기', reach: 5 });
    // 장비 (누르면 수수께끼)
    const panelHit = new T.Mesh(new T.BoxGeometry(5.0, 0.4, 0.8), new T.MeshBasicMaterial({ visible: false }));
    panelHit.position.set(Wd / 2, 0.95, D - 0.6);
    L.scene.add(panelHit);
    L.tag(panelHit, { action: 'console', label: '📢 방송 장비', reach: 2.8 });
    // 바닥 전선
    kit.box(3.0, 0.02, 0.03, 3.0, 0.01, D - 1.3, M.black);
    kit.box(0.03, 0.02, 2.0, 1.4, 0.01, 5.0, M.black);
    kit.build(L.scene);
    ghost(L, 1.2, 2.0, 5.6);
    return L;
  };

  /* ================ 5. 교무실 ================ */
  R.office = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'office';
    const kit = new W3.Kit();
    const Wd = 10.5;
    const D = 7.5;
    const { doors } = shell(L, kit, { W: Wd, D, doors: [1.6, Wd - 1.6], floor: M.vinyl, wall: M.wallPink });
    exitDoor(L, doors[0], 1.6);
    L.tag(doors[1], { action: 'lockedDoor', label: '뒷문', reach: 2.4 });
    const office = run.puzzles.office;
    // 화이트보드 (오른쪽 벽 x = W): 자리 단서
    const lines = office.clues.map((c) => E.clueText(office, c));
    const wbM = L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.officeBoard(lines))) }));
    kit.box(0.04, 1.42, 2.56, Wd - 0.02, 1.6, 3.4, M.frame);
    const wb = board(L, wbM, 2.5, 1.36, Wd - 0.05, 1.6, 3.4, -Math.PI / 2);
    L.tag(wb, { action: 'clues', label: '🔍 화이트보드 보기', reach: 6 });
    // 선생님 책상 다섯 (문에서 볼 때 왼쪽부터 1~5번: 왼쪽 = x 큰 쪽)
    const seatX = [8.6, 7.1, 5.6, 4.1, 2.6];
    L.desks = seatX.map((x, seat) => {
      const z = 4.9;
      kit.block(1.3, 0.04, 0.75, x, 0.72, z, lam(0xe6dccb));
      kit.block(0.05, 0.72, 0.72, x - 0.62, 0, z, M.metal);
      kit.block(0.4, 0.66, 0.7, x + 0.42, 0, z, lam(0x8a96a6));
      kit.block(0.55, 0.38, 0.05, x - 0.1, 0.78, z + 0.25, M.black);
      kit.panel(0.5, 0.33, x - 0.1, 0.97, z + 0.22, Math.PI, glowMat('ofScreen', () => X.screen(['잠금 화면'], '#9fb4ff')));
      kit.box(0.42, 0.02, 0.15, x - 0.1, 0.75, z - 0.1, lam(0xd8d8d8));
      kit.cyl(0.04, 0.035, 0.1, x + 0.4, 0.79, z - 0.2, seat % 2 ? M.white : M.red, 10);
      chair(kit, x, z - 0.75, lam(0x2b2d36), -0.19);
      L.collide(x - 0.68, z - 0.4, x + 0.68, z + 0.4);
      // 자리 번호판과 이름표
      const num = tmat('seatNum' + (seat + 1), () => X.label(seat + 1 + '번 자리', '#2b6cb0', '#fff'), { clamp: true });
      kit.panel(0.6, 0.15, x, 0.6, z - 0.385, Math.PI, num);
      const card = new T.Mesh(new T.PlaneGeometry(0.42, 0.11), L.own(new T.MeshLambertMaterial({ color: 0xf7f3e6 })));
      card.position.set(x + 0.2, 0.82, z - 0.3);
      card.rotation.set(-0.4, Math.PI, 0);
      L.scene.add(card);
      const hit = new T.Mesh(new T.BoxGeometry(1.3, 0.9, 0.8), new T.MeshBasicMaterial({ visible: false }));
      hit.position.set(x, 0.45, z);
      L.scene.add(hit);
      L.tag(hit, { action: 'seats', seat, label: '🪑 ' + (seat + 1) + '번 책상', reach: 2.6 });
      return { x, z, card };
    });
    L.setNames = (names) => {
      L.desks.forEach((d, seat) => {
        if (!names[seat]) return;
        d.card.material.map = L.own(texFrom(X.label(names[seat] + ' 선생님', '#f7f3e6', '#1b2233')));
        d.card.material.needsUpdate = true;
      });
    };
    // 복사기, 서류함, 우편함, 정수기, 컴퓨터 책상 (꾸밈)
    kit.block(0.7, 1.1, 0.6, 0.6, 0, 6.8, lam(0xd8d8d0));
    kit.block(0.72, 0.1, 0.62, 0.6, 1.1, 6.8, lam(0x5a5a62));
    L.collide(0.25, 6.45, 0.95, 7.15);
    kit.block(0.45, 1.3, 1.6, 0.25, 0, 4.0, lam(0x8a96a6));
    L.collide(0, 3.2, 0.5, 4.8);
    kit.block(0.4, 1.2, 1.8, 0.22, 1.35, 1.9, lam(0x8a6a4a));
    kit.panel(1.8, 1.2, 0.43, 1.95, 1.9, Math.PI / 2, tmat('cubbies', () => X.cubbies(51), { clamp: true }), [0, 0, 0.5, 1]);
    kit.block(0.35, 1.2, 0.35, Wd - 0.3, 0, 6.9, lam(0xe8ecef));
    kit.block(0.2, 0.25, 0.2, Wd - 0.3, 1.2, 6.9, lam(0x7ab8e8));
    L.collide(Wd - 0.5, 6.7, Wd, 7.1);
    W3.plant(kit, 5.2, D - 0.3);
    poster(kit, 'calendar', () => X.calendar(), 0.5, 0.58, 4.0, 1.6, 0.03, 0);
    poster(kit, 'safety-of', () => X.safetyPoster(1), 0.6, 0.82, 5.3, 1.6, 0.03, 0);
    kit.build(L.scene);
    ghost(L, 9.4, 2.1, 2.2);
    return L;
  };

  /* ================ 6. 보건실 ================ */
  const NOTE_AT = [
    [1.35, 0.68, 6.7, 0, -Math.PI / 2],
    [3.45, 0.67, 6.1, 0.3, -Math.PI / 2],
    [1.3, 0.77, 1.75, 0.5, -Math.PI / 2],
    [6.55, 0.09, 6.55, 0, -Math.PI / 2],
    [0.06, 0.92, 4.5, Math.PI / 2, 0],
    [6.3, 0.9, 0.42, 0, -Math.PI / 2],
    [7.0, 1.93, 3.0, 0, -Math.PI / 2],
    [2.4, 0.01, 6.4, 1.2, -Math.PI / 2],
  ];
  R.NOTE_AT = NOTE_AT;
  R.nurse = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'nurse';
    const kit = new W3.Kit();
    const Wd = 7.5;
    const D = 7.5;
    const { doors } = shell(L, kit, { W: Wd, D, doors: [Wd / 2], floor: M.vinyl, wall: M.wall });
    exitDoor(L, doors[0], Wd / 2);
    // 침대 두 개와 커튼
    const sheet = lam(0xf4f6f8);
    [1.35, 3.45].forEach((x, i) => {
      kit.block(0.95, 0.42, 2.0, x, 0, 6.3, M.metal);
      kit.block(0.95, 0.18, 2.0, x, 0.42, 6.3, sheet);
      kit.block(0.7, 0.12, 0.4, x, 0.6, 7.0, lam(0xdfe9f5));
      kit.block(0.95, 0.05, 1.2, x, 0.6, 5.95, lam(i ? 0x9fc3e8 : 0xf2c6d6));
      L.collide(x - 0.5, 5.25, x + 0.5, 7.35);
      // 커튼 레일과 반쯤 친 커튼
      kit.box(0.03, 0.03, 2.2, x + 0.62, 2.6, 6.3, M.metal);
      kit.panel(1.2, 2.2, x + 0.62, 1.5, 5.8, Math.PI / 2, lam(0xbcd6e8, { side: T.DoubleSide }));
    });
    // 곰 인형
    kit.sphere(0.12, 3.6, 0.75, 6.8, lam(0xb07a4a));
    kit.sphere(0.08, 3.6, 0.93, 6.8, lam(0xb07a4a));
    // 보건 선생님 책상
    kit.block(1.4, 0.04, 0.7, 1.3, 0.72, 1.6, lam(0xe6dccb));
    kit.block(0.05, 0.72, 0.66, 0.62, 0, 1.6, M.metal);
    kit.block(0.45, 0.66, 0.66, 1.75, 0, 1.6, lam(0x8a96a6));
    kit.block(0.5, 0.35, 0.05, 1.1, 0.78, 1.9, M.black);
    kit.panel(0.46, 0.3, 1.1, 0.955, 1.87, Math.PI, glowMat('nurseScreen', () => X.screen(['보건실', '체온 36.5℃'], '#ffb3c6')));
    chair(kit, 1.3, 1.0, lam(0x2b2d36), 0);
    L.collide(0.55, 1.2, 2.05, 2.0);
    // 약장 (오른쪽 벽) + 비밀번호 자물쇠
    kit.block(0.42, 1.85, 1.3, Wd - 0.22, 0.05, 3.0, lam(0xdfe6ec));
    const cab = new T.Mesh(new T.PlaneGeometry(1.24, 1.78), tmat('medicine', () => X.medicine(91), { clamp: true }));
    cab.position.set(Wd - 0.435, 0.97, 3.0);
    cab.rotation.y = -Math.PI / 2;
    L.scene.add(cab);
    const keypad = new T.Mesh(new T.BoxGeometry(0.03, 0.16, 0.11), lam(0x222222));
    keypad.position.set(Wd - 0.45, 1.05, 3.72);
    L.scene.add(keypad);
    const cabLed = new T.Mesh(new T.BoxGeometry(0.01, 0.02, 0.02), L.own(new T.MeshBasicMaterial({ color: 0xff3b3b })));
    cabLed.position.set(Wd - 0.465, 1.15, 3.72);
    L.scene.add(cabLed);
    L.tag(cab, { action: 'cabinet', label: '🔒 약장', reach: 2.6 });
    L.tag(keypad, { action: 'cabinet', label: '🔒 약장', reach: 2.6 });
    L.collide(Wd - 0.45, 2.3, Wd, 3.7);
    L.openCabinet = () => cabLed.material.color.set(0x3bff7a);
    // 체중계와 키 재기 자
    kit.block(0.36, 0.07, 0.4, 6.55, 0, 6.55, lam(0xe8ecef));
    kit.panel(0.3, 2.0, Wd - 0.02, 1.2, 6.55, -Math.PI / 2, tmat('height', () => X.heightChart(), { clamp: true }));
    // 시력표 (왼쪽 벽)
    poster(kit, 'eye', () => X.eyeChart(), 0.5, 1.0, 0.03, 1.5, 4.5, Math.PI / 2);
    // 세면대와 거울 (문 벽)
    kit.block(0.6, 0.85, 0.42, 6.3, 0, 0.22, lam(0xf2f2f2));
    kit.box(0.5, 0.6, 0.02, 6.3, 1.5, 0.02, lam(0xb8c8d8, { emissive: 0x101820 }));
    L.collide(5.95, 0, 6.65, 0.45);
    poster(kit, 'safety-wash', () => X.safetyPoster(2), 0.55, 0.75, 5.2, 1.55, 0.03, 0);
    kit.build(L.scene);
    // 처방전 쪽지
    const nurse = run.puzzles.nurse;
    L.notes = nurse.slots.map((slot, i) => {
      const at = NOTE_AT[slot];
      const m = L.own(new T.MeshLambertMaterial({ map: L.own(texFrom(X.note(nurse.notes[i], i + 1))), side: T.DoubleSide }));
      const note = new T.Mesh(new T.PlaneGeometry(0.34, 0.22), m);
      note.position.set(at[0], at[1], at[2]);
      note.rotation.set(at[4] || 0, at[3] || 0, 0, 'YXZ');
      L.scene.add(note);
      L.tag(note, { action: 'note', note: i, label: '📄 쪽지 줍기', reach: 2.6 });
      return { i, obj: note, found: false };
    });
    L.noteFound = (i) => {
      const n = L.notes[i];
      n.found = true;
      n.obj.visible = false;
      L.untag(n.obj);
    };
    ghost(L, 5.6, 2.1, 4.6);
    return L;
  };

  /* ================ 중앙 현관 (마지막) ================ */
  R.entrance = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('room');
    L.room = 'exit';
    const kit = new W3.Kit();
    const Wd = 10;
    const D = 6.5;
    shell(L, kit, { W: Wd, D, doors: [Wd / 2], floor: M.hallFloor2, wall: M.wallBlue, windows: false, farHoles: [{ a: Wd / 2 - 1.5, b: Wd / 2 + 1.5, y0: 0, y1: 2.45 }] });
    L.spawn = { x: Wd / 2, z: 0.9, yaw: Math.PI };
    // 유리 현관문 (z = D 쪽 벽을 덮어요)
    const yard = glowMat('yard', () => X.yard(), { tint: 0xa8b0d0 });
    kit.panel(3.2, 2.5, Wd / 2, 1.25, D + 0.6, Math.PI, yard);
    const doorL = new T.Group();
    const doorR = new T.Group();
    [doorL, doorR].forEach((grp, i) => {
      const side = i ? 1 : -1;
      const glass = new T.Mesh(new T.PlaneGeometry(1.5, 2.4), M.glass);
      glass.position.set(side * 0.75, 1.2, 0);
      const frameM = M.frameDark;
      [
        [1.5, 0.08, side * 0.75, 2.4],
        [1.5, 0.12, side * 0.75, 0.06],
        [0.08, 2.4, side * 1.5, 1.2],
        [0.08, 2.4, side * 0.04, 1.2],
      ].forEach(([w, h, x, y]) => {
        const m = new T.Mesh(new T.BoxGeometry(w, h, 0.08), frameM);
        m.position.set(x, y, 0);
        grp.add(m);
      });
      const handle = new T.Mesh(new T.BoxGeometry(0.04, 0.5, 0.06), M.metal);
      handle.position.set(side * 0.15, 1.1, -0.06);
      grp.add(glass, handle);
      grp.position.set(Wd / 2 + side * 1.5, 0, D - 0.04);
      grp.children.forEach((c) => (c.position.x -= side * 1.5));
      L.scene.add(grp);
    });
    // 사슬과 자물쇠
    const lockGrp = new T.Group();
    const chainM = lam(0x9a9aa2);
    for (let i = 0; i < 9; i++) {
      const link = new T.Mesh(new T.TorusGeometry(0.045, 0.012, 6, 10), chainM);
      link.position.set(-0.32 + i * 0.08, Math.sin((i / 8) * Math.PI) * -0.06, 0);
      link.rotation.y = i % 2 ? Math.PI / 2 : 0;
      lockGrp.add(link);
    }
    const body = new T.Mesh(new T.BoxGeometry(0.2, 0.18, 0.08), lam(0xc9a227, { emissive: 0x2a1f00 }));
    body.position.set(0, -0.16, 0.02);
    const shackle = new T.Mesh(new T.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), M.metal);
    shackle.position.set(0, -0.07, 0.02);
    lockGrp.add(body, shackle);
    lockGrp.position.set(Wd / 2, 1.15, D - 0.12);
    L.scene.add(lockGrp);
    L.tag(lockGrp, { action: 'lock', label: '🔒 현관 자물쇠', reach: 2.6 });
    L.collide(Wd / 2 - 1.6, D - 0.5, Wd / 2 + 1.6, D);
    // 현판·신발장·트로피장·할로윈 포스터
    kit.panel(3.0, 0.75, Wd / 2, 2.72, D - 0.05, Math.PI, tmat('plaque-' + run.school, () => X.plaque(run.school), { clamp: true }));
    [0.3, Wd - 0.3].forEach((x, i) => {
      kit.block(0.6, 1.5, 4.5, x, 0, 3.3, lam(0x7a5a3a));
      kit.panel(4.5, 1.5, x + (i ? -0.31 : 0.31), 0.75, 3.3, i ? -Math.PI / 2 : Math.PI / 2, tmat('shoes', () => X.shoeLockers(81)), [0, 0, 3, 1]);
      L.collide(i ? x - 0.3 : 0, 1.0, i ? Wd : x + 0.3, 5.6);
    });
    kit.panel(1.2, 1.2, 1.6, 1.4, D - 0.05, Math.PI, tmat('trophies', () => X.trophies(), { clamp: true }));
    kit.panel(0.6, 0.82, Wd - 1.6, 1.5, D - 0.05, Math.PI, tmat('halloween', () => X.halloweenPoster(), { clamp: true }));
    kit.flat(2.4, 1.2, Wd / 2, 0.012, D - 1.2, lam(0x7a2a2a));
    kit.build(L.scene);
    // 풀림과 문 열기
    let drop = 0;
    let unlocked = false;
    L.unlock = () => (unlocked = true);
    L.doorOpen = 0;
    L.updaters.push((dt) => {
      if (unlocked && drop < 1) drop = Math.min(1, drop + dt * 1.6);
      lockGrp.position.y = 1.15 - drop * drop * 1.1;
      lockGrp.rotation.z = drop * 0.8;
      doorL.rotation.y = -L.doorOpen * 1.3;
      doorR.rotation.y = L.doorOpen * 1.3;
    });
    candleLight(L, Wd / 2, 2.2, D - 1.2, 0xc8d8ff, 1.2);
    ghost(L, Wd / 2 + 2.2, 2.0, D - 1.5);
    return L;
  };

  /* ================ 운동장 (탈출 성공!) ================ */
  R.outside = function (run) {
    W3.setupMaterials();
    const L = new W3.Level('outside');
    L.scene.background = new T.Color(0x070a1c);
    L.scene.fog = new T.Fog(0x070a1c, 30, 90);
    L.scene.add(new T.AmbientLight(0x5060a0, 1.3));
    L.scene.add(new T.HemisphereLight(0x8090d0, 0x403018, 1.1));
    const kit = new W3.Kit();
    kit.flat(120, 120, 0, 0, -40, lam(0x3a3326), [0, 0, 30, 30]);
    // 학교 건물 (뒤쪽, 창문 몇 개에 불)
    const bld = lam(0x2a2d40);
    kit.block(40, 12, 8, 0, 0, 10, bld);
    const r = X.rand(7);
    const lit = L.own(new T.MeshBasicMaterial({ color: 0xffd98a }));
    for (let f = 0; f < 3; f++)
      for (let i = 0; i < 16; i++) kit.box(1.4, 1.2, 0.05, -18 + i * 2.4, 2 + f * 3.4, 5.97, r() < 0.15 ? lit : lam(0x3a4060));
    // 나무와 축구 골대
    for (let i = 0; i < 10; i++) {
      const x = -30 + i * 6.5 + r() * 2;
      kit.cyl(0.25, 0.3, 3, x, 1.5, -45 - r() * 8, lam(0x2a1a10), 8);
      kit.sphere(2.2, x, 4.2, -45 - r() * 8, lam(0x12241a));
    }
    kit.box(7.3, 0.12, 0.12, 0, 2.44, -30, M.white);
    kit.box(0.12, 2.44, 0.12, -3.6, 1.22, -30, M.white);
    kit.box(0.12, 2.44, 0.12, 3.6, 1.22, -30, M.white);
    kit.build(L.scene);
    const moon = W3.sprite('moon', () => X.glow('rgba(255,243,207,1)'), 14, 14);
    moon.position.set(18, 26, -60);
    L.scene.add(moon);
    const moonCore = W3.sprite('moonCore', () => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fff3cf';
      g.beginPath();
      g.arc(64, 64, 56, 0, TAU);
      g.fill();
      return c;
    }, 5, 5);
    moonCore.position.set(18, 26, -59);
    L.scene.add(moonCore);
    // 별
    const starGeo = new T.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 400; i++) {
      const a = r() * TAU;
      const e = 0.15 + r() * 1.2;
      sp.push(Math.cos(a) * Math.cos(e) * 80, Math.sin(e) * 80, Math.sin(a) * Math.cos(e) * 80 - 20);
    }
    starGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    L.scene.add(new T.Points(starGeo, L.own(new T.PointsMaterial({ color: 0xfff8e0, size: 0.35, fog: false }))));
    // 불꽃놀이
    const MAX = 1800;
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    const life = new Float32Array(MAX);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const pm = L.own(new T.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, map: W3.tex('spark', () => X.glow('rgba(255,255,255,1)'), { clamp: true }) }));
    const points = new T.Points(geo, pm);
    points.frustumCulled = false;
    L.scene.add(points);
    let next = 0;
    let cursor = 0;
    const palette = [0xff8a1f, 0xffd166, 0x9ff0d8, 0xff6fae, 0xb48cff, 0x7ad7ff].map((h) => new T.Color(h));
    function burst() {
      const cx = -14 + Math.random() * 28;
      const cy = 12 + Math.random() * 10;
      const cz = -28 - Math.random() * 14;
      const c = palette[Math.floor(Math.random() * palette.length)];
      for (let i = 0; i < 120; i++) {
        const k = cursor;
        cursor = (cursor + 1) % MAX;
        const u = Math.random() * 2 - 1;
        const a = Math.random() * TAU;
        const s = Math.sqrt(1 - u * u);
        const v = 5 + Math.random() * 2.5;
        pos[k * 3] = cx;
        pos[k * 3 + 1] = cy;
        pos[k * 3 + 2] = cz;
        vel[k * 3] = s * Math.cos(a) * v;
        vel[k * 3 + 1] = u * v;
        vel[k * 3 + 2] = s * Math.sin(a) * v;
        life[k] = 1.6 + Math.random() * 0.6;
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
      }
      if (L.onBurst) L.onBurst();
    }
    L.updaters.push((dt) => {
      next -= dt;
      if (next <= 0) {
        burst();
        next = 0.5 + Math.random() * 0.7;
      }
      for (let k = 0; k < MAX; k++) {
        if (life[k] <= 0) continue;
        life[k] -= dt;
        vel[k * 3 + 1] -= 3.2 * dt;
        vel[k * 3] *= 0.985;
        vel[k * 3 + 1] *= 0.985;
        vel[k * 3 + 2] *= 0.985;
        pos[k * 3] += vel[k * 3] * dt;
        pos[k * 3 + 1] += vel[k * 3 + 1] * dt;
        pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
        const f = Math.max(0, Math.min(1, life[k]));
        col[k * 3] *= 0.995;
        col[k * 3 + 1] *= 0.995;
        col[k * 3 + 2] *= 0.995;
        if (life[k] <= 0) pos[k * 3 + 1] = -100;
        else if (f < 0.3) {
          col[k * 3] *= 0.92;
          col[k * 3 + 1] *= 0.92;
          col[k * 3 + 2] *= 0.92;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    });
    for (let k = 0; k < MAX; k++) pos[k * 3 + 1] = -100;
    L.spawn = { x: 0, z: 2, yaw: 0, pitch: 0.28 };
    L.bounds = { x0: -50, x1: 50, z0: -50, z1: 5 };
    return L;
  };
})();
