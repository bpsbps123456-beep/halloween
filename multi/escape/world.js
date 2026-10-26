/* 동암초 탈출 — 3D 학교 만들기 (three.js)
   - 렌더러, 재질·텍스처 모음, 같은 재질끼리 합쳐 그리는 도구(Kit)
   - 복도: 대피 안내도 순서대로 교실 문·팻말·계단·화장실을 세우고, 손전등 든 경비원을 둬요
   방 안(교실·과학실 …)은 rooms.js 에 있어요. 길이 단위는 미터, y 가 위쪽이에요. */
(function () {
  'use strict';

  const T = window.THREE;
  const X = window.EscapeTex;
  const E = window.EscapeCore;
  const W3 = (window.EscapeWorld = {});
  const TAU = Math.PI * 2;
  const EYE = 1.38; // 6학년 눈높이

  W3.EYE = EYE;

  /* ---------------- 렌더러 ---------------- */
  W3.supported = function () {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  };

  W3.createRenderer = function (canvas) {
    const dpr = window.devicePixelRatio || 1;
    const renderer = new T.WebGLRenderer({ canvas, antialias: dpr < 1.5, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const camera = new T.PerspectiveCamera(72, 16 / 9, 0.05, 90);
    camera.rotation.order = 'YXZ';
    // 내 손전등: 카메라에 달려 있어요
    const torch = new T.SpotLight(0xfff1d6, 4.5, 16, 0.6, 0.65, 1.2);
    torch.position.set(0.12, -0.12, 0);
    torch.target.position.set(0, -0.35, -4);
    camera.add(torch);
    camera.add(torch.target);
    return {
      renderer,
      camera,
      torch,
      resize(w, h) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
    };
  };

  /* ---------------- 텍스처·재질 모음 ---------------- */
  const texCache = new Map();
  /** 한 번 그린 그림은 다시 쓰고, 반복 무늬로 깔아요 */
  function tex(key, draw, o) {
    let t = texCache.get(key);
    if (!t) {
      t = new T.CanvasTexture(draw());
      t.colorSpace = T.SRGBColorSpace;
      t.wrapS = t.wrapT = o && o.clamp ? T.ClampToEdgeWrapping : T.RepeatWrapping;
      t.anisotropy = 4;
      texCache.set(key, t);
    }
    return t;
  }
  W3.tex = tex;
  const matCache = new Map();
  function cached(key, make) {
    let m = matCache.get(key);
    if (!m) {
      m = make();
      matCache.set(key, m);
    }
    return m;
  }
  /** 색만 있는 재질 */
  function lam(color, o) {
    o = o || {};
    return cached('l' + color + JSON.stringify(o), () => new T.MeshLambertMaterial(Object.assign({ color }, o)));
  }
  /** 그림 재질 */
  function tmat(key, draw, o) {
    o = o || {};
    return cached('t' + key + JSON.stringify(o), () => {
      const m = new T.MeshLambertMaterial(Object.assign({ map: tex(key, draw, o) }, o.mat || {}));
      if (o.transparent) {
        m.transparent = true;
        m.depthWrite = false;
      }
      if (o.double) m.side = T.DoubleSide;
      return m;
    });
  }
  /** 스스로 빛나는 그림 (표지판, 창밖, 모니터) */
  function glowMat(key, draw, o) {
    o = o || {};
    return cached('g' + key + JSON.stringify(o), () => {
      const m = new T.MeshBasicMaterial({ map: tex(key, draw, o), color: o.tint == null ? 0xffffff : o.tint, fog: o.fog !== false });
      if (o.transparent) {
        m.transparent = true;
        m.depthWrite = false;
      }
      if (o.additive) m.blending = T.AdditiveBlending;
      if (o.double) m.side = T.DoubleSide;
      return m;
    });
  }
  W3.lam = lam;
  W3.tmat = tmat;
  W3.glowMat = glowMat;

  // 자주 쓰는 재질
  const M = {};
  W3.M = M;
  function setupMaterials() {
    if (M.ready) return;
    M.ready = true;
    M.hallFloor = tmat('terrazzo', () => X.terrazzo('#a4ad9e', '#6c7468', 11));
    M.hallFloor2 = tmat('terrazzo2', () => X.terrazzo('#b3aa98', '#7a705e', 12));
    M.wood = tmat('woodFloor', () => X.woodFloor(5));
    M.vinyl = tmat('vinyl', () => X.vinyl(9));
    M.vinylBlue = tmat('vinylBlue', () => X.vinyl(10, '#c9d6dc'));
    M.wall = tmat('wall', () => X.wall('#8fb39a', '#e6e2d6', 3));
    M.wallClass = tmat('wallClass', () => X.wall('#b98f62', '#ebe5d4', 4));
    M.wallBlue = tmat('wallBlue', () => X.wall('#8aa3bf', '#e4e6ea', 6));
    M.wallPink = tmat('wallPink', () => X.wall('#d8a7a7', '#f1ebe6', 8));
    M.ceiling = tmat('ceiling', () => X.ceiling(7));
    M.foam = tmat('foam', () => X.foam());
    M.tiles = tmat('tiles', () => X.tiles());
    M.door = tmat('door', () => X.door('#c49a6c', 21), { clamp: true });
    M.doorDark = tmat('doorDark', () => X.door('#9c7650', 22), { clamp: true });
    M.night = glowMat('night', () => X.nightWindow(31, false), { tint: 0x8a92b8 });
    M.nightMoon = glowMat('nightMoon', () => X.nightWindow(32, true), { tint: 0x9aa2c8 });
    M.exitSign = glowMat('exitSign', () => X.exitSign(), { clamp: true, fog: false });
    M.moonPatch = glowMat('moonPatch', () => X.moonPatch(), { clamp: true, transparent: true, additive: true, tint: 0x6a78a8 });
    M.cobweb = glowMat('cobweb', () => X.cobweb(), { clamp: true, transparent: true, double: true, tint: 0x9a9ab8 });
    M.frame = lam(0xb9bfc8);
    M.frameDark = lam(0x5b6270);
    M.metal = lam(0x8d96a3);
    M.darkMetal = lam(0x3a3f48);
    M.black = lam(0x0c0b12);
    M.void = new T.MeshBasicMaterial({ color: 0x030308 });
    M.deskTop = lam(0xd8b98e);
    M.deskWood = lam(0xb98f62);
    M.darkWood = lam(0x6b4a2e);
    M.chairBlue = lam(0x3d6bd8);
    M.chairGreen = lam(0x2f9a6a);
    M.white = lam(0xf2efe8);
    M.red = lam(0xd7263d);
    M.glass = new T.MeshLambertMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.22, depthWrite: false });
    M.glassFrost = lam(0x3c4256);
    M.windowLit = new T.MeshBasicMaterial({ color: 0xffd98a });
    M.goal = new T.MeshBasicMaterial({ color: 0xffd166 });
    M.lamp = lam(0xdedad0, { emissive: 0x222222 });
  }
  W3.setupMaterials = setupMaterials;

  /* ---------------- 같은 재질끼리 하나로 합쳐 그리기 ---------------- */
  const BOX = (w, h, d) => new T.BoxGeometry(w, h, d);
  function rect(w, h, u0, v0, u1, v1) {
    const g = new T.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    // PlaneGeometry 의 uv 는 (0,1) (1,1) (0,0) (1,0) 차례예요
    uv.setXY(0, u0, v1);
    uv.setXY(1, u1, v1);
    uv.setXY(2, u0, v0);
    uv.setXY(3, u1, v0);
    return g;
  }
  W3.rect = rect;
  const tmpQ = new T.Quaternion();
  const tmpE = new T.Euler();
  const ONE = new T.Vector3(1, 1, 1);

  class Kit {
    constructor() {
      this.groups = new Map();
    }
    add(geom, material, x, y, z, ry, rx, rz) {
      const m = new T.Matrix4().compose(new T.Vector3(x, y, z), tmpQ.setFromEuler(tmpE.set(rx || 0, ry || 0, rz || 0, 'YXZ')), ONE);
      let list = this.groups.get(material);
      if (!list) this.groups.set(material, (list = []));
      list.push({ geom, m });
      return this;
    }
    /** 상자: (x, y, z)는 바닥 가운데가 아니라 상자 한가운데예요 */
    box(w, h, d, x, y, z, material, ry) {
      return this.add(BOX(w, h, d), material, x, y, z, ry);
    }
    /** 바닥에 놓인 상자 (y = 아래쪽 높이) */
    block(w, h, d, x, y, z, material, ry) {
      return this.add(BOX(w, h, d), material, x, y + h / 2, z, ry);
    }
    /** 세로 판: ry = 0 이면 +z 쪽을 봐요. uv 는 [u0, v0, u1, v1] */
    panel(w, h, x, y, z, ry, material, uv) {
      const u = uv || [0, 0, 1, 1];
      return this.add(rect(w, h, u[0], u[1], u[2], u[3]), material, x, y, z, ry);
    }
    /** 바닥·천장 판: up = true 면 위를 봐요 */
    flat(w, d, x, y, z, material, uv, up) {
      const u = uv || [0, 0, 1, 1];
      return this.add(rect(w, d, u[0], u[1], u[2], u[3]), material, x, y, z, 0, up === false ? Math.PI / 2 : -Math.PI / 2);
    }
    cyl(rt, rb, h, x, y, z, material, seg, rx, rz) {
      return this.add(new T.CylinderGeometry(rt, rb, h, seg || 12), material, x, y, z, 0, rx, rz);
    }
    sphere(r, x, y, z, material, sy) {
      const g = new T.SphereGeometry(r, 14, 10);
      if (sy) g.scale(1, sy, 1);
      return this.add(g, material, x, y, z);
    }
    build(parent) {
      for (const [material, list] of this.groups) {
        const geo = merge(list);
        const mesh = new T.Mesh(geo, material);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        parent.add(mesh);
      }
      this.groups.clear();
    }
  }
  W3.Kit = Kit;

  function merge(list) {
    let count = 0;
    const parts = list.map(({ geom, m }) => {
      const g = geom.index ? geom.toNonIndexed() : geom;
      if (g !== geom) geom.dispose();
      g.applyMatrix4(m);
      count += g.attributes.position.count;
      return g;
    });
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    let o = 0;
    parts.forEach((g) => {
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += g.attributes.position.count;
      g.dispose();
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    return out;
  }

  /* ---------------- 벽 (구멍 뚫린 벽: 문·창문) ----------------
     wall 텍스처 하나 = 가로 2m, 세로 3m. 구멍은 { a, b, y0, y1 } (벽을 따라 a~b, 높이 y0~y1) */
  function wallRun(kit, o) {
    // o: { fixed, from, to, axis: 'x'|'z', face: +1|-1, h, material, holes }
    const H = o.h || 3;
    const holes = (o.holes || []).slice().sort((p, q) => p.a - q.a);
    const pieces = [];
    let cur = o.from;
    holes.forEach((hl) => {
      if (hl.a > cur) pieces.push({ a: cur, b: hl.a, y0: 0, y1: H });
      if (hl.y0 > 0) pieces.push({ a: hl.a, b: hl.b, y0: 0, y1: hl.y0 });
      if (hl.y1 < H) pieces.push({ a: hl.a, b: hl.b, y0: hl.y1, y1: H });
      cur = Math.max(cur, hl.b);
    });
    if (cur < o.to) pieces.push({ a: cur, b: o.to, y0: 0, y1: H });
    pieces.forEach((p) => {
      const w = p.b - p.a;
      const h = p.y1 - p.y0;
      if (w <= 0.001 || h <= 0.001) return;
      const mid = (p.a + p.b) / 2;
      // 벽을 따라 무늬가 이어지게: 바깥에서 볼 때 왼쪽→오른쪽
      const uv = o.face > 0 === (o.axis === 'x') ? [p.a / 2, p.y0 / 3, p.b / 2, p.y1 / 3] : [-p.b / 2, p.y0 / 3, -p.a / 2, p.y1 / 3];
      if (o.axis === 'x') kit.panel(w, h, mid, (p.y0 + p.y1) / 2, o.fixed, o.face > 0 ? 0 : Math.PI, o.material, uv);
      else kit.panel(w, h, o.fixed, (p.y0 + p.y1) / 2, mid, o.face > 0 ? Math.PI / 2 : -Math.PI / 2, o.material, uv);
    });
  }
  W3.wallRun = wallRun;

  /** 창틀이 있는 창문 (axis 'x': 벽이 x축을 따라 놓임) */
  function windowFrame(kit, o) {
    // o: { axis, fixed, a, b, y0, y1, face, glass (재질), bars: 세로 창살 수 }
    const w = o.b - o.a;
    const h = o.y1 - o.y0;
    const mid = (o.a + o.b) / 2;
    const ym = (o.y0 + o.y1) / 2;
    const ry = o.axis === 'x' ? (o.face > 0 ? 0 : Math.PI) : o.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    const back = 0.06 * -o.face; // 창유리는 벽보다 살짝 바깥
    const at = (along, y, off, gw, gh, gd, material) => {
      if (o.axis === 'x') kit.box(gw, gh, gd, along, y, o.fixed + off, material);
      else kit.box(gd, gh, gw, o.fixed + off, y, along, material);
    };
    // 바깥 풍경 (창밖)
    if (o.glass) {
      if (o.axis === 'x') kit.panel(w, h, mid, ym, o.fixed + back * 2, ry, o.glass, o.uv || [0, 0, w / 2.4, 1]);
      else kit.panel(w, h, o.fixed + back * 2, ym, mid, ry, o.glass, o.uv || [0, 0, w / 2.4, 1]);
    }
    const fm = o.frame || M.frame;
    at(mid, o.y0 - 0.03, 0, w + 0.1, 0.06, 0.2, fm); // 창턱
    at(mid, o.y1 + 0.03, 0, w + 0.1, 0.06, 0.12, fm);
    at(o.a - 0.03, ym, 0, 0.06, h, 0.12, fm);
    at(o.b + 0.03, ym, 0, 0.06, h, 0.12, fm);
    const n = o.bars || Math.max(1, Math.round(w / 1.2));
    for (let i = 1; i < n; i++) at(o.a + (w * i) / n, ym, back, 0.05, h, 0.06, fm);
    if (o.cross) at(mid, o.y0 + h * 0.62, back, w, 0.04, 0.05, fm);
  }
  W3.windowFrame = windowFrame;

  /* ---------------- 작은 소품 ---------------- */
  /** 형광등 (꺼진) */
  function ceilingLamp(kit, x, z, y, ry) {
    kit.box(1.25, 0.06, 0.32, x, (y || 3) - 0.04, z, M.lamp, ry || 0);
  }
  W3.ceilingLamp = ceilingLamp;

  /** 소화기 */
  function extinguisher(kit, x, z, ry) {
    kit.cyl(0.08, 0.08, 0.5, x, 0.27, z, M.red, 12);
    kit.cyl(0.03, 0.03, 0.08, x, 0.56, z, M.darkMetal, 8);
    kit.box(0.12, 0.03, 0.03, x + 0.04, 0.6, z, M.darkMetal, ry || 0);
  }
  W3.extinguisher = extinguisher;

  /** 화분 */
  function plant(kit, x, z) {
    kit.cyl(0.16, 0.12, 0.34, x, 0.17, z, lam(0x8a5a3a), 10);
    const leaf = lam(0x2f6b3a);
    kit.sphere(0.28, x, 0.62, z, leaf, 1.2);
    kit.sphere(0.2, x + 0.12, 0.85, z - 0.05, leaf);
  }
  W3.plant = plant;

  /** 호박 (속에 촛불 없이) */
  W3.pumpkinGeometry = (function () {
    let g = null;
    return function () {
      if (g) return g;
      g = new T.SphereGeometry(1, 20, 14);
      const p = g.attributes.position;
      const v = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const a = Math.atan2(v.z, v.x);
        const k = 1 + 0.07 * Math.cos(a * 8);
        p.setXYZ(i, v.x * k, v.y * 0.78 * (1 - 0.06 * Math.abs(v.y)), v.z * k);
      }
      g.computeVertexNormals();
      g.userData.shared = true;
      return g;
    };
  })();
  /** 숨은 호박 하나 (따로 누를 수 있게 하나의 Mesh 묶음) */
  function pumpkin(size) {
    const grp = new T.Group();
    const body = new T.Mesh(W3.pumpkinGeometry(), lam(0xff8a1f));
    body.scale.setScalar(size);
    body.position.y = size * 0.78;
    const stem = new T.Mesh(new T.CylinderGeometry(size * 0.12, size * 0.16, size * 0.4, 6), lam(0x4a6b22));
    stem.position.y = size * 1.62;
    stem.rotation.z = 0.2;
    grp.add(body, stem);
    return grp;
  }
  W3.pumpkin = pumpkin;

  /** 종이 박쥐 (할로윈 장식) */
  const batShape = (function () {
    let geo = null;
    return function () {
      if (geo) return geo;
      const s = new T.Shape();
      s.moveTo(0, 0.04);
      s.quadraticCurveTo(-0.06, 0.1, -0.2, 0.08);
      s.quadraticCurveTo(-0.16, 0.02, -0.19, -0.04);
      s.quadraticCurveTo(-0.13, -0.01, -0.1, -0.06);
      s.quadraticCurveTo(-0.06, -0.02, -0.03, -0.07);
      s.lineTo(0, -0.05);
      s.lineTo(0.03, -0.07);
      s.quadraticCurveTo(0.06, -0.02, 0.1, -0.06);
      s.quadraticCurveTo(0.13, -0.01, 0.19, -0.04);
      s.quadraticCurveTo(0.16, 0.02, 0.2, 0.08);
      s.quadraticCurveTo(0.06, 0.1, 0, 0.04);
      geo = new T.ShapeGeometry(s, 6);
      geo.userData.shared = true;
      return geo;
    };
  })();
  function bat(scale) {
    const grp = new T.Group();
    const wing = new T.Mesh(batShape(), new T.MeshLambertMaterial({ color: 0x1e1830, side: T.DoubleSide }));
    wing.scale.setScalar(scale || 1);
    const eyeM = new T.MeshBasicMaterial({ color: 0xffd166 });
    const eye1 = new T.Mesh(new T.CircleGeometry(0.008 * (scale || 1), 8), eyeM);
    eye1.position.set(-0.014 * (scale || 1), 0.02 * (scale || 1), 0.002);
    const eye2 = eye1.clone();
    eye2.position.x *= -1;
    grp.add(wing, eye1, eye2);
    return grp;
  }
  W3.bat = bat;

  /** 거미 (몸 + 다리 8개) */
  function spider(scale) {
    const s = scale || 1;
    const grp = new T.Group();
    const m = lam(0x16121c);
    const body = new T.Mesh(new T.SphereGeometry(0.035 * s, 10, 8), m);
    const head = new T.Mesh(new T.SphereGeometry(0.022 * s, 8, 6), m);
    head.position.set(0, 0.04 * s, 0);
    grp.add(body, head);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const leg = new T.Mesh(new T.CylinderGeometry(0.004 * s, 0.004 * s, 0.09 * s, 4), m);
      leg.position.set(side * 0.05 * s, (0.025 - k * 0.017) * s, 0.01 * s);
      leg.rotation.z = side * (1.1 + k * 0.18);
      grp.add(leg);
    }
    const eyeM = new T.MeshBasicMaterial({ color: 0xff3b3b });
    const e1 = new T.Mesh(new T.SphereGeometry(0.006 * s, 6, 4), eyeM);
    e1.position.set(-0.009 * s, 0.05 * s, 0.016 * s);
    const e2 = e1.clone();
    e2.position.x *= -1;
    grp.add(e1, e2);
    return grp;
  }
  W3.spider = spider;

  /** 늘 화면을 보는 그림 (이름표, 느낌표) */
  function sprite(key, draw, w, h, o) {
    o = o || {};
    const m = new T.SpriteMaterial({ map: tex(key, draw, { clamp: true }), transparent: true, depthTest: o.depthTest !== false, fog: false });
    const s = new T.Sprite(m);
    s.scale.set(w, h, 1);
    if (o.depthTest === false) s.renderOrder = 10;
    return s;
  }
  W3.sprite = sprite;

  /* ---------------- 한 장면(레벨) ---------------- */
  class Level {
    constructor(kind) {
      this.kind = kind;
      this.scene = new T.Scene();
      this.colliders = [];
      this.interact = [];
      this.updaters = [];
      this.owned = [];
      this.bounds = null;
      this.spawn = { x: 0, z: 0, yaw: 0 };
    }
    /** 누를 수 있는 물건 */
    tag(obj, info) {
      obj.userData.info = info;
      obj.traverse((o) => {
        o.userData.info = info;
      });
      this.interact.push(obj);
      return obj;
    }
    untag(obj) {
      const i = this.interact.indexOf(obj);
      if (i >= 0) this.interact.splice(i, 1);
    }
    collide(x0, z0, x1, z1) {
      this.colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
    }
    own(thing) {
      this.owned.push(thing);
      return thing;
    }
    update(dt, t) {
      for (const fn of this.updaters) fn(dt, t);
    }
    dispose() {
      this.scene.traverse((o) => {
        if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
      });
      this.owned.forEach((d) => d.dispose && d.dispose());
      this.scene.clear();
    }
  }
  W3.Level = Level;

  /** 밤 학교 조명: 은은한 달빛 + 어둠 */
  function nightLights(L, o) {
    o = o || {};
    L.scene.background = new T.Color(o.bg || 0x05050c);
    L.scene.fog = new T.FogExp2(o.fog || 0x07070f, o.density == null ? 0.055 : o.density);
    L.scene.add(new T.AmbientLight(0x4a5480, o.ambient == null ? 0.55 : o.ambient));
    L.scene.add(new T.HemisphereLight(0x7a8ad0, 0x1c1424, o.hemi == null ? 0.5 : o.hemi));
    const moon = new T.DirectionalLight(0xa8bbff, o.moon == null ? 0.45 : o.moon);
    moon.position.set(o.mx || 0, 6, o.mz == null ? -8 : o.mz);
    moon.target.position.set(o.tx || 0, 0, o.tz || 0);
    L.scene.add(moon, moon.target);
  }
  W3.nightLights = nightLights;

  /* ---------------- 경비원 ---------------- */
  function makeGuard(L, cone) {
    const g = new T.Group();
    const navy = lam(0x24325c);
    const dark = lam(0x121726);
    const skin = lam(0xd9c2a0);
    const shoe = lam(0x0a0a0a);
    const legs = [-1, 1].map((side) => {
      const pivot = new T.Group();
      pivot.position.set(side * 0.1, 0.86, 0);
      const leg = new T.Mesh(BOX(0.15, 0.82, 0.17), dark);
      leg.position.y = -0.41;
      const foot = new T.Mesh(BOX(0.16, 0.08, 0.26), shoe);
      foot.position.set(0, -0.82, 0.04);
      pivot.add(leg, foot);
      g.add(pivot);
      return pivot;
    });
    const torso = new T.Mesh(BOX(0.46, 0.62, 0.28), navy);
    torso.position.y = 1.18;
    const belt = new T.Mesh(BOX(0.47, 0.07, 0.29), lam(0x111111));
    belt.position.y = 0.89;
    const badge = new T.Mesh(BOX(0.08, 0.07, 0.02), lam(0xffd166, { emissive: 0x332200 }));
    badge.position.set(0.12, 1.34, 0.145);
    const vest = new T.Mesh(BOX(0.47, 0.05, 0.29), lam(0xc9f24a, { emissive: 0x1a2200 }));
    vest.position.y = 1.08;
    g.add(torso, belt, badge, vest);
    const armL = new T.Group();
    armL.position.set(-0.29, 1.45, 0);
    const al = new T.Mesh(BOX(0.12, 0.6, 0.14), navy);
    al.position.y = -0.3;
    armL.add(al);
    const armR = new T.Group();
    armR.position.set(0.29, 1.45, 0);
    const ar = new T.Mesh(BOX(0.12, 0.6, 0.14), navy);
    ar.position.y = -0.3;
    armR.add(ar);
    armR.rotation.x = -1.15; // 손전등을 앞으로
    g.add(armL, armR);
    const head = new T.Mesh(new T.SphereGeometry(0.135, 14, 10), skin);
    head.position.y = 1.66;
    const cap = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.08, 14), dark);
    cap.position.y = 1.78;
    const visor = new T.Mesh(BOX(0.24, 0.02, 0.14), dark);
    visor.position.set(0, 1.745, 0.14);
    const capBadge = new T.Mesh(BOX(0.06, 0.05, 0.01), lam(0xffd166, { emissive: 0x332200 }));
    capBadge.position.set(0, 1.79, 0.152);
    const eyes = new T.Mesh(BOX(0.12, 0.025, 0.01), new T.MeshBasicMaterial({ color: 0xffe9a8 }));
    eyes.position.set(0, 1.68, 0.13);
    g.add(head, cap, visor, capBadge, eyes);
    // 손전등 (오른손 끝)
    const torchBody = new T.Mesh(new T.CylinderGeometry(0.035, 0.03, 0.22, 10), lam(0x9aa0a8));
    torchBody.rotation.x = Math.PI / 2;
    torchBody.position.set(0.29, 1.21, 0.5);
    const lens = new T.Mesh(new T.CircleGeometry(0.034, 12), new T.MeshBasicMaterial({ color: 0xfff6d0 }));
    lens.position.set(0.29, 1.21, 0.612);
    g.add(torchBody, lens);
    const spot = new T.SpotLight(0xffecc0, 30, cone + 4, 0.42, 0.45, 1.25);
    spot.position.set(0.29, 1.21, 0.62);
    spot.target.position.set(0.1, 0.2, 6);
    g.add(spot, spot.target);
    // 눈에 보이는 빛줄기
    const beamLen = Math.min(cone, 6);
    const beamGeo = new T.ConeGeometry(Math.tan(0.4) * beamLen, beamLen, 24, 1, true);
    beamGeo.translate(0, -beamLen / 2, 0);
    beamGeo.rotateX(-Math.PI / 2 + 0.06);
    const beamMat = L.own(
      new T.MeshBasicMaterial({ map: tex('beam', () => X.beam(), { clamp: true }), color: 0xfff0c0, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })
    );
    const beam = new T.Mesh(beamGeo, beamMat);
    beam.position.set(0.29, 1.21, 0.62);
    g.add(beam);
    const bang = sprite('bang', () => X.bang('!', '#ff4d4d'), 0.5, 0.5, { depthTest: false });
    bang.position.y = 2.2;
    bang.visible = false;
    const ask = sprite('ask', () => X.bang('?', '#ffd166'), 0.45, 0.45, { depthTest: false });
    ask.position.y = 2.2;
    ask.visible = false;
    g.add(bang, ask);
    L.scene.add(g);

    let walkPhase = 0;
    return {
      group: g,
      spot,
      beam,
      /** 경비원 상태(core)를 3D 모습에 옮겨요 */
      sync(st, dt, t) {
        const moving = st.state === 'walk' || st.state === 'chase' || st.state === 'enter' || st.state === 'exit';
        const speed = st.state === 'chase' ? 15 : 8;
        if (moving) walkPhase += dt * speed;
        const sw = moving ? Math.sin(walkPhase) * (st.state === 'chase' ? 0.7 : 0.45) : 0;
        legs[0].rotation.x = sw;
        legs[1].rotation.x = -sw;
        armL.rotation.x = -sw * 0.8;
        g.position.y = moving ? Math.abs(Math.cos(walkPhase)) * 0.03 : 0;
        const inside = st.state === 'inRoom';
        g.visible = !inside;
        g.position.x = st.x;
        g.position.z = st.z;
        let yaw = st.face > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (st.state === 'enter' || st.state === 'exit') yaw = 0; // 교실 문 쪽(+z)을 봐요
        if (st.state === 'listen' || st.state === 'search') yaw += Math.sin(t * 2.4) * 0.5;
        g.rotation.y += (yaw - g.rotation.y) * Math.min(1, dt * 8);
        spot.intensity = inside ? 0 : 30 * (0.94 + Math.sin(t * 13) * 0.03 + Math.sin(t * 31) * 0.02);
        beam.visible = !inside;
        bang.visible = st.state === 'alert' || st.state === 'chase';
        ask.visible = st.state === 'search' || st.state === 'listen';
      },
    };
  }
  W3.makeGuard = makeGuard;

  /* ---------------- 복도 ---------------- */
  /** hall: core.createHall 결과, run: 한 판 정보 */
  W3.buildHall = function (hall, run) {
    setupMaterials();
    const L = new Level('hall');
    const kit = new Kit();
    const len = hall.length;
    const HW = E.HALL_WIDTH / 2; // 1.5
    const HH = E.HALL_HEIGHT; // 3
    const bon = hall.def.building === 'bon';
    nightLights(L, { mx: len / 2, mz: -10, tx: len / 2, tz: 2, density: 0.05 });
    const floorM = bon ? M.hallFloor2 : M.hallFloor;
    const wallM = bon ? M.wallBlue : M.wall;

    // 바닥·천장
    kit.flat(len, 2 * HW, len / 2, 0, 0, floorM, [0, 0, len / 1.2, (2 * HW) / 1.2]);
    kit.flat(len, 2 * HW, len / 2, HH, 0, M.ceiling, [0, 0, len / 1.2, (2 * HW) / 1.2], false);
    for (let x = 1.5; x < len; x += 3) ceilingLamp(kit, x, 0, HH, 0);

    // 창문 쪽 벽 (z = -1.5): 아래 벽 + 큰 창 + 위 벽
    const winHoles = [];
    for (let x = 0.6; x + 2.2 <= len - 0.4; x += 3) winHoles.push({ a: x, b: x + 2.2, y0: 0.95, y1: 2.55 });
    wallRun(kit, { axis: 'x', fixed: -HW, from: 0, to: len, face: 1, material: wallM, holes: winHoles });
    winHoles.forEach((hl, i) => {
      windowFrame(kit, { axis: 'x', fixed: -HW, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: 1, glass: i % 4 === 1 ? M.nightMoon : M.night, bars: 2, uv: [i * 0.37, 0, i * 0.37 + 0.9, 1] });
      // 창 밑 라디에이터
      kit.box(1.6, 0.5, 0.12, (hl.a + hl.b) / 2, 0.45, -HW + 0.09, M.frame);
      // 바닥에 비친 달빛
      kit.flat(2.2, 1.6, (hl.a + hl.b) / 2 + 0.6, 0.012, -0.4, M.moonPatch);
    });

    // 끝 벽
    wallRun(kit, { axis: 'z', fixed: 0, from: -HW, to: HW, face: 1, material: wallM, holes: [{ a: -0.9, b: 0.9, y0: 1.0, y1: 2.4 }] });
    windowFrame(kit, { axis: 'z', fixed: 0, a: -0.9, b: 0.9, y0: 1.0, y1: 2.4, face: 1, glass: M.night, bars: 2 });
    wallRun(kit, { axis: 'z', fixed: len, from: -HW, to: HW, face: -1, material: wallM, holes: [{ a: -0.9, b: 0.9, y0: 1.0, y1: 2.4 }] });
    windowFrame(kit, { axis: 'z', fixed: len, a: -0.9, b: 0.9, y0: 1.0, y1: 2.4, face: -1, glass: M.night, bars: 2 });

    // 교실 쪽 벽 (z = +1.5)
    const roomWindows = {};
    const doorsOpen = new Set(hall.spots.filter((s) => s.kind === 'door').map((s) => Math.round(s.x * 10)));
    hall.cells.forEach((c) => buildCellFront(L, kit, c, hall, run, doorsOpen, roomWindows, wallM));

    // 숨을 곳: 청소함
    hall.spots.forEach((sp) => {
      if (sp.kind !== 'locker') return;
      const lockerM = tmat('locker', () => X.locker('청소함'), { clamp: true });
      kit.block(0.9, 1.9, 0.5, sp.x, 0, -HW + 0.26, M.metal);
      kit.panel(0.9, 1.9, sp.x, 0.95, -HW + 0.515, 0, lockerM);
    });

    // 대피 안내도 (출발 쪽) + 안전 포스터
    const places = run.steps.map((s) => s.place).concat([E.EXIT.place]);
    const here = { building: hall.def.building, floor: hall.def.floor, index: hall.def.fromIndex };
    const evacKey = 'evac-' + hall.def.id + '-' + run.school;
    const evacM = tmat(evacKey, () => window.EscapeMap.poster(places, here, run.school), { clamp: true });
    const posterX = hall.startX + hall.dir * 2.6;
    kit.panel(1.4, 0.98, posterX, 1.55, -HW + 0.02, 0, evacM);
    kit.box(1.48, 1.06, 0.02, posterX, 1.55, -HW + 0.005, M.frameDark);

    // 비상구 표지 (계단 위)
    hall.cells.forEach((c) => {
      if (c.kind !== 'stairs') return;
      kit.box(0.62, 0.32, 0.08, (c.x0 + c.x1) / 2, HH - 0.25, 0.9, M.darkMetal);
      kit.panel(0.6, 0.3, (c.x0 + c.x1) / 2, HH - 0.25, 0.85, Math.PI, M.exitSign);
      kit.panel(0.6, 0.3, (c.x0 + c.x1) / 2, HH - 0.25, 0.95, 0, M.exitSign);
    });

    // 할로윈 거미줄 몇 개
    [0.05, 0.45, 0.8].forEach((k, i) => {
      const x = len * k + 1;
      kit.panel(0.9, 0.9, x, HH - 0.45, -HW + 0.02, 0, M.cobweb);
      if (i === 1) kit.panel(0.9, 0.9, x + 7, HH - 0.45, HW - 0.02, Math.PI, M.cobweb);
    });

    kit.build(L.scene);

    // 도착 문: 노랗게 빛나는 문틀과 이름표
    const goalCell = hall.cells.find((c) => c.index === hall.def.toIndex);
    const frame = new T.Group();
    const fm = M.goal;
    const fx = hall.goalX;
    [
      [0.06, 2.2, fx - 0.56, 1.1],
      [0.06, 2.2, fx + 0.56, 1.1],
      [1.18, 0.06, fx, 2.2],
    ].forEach(([w, h, x, y]) => {
      const m = new T.Mesh(BOX(w, h, 0.04), fm);
      m.position.set(x, y, HW - 0.04);
      frame.add(m);
    });
    L.scene.add(frame);
    const goalLabel = sprite('goal-' + goalCell.name, () => X.label('▼ ' + goalCell.name), 1.6, 0.4, { depthTest: false });
    goalLabel.position.set(fx, 2.55, HW - 0.4);
    L.scene.add(goalLabel);
    const goalLight = new T.PointLight(0xffc860, 4, 4, 1.5);
    goalLight.position.set(fx, 2.2, HW - 0.6);
    L.scene.add(goalLight);
    L.updaters.push((dt, t) => {
      const k = 0.6 + 0.4 * Math.sin(t * 4);
      fm.color.setRGB(1, 0.82 * k + 0.1, 0.4 * k);
      goalLabel.position.y = 2.55 + Math.sin(t * 2) * 0.05;
    });

    // 경비원
    L.guard = makeGuard(L, hall.guard.cone);
    L.roomWindows = roomWindows;
    L.hall = hall;
    /** 경비원이 교실 안을 살피면 그 교실 창이 노랗게 빛나요 */
    L.lightRoom = function (cell, on) {
      (roomWindows[cell] || []).forEach((m) => (m.material = on ? M.windowLit : M.glassFrost));
    };
    L.spawn = { x: hall.startX, z: 0, yaw: hall.dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
    return L;
  };

  /** 교실 쪽 벽 한 칸 */
  function buildCellFront(L, kit, c, hall, run, doorsOpen, roomWindows, wallM) {
    const HW = 1.5;
    const HH = 3;
    const x0 = c.x0;
    const x1 = c.x1;
    const mid = (x0 + x1) / 2;
    const holes = [];
    const w = x1 - x0;
    if (c.kind === 'stairs') {
      holes.push({ a: x0 + 0.5, b: x1 - 0.5, y0: 0, y1: 2.6 });
      wallRun(kit, { axis: 'x', fixed: HW, from: x0, to: x1, face: -1, material: wallM, holes });
      // 올라가는 계단과 내려가는 계단
      const stepM = lam(0x9a9488);
      const nose = lam(0x5a5650);
      for (let i = 0; i < 9; i++) {
        kit.block(1.6, 0.17 * (i + 1), 0.3, x0 + 1.4, 0, HW + 0.2 + i * 0.3, stepM);
        kit.box(1.6, 0.03, 0.04, x0 + 1.4, 0.17 * (i + 1), HW + 0.07 + i * 0.3, nose);
      }
      kit.block(1.6, 0.02, 3.2, x1 - 1.4, -0.0, HW + 1.6, M.black);
      kit.box(0.05, 0.9, 3.0, mid, 0.75, HW + 1.5, M.metal); // 난간
      kit.box(0.08, 0.06, 3.0, mid, 1.2, HW + 1.5, M.darkWood);
      kit.block(w - 1, HH, 0.05, mid, 0, HW + 3.1, M.black);
      kit.flat(w - 1, 3.1, mid, HH, HW + 1.55, M.black, null, false);
      kit.panel(3.1, HH, x0 + 0.5, HH / 2, HW + 1.55, Math.PI / 2, M.black);
      kit.panel(3.1, HH, x1 - 0.5, HH / 2, HW + 1.55, -Math.PI / 2, M.black);
      const pl = tmat('plate-계단', () => X.namePlate('계단', '비상 대피로'), { clamp: true });
      kit.panel(0.9, 0.28, mid, 2.78, HW - 0.01, Math.PI, pl);
      extinguisher(kit, x1 - 0.35, HW - 0.2, 0);
      return;
    }
    if (c.kind === 'toilet') {
      holes.push({ a: mid - 0.6, b: mid + 0.6, y0: 0, y1: 2.2 });
      wallRun(kit, { axis: 'x', fixed: HW, from: x0, to: x1, face: -1, material: wallM, holes });
      const tm = M.tiles;
      kit.flat(1.2, 1.6, mid, 0.01, HW + 0.8, tm, [0, 0, 1.5, 2]);
      kit.panel(1.2, 2.2, mid, 1.1, HW + 1.6, 0, tm, [0, 0, 1.5, 2.75]);
      kit.panel(1.6, 2.2, mid - 0.6, 1.1, HW + 0.8, Math.PI / 2, tm, [0, 0, 2, 2.75]);
      kit.panel(1.6, 2.2, mid + 0.6, 1.1, HW + 0.8, -Math.PI / 2, tm, [0, 0, 2, 2.75]);
      kit.flat(1.2, 1.6, mid, 2.2, HW + 0.8, M.black, null, false);
      const sign = tmat('toiletSign', () => X.namePlate('화장실', '남 · 여'), { clamp: true });
      kit.panel(0.8, 0.25, mid, 2.45, HW - 0.01, Math.PI, sign);
      return;
    }
    if (c.kind === 'ev') {
      wallRun(kit, { axis: 'x', fixed: HW, from: x0, to: x1, face: -1, material: wallM, holes: [{ a: mid - 0.55, b: mid + 0.55, y0: 0, y1: 2.15 }] });
      kit.box(1.1, 2.15, 0.04, mid, 1.075, HW + 0.03, M.metal);
      kit.box(0.02, 2.15, 0.05, mid, 1.075, HW + 0.01, M.darkMetal);
      kit.box(0.12, 0.22, 0.03, mid + 0.75, 1.2, HW - 0.01, M.darkMetal);
      const evs = tmat('evSign', () => X.namePlate('EV', '불나면 타지 마세요'), { clamp: true });
      kit.panel(0.9, 0.28, mid, 2.45, HW - 0.01, Math.PI, evs);
      return;
    }
    if (c.kind === 'entrance') {
      wallRun(kit, { axis: 'x', fixed: HW, from: x0, to: x1, face: -1, material: wallM, holes: [{ a: x0 + 0.8, b: x1 - 0.8, y0: 0, y1: 2.6 }] });
      const yardM = glowMat('yard', () => X.yard(), { tint: 0x9098b8 });
      kit.panel(w - 1.6, 2.6, mid, 1.3, HW + 0.5, Math.PI, yardM);
      for (let x = x0 + 0.8; x <= x1 - 0.8 + 0.01; x += (w - 1.6) / 4) kit.box(0.08, 2.6, 0.1, x, 1.3, HW + 0.1, M.frameDark);
      kit.box(w - 1.6, 0.08, 0.1, mid, 2.6, HW + 0.1, M.frameDark);
      kit.box(0.5, 0.06, 0.06, mid, 1.0, HW + 0.05, lam(0x8a8a8a)); // 체인
      const lockSign = tmat('lockedSign', () => X.label('잠겨 있어요', '#d7263d', '#fff'), { clamp: true });
      kit.panel(1.1, 0.27, mid, 1.45, HW - 0.02, Math.PI, lockSign);
      return;
    }
    // 교실·특별실: 앞문과 뒷문 (좁은 방은 문 하나)
    const doorXs = w >= 8 ? [x0 + 1.6, x1 - 1.6] : [mid];
    doorXs.forEach((dx) => holes.push({ a: dx - 0.5, b: dx + 0.5, y0: 0, y1: 2.1 }));
    // 복도 쪽 높은 창 (문 사이)
    const winA = doorXs.length === 2 ? doorXs[0] + 0.9 : x0 + 0.5;
    const winB = doorXs.length === 2 ? doorXs[1] - 0.9 : mid - 0.8;
    if (winB - winA > 0.8) holes.push({ a: winA, b: winB, y0: 1.75, y1: 2.5 });
    if (doorXs.length === 1 && x1 - 0.5 - (mid + 0.8) > 0.8) holes.push({ a: mid + 0.8, b: x1 - 0.5, y0: 1.75, y1: 2.5 });
    wallRun(kit, { axis: 'x', fixed: HW, from: x0, to: x1, face: -1, material: wallM, holes });
    holes
      .filter((hl) => hl.y0 > 1)
      .forEach((hl) => {
        windowFrame(kit, { axis: 'x', fixed: HW, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: -1, bars: Math.max(2, Math.round((hl.b - hl.a) / 1.2)) });
        const glass = new T.Mesh(rect(hl.b - hl.a, hl.y1 - hl.y0, 0, 0, 1, 1), M.glassFrost);
        glass.position.set((hl.a + hl.b) / 2, (hl.y0 + hl.y1) / 2, HW + 0.04);
        glass.rotation.y = Math.PI;
        L.scene.add(glass);
        (roomWindows[c.index] = roomWindows[c.index] || []).push(glass);
      });
    doorXs.forEach((dx, i) => {
      const open = doorsOpen.has(Math.round(dx * 10));
      // 문틀
      kit.box(1.08, 0.06, 0.12, dx, 2.13, HW, M.darkWood);
      kit.box(0.05, 2.1, 0.12, dx - 0.52, 1.05, HW, M.darkWood);
      kit.box(0.05, 2.1, 0.12, dx + 0.52, 1.05, HW, M.darkWood);
      // 문 (열린 문은 옆으로 밀려 있어요)
      const shift = open ? 0.82 : 0;
      kit.panel(1.0, 2.08, dx + shift, 1.04, HW + 0.05, Math.PI, i ? M.doorDark : M.door);
      // 문 안쪽은 캄캄한 교실
      kit.panel(1.0, 2.1, dx, 1.05, HW + 0.9, Math.PI, M.void);
      kit.panel(0.85, 2.1, dx - 0.5, 1.05, HW + 0.45, Math.PI / 2, M.black);
      kit.panel(0.85, 2.1, dx + 0.5, 1.05, HW + 0.45, -Math.PI / 2, M.black);
      if (open) {
        // 열린 문 안: 책상 그림자
        kit.block(0.6, 0.72, 0.45, dx - 0.15, 0, HW + 0.7, M.black);
      }
    });
    // 팻말: 복도로 튀어나온 이름판 (앞문 위)
    const label = /^\d-\d$/.test(c.name) ? c.name.replace('-', '학년 ') + '반' : c.name;
    const plate = tmat('plate-' + c.name, () => X.namePlate(c.name, /^\d-\d$/.test(c.name) ? label : run.school), { clamp: true });
    const px = doorXs[0];
    kit.box(0.04, 0.3, 0.62, px, 2.5, HW - 0.31, M.white);
    kit.panel(0.6, 0.28, px + 0.022, 2.5, HW - 0.31, Math.PI / 2, plate);
    kit.panel(0.6, 0.28, px - 0.022, 2.5, HW - 0.31, -Math.PI / 2, plate);
    // 게시판 (문 사이 벽, 큰 방만)
    if (doorXs.length === 2) {
      const bb = tmat('bulletin-' + (c.index % 4), () => X.bulletin(41 + c.index, ''), { clamp: true });
      kit.panel(2.4, 1.2, mid, 1.1, HW - 0.02, Math.PI, bb);
    }
    if (c.index % 3 === 1) extinguisher(kit, x1 - 0.25, HW - 0.2, 0);
  }
})();
