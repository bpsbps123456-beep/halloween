/* 할로윈 나이트(6-3 대탈출) — 3D 학교 만들기 (three.js)
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
    let aim = 0;
    return {
      group: g,
      spot,
      beam,
      /** 경비원 상태(core)를 3D 모습에 옮겨요 */
      sync(st, dt, t) {
        const moving = st.moving;
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
        // core 의 ang: +x 쪽이 0, +z 쪽(교실·계단 쪽)이 π/2
        let yaw = Math.atan2(Math.cos(st.ang), Math.sin(st.ang));
        if (st.state === 'listen') yaw += Math.sin(t * 2.4) * 0.3;
        const d = Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y));
        g.rotation.y += d * Math.min(1, dt * 10);
        // 계단 아래를 비출 때는 손전등을 아래로
        const down = st.state === 'peekStairs' ? 1 : 0;
        aim += (down - aim) * Math.min(1, dt * 4);
        spot.target.position.set(0.1, 0.2 - aim * 2.2, 6 - aim * 2);
        beam.rotation.x = aim * 0.42;
        spot.intensity = inside ? 0 : 30 * (0.94 + Math.sin(t * 13) * 0.03 + Math.sin(t * 31) * 0.02);
        beam.visible = !inside;
        bang.visible = st.state === 'alert' || st.state === 'chase';
        ask.visible = !bang.visible && (st.sus > 0.3 || ['listen', 'investigate', 'search', 'goCheck', 'check', 'roomSearch', 'goStairs', 'peekStairs', 'halt'].indexOf(st.state) >= 0);
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
    const bx = hall.bridgeX;
    const onBridge = (a, b) => bx != null && b > bx - 1.5 && a < bx + 1.5;
    for (let x = 0.6; x + 2.2 <= len - 0.4; x += 3) if (!onBridge(x, x + 2.2)) winHoles.push({ a: x, b: x + 2.2, y0: 0.95, y1: 2.55 });
    const bridgeHole = bx != null ? [{ a: bx - 1.1, b: bx + 1.1, y0: 0, y1: 2.4 }] : [];
    wallRun(kit, { axis: 'x', fixed: -HW, from: 0, to: len, face: 1, material: wallM, holes: winHoles.concat(bridgeHole) });
    if (bx != null) buildBridge(L, kit, bx, hall, wallM);
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
    L.slideDoors = [];
    /** 미닫이문을 core 의 문 상태(열림·닫힘)에 맞춰 옆으로 밀어요 */
    L.syncDoors = function (h, dt) {
      L.slideDoors.forEach((d) => {
        const target = d.x + (E.isDoorOpen(h, d.x) ? 0.96 : 0);
        d.mesh.position.x += (target - d.mesh.position.x) * Math.min(1, dt * 7);
      });
    };
    const doorsOpen = new Set([].concat(...hall.rooms.map((r) => r.doors)).map((x) => Math.round(x * 10)));
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

    // 우리 반 친구 이름 종이 (창문 사이 벽): 상장·생일 축하·칭찬왕·분실물·그림·독서왕
    const friends = run.friends && run.friends.length ? run.friends : ['꼬마 유령', '호박 군', '박쥐 양', '거미 씨'];
    const pr = X.rand(hall.def.id.charCodeAt(1) * 977 + (run.seed % 997));
    const lockerXs = hall.spots.filter((sp) => sp.kind === 'locker').map((sp) => sp.x);
    const gaps = [];
    for (let x = 3.2; x < len - 1; x += 3) {
      if (Math.abs(x - posterX) < 1.4 || lockerXs.some((lx) => Math.abs(lx - x) < 0.9) || (bx != null && Math.abs(x - bx) < 1.8)) continue;
      gaps.push(x);
    }
    const kinds = ['award', 'birthday', 'praise', 'lost', 'drawing', 'reading'];
    const want = Math.min(Math.max(4, Math.round(len / 14)), gaps.length);
    const used = new Set();
    for (let i = 0; i < want; i++) {
      const x = gaps[Math.floor(((i + 0.5) * gaps.length) / want)];
      let name = friends[Math.floor(pr() * friends.length)];
      for (let k = 0; k < 5 && used.has(name); k++) name = friends[Math.floor(pr() * friends.length)];
      used.add(name);
      const kind = kinds[Math.floor(pr() * kinds.length)];
      const seed = Math.floor(pr() * 1000);
      const npm = tmat('np-' + kind + '-' + name + '-' + seed, () => X.namePoster(kind, name, seed), { clamp: true });
      kit.panel(0.54, 0.72, x, 1.62, -HW + 0.015, 0, npm);
      kit.box(0.14, 0.04, 0.005, x - 0.18, 1.97, -HW + 0.02, lam(0xf2efd8)); // 테이프
      kit.box(0.14, 0.04, 0.005, x + 0.18, 1.97, -HW + 0.02, lam(0xf2efd8));
    }

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
    const goalText = hall.def.goalLabel || goalCell.name;
    const goalLabel = sprite('goal-' + goalText, () => X.label('▼ ' + goalText), 1.6, 0.4, { depthTest: false });
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

  /** 문이 열린 교실 안: 청소 시간처럼 책상을 뒤로 밀어 둔 캄캄한 교실 (들어가서 숨거나, 다른 문으로 빠져나가요) */
  function buildRoomInside(L, kit, c, holes, run) {
    const HW = 1.5;
    const HH = 3;
    const RD = E.ROOM_DEPTH;
    const x0 = c.x0;
    const x1 = c.x1;
    const w = x1 - x0;
    const mid = (x0 + x1) / 2;
    const zb = HW + RD; // 창문 벽
    const zc = HW + RD / 2;
    kit.flat(w, RD, mid, 0.004, zc, M.wood, [0, 0, w / 2, RD / 2]);
    kit.flat(w, RD, mid, HH, zc, M.ceiling, [0, 0, w / 1.2, RD / 1.2], false);
    for (let x = x0 + 1.5; x < x1 - 0.5; x += 3) for (let z = HW + 1.6; z < zb - 0.5; z += 2.4) ceilingLamp(kit, x, z, HH, 0);
    // 복도 쪽 벽의 교실 쪽 면 (문·높은 창 구멍은 그대로)
    wallRun(kit, { axis: 'x', fixed: HW + 0.1, from: x0, to: x1, face: 1, material: M.wallClass, holes });
    holes
      .filter((hl) => hl.y0 > 1)
      .forEach((hl) => kit.panel(hl.b - hl.a, hl.y1 - hl.y0, (hl.a + hl.b) / 2, (hl.y0 + hl.y1) / 2, HW + 0.06, 0, M.glassFrost));
    holes
      .filter((hl) => hl.y0 === 0)
      .forEach((hl) => {
        // 문틀 안쪽 (벽 두께)
        kit.panel(0.1, hl.y1, hl.a, hl.y1 / 2, HW + 0.05, Math.PI / 2, M.darkWood);
        kit.panel(0.1, hl.y1, hl.b, hl.y1 / 2, HW + 0.05, -Math.PI / 2, M.darkWood);
      });
    // 창문 벽 (밤하늘)
    const win = [];
    for (let x = x0 + 0.7; x + 2.0 <= x1 - 0.5; x += 2.6) win.push({ a: x, b: x + 2.0, y0: 0.95, y1: 2.5 });
    wallRun(kit, { axis: 'x', fixed: zb, from: x0, to: x1, face: -1, material: M.wallClass, holes: win });
    win.forEach((hl, i) => windowFrame(kit, { axis: 'x', fixed: zb, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: -1, glass: i % 3 === 1 ? M.nightMoon : M.night, bars: 2, uv: [i * 0.41, 0, i * 0.41 + 0.85, 1] }));
    // 옆벽
    wallRun(kit, { axis: 'z', fixed: x0, from: HW, to: zb, face: 1, material: M.wallClass });
    wallRun(kit, { axis: 'z', fixed: x1, from: HW, to: zb, face: -1, material: M.wallClass });
    // 실 종류에 맞게 꾸며요 (가구는 뒤쪽과 옆벽에만: 앞쪽은 걸어 다닐 수 있게 비워 둬요)
    const G = { HW, HH, x0, x1, w, mid, zb, zc, back: E.ROOM_Z1 + 0.35 };
    (FURNISH[c.type] || FURNISH.classroom)(kit, L, c, run, G);
    // 할로윈 장식: 구석 거미줄
    kit.panel(0.9, 0.9, x1 - 0.5, HH - 0.45, zb - 0.02, Math.PI, M.cobweb);
    kit.panel(0.9, 0.9, x0 + 0.03, HH - 0.45, HW + 0.6, Math.PI / 2, M.cobweb);
  }

  const screenM = () => lam(0x18284a, { emissive: 0x0c1c3a });
  function monitor(kit, x, y, z, face) {
    kit.box(0.52, 0.34, 0.04, x, y + 0.27, z, M.black);
    kit.box(0.46, 0.28, 0.01, x, y + 0.27, z - 0.025 * face, screenM());
    kit.box(0.06, 0.12, 0.06, x, y + 0.06, z + 0.04 * face, M.darkMetal);
  }
  function officeChair(kit, x, z, color) {
    const cm = lam(color);
    kit.cyl(0.03, 0.03, 0.42, x, 0.21, z, M.darkMetal, 6);
    kit.cyl(0.23, 0.23, 0.07, x, 0.46, z, cm, 12);
    kit.box(0.42, 0.42, 0.06, x, 0.74, z - 0.22, cm);
  }
  function pumpkinAt(L, x, y, z, size) {
    const pk = pumpkin(size || 0.13);
    pk.position.set(x, y, z);
    L.scene.add(pk);
  }

  /** 실 종류별 꾸미기: (kit, L, c, run, G) */
  const FURNISH = {
    /** 교실: 칠판, 교탁, 청소 시간처럼 뒤로 밀어 둔 책상 */
    classroom(kit, L, c, run, G) {
      const fr = run.friends || [];
      const duty = fr.length >= 2 ? [fr[(c.index * 5) % fr.length], fr[(c.index * 5 + 7) % fr.length]].filter((n, i, a) => a.indexOf(n) === i) : [];
      const bm = tmat('roomBoard-' + duty.join(','), () => X.roomBoard(duty), { clamp: true });
      kit.box(0.05, 1.26, 3.66, G.x0 + 0.03, 1.55, G.zc, M.darkWood);
      kit.panel(3.6, 1.2, G.x0 + 0.065, 1.55, G.zc, Math.PI / 2, bm);
      kit.box(0.12, 0.04, 3.4, G.x0 + 0.08, 0.93, G.zc, M.darkWood); // 분필 받침
      kit.block(0.55, 1.0, 0.9, G.x0 + 0.62, 0, G.zc, M.deskWood); // 교탁
      kit.box(0.6, 0.04, 0.95, G.x0 + 0.62, 1.02, G.zc, M.deskTop);
      const dz0 = E.ROOM_Z1 + 0.6;
      for (let row = 0; row < 3; row++) {
        const z = dz0 + row * 0.62;
        if (z > G.zb - 0.3) break;
        for (let x = G.x0 + 1.0; x <= G.x1 - 0.9; x += 0.78) {
          const jx = x + ((row * 7 + Math.round(x * 3)) % 3) * 0.04;
          kit.block(0.6, 0.04, 0.45, jx, 0.68, z, M.deskTop);
          kit.block(0.56, 0.3, 0.03, jx, 0.38, z - 0.2, M.deskWood);
          kit.block(0.03, 0.68, 0.03, jx - 0.27, 0, z - 0.19, M.darkMetal);
          kit.block(0.03, 0.68, 0.03, jx + 0.27, 0, z - 0.19, M.darkMetal);
          kit.block(0.03, 0.68, 0.03, jx - 0.27, 0, z + 0.19, M.darkMetal);
          kit.block(0.03, 0.68, 0.03, jx + 0.27, 0, z + 0.19, M.darkMetal);
          const chair = (row + Math.round(x)) % 2 ? M.chairBlue : M.chairGreen;
          kit.block(0.38, 0.04, 0.36, jx, 0.72, z, chair);
          kit.block(0.38, 0.3, 0.03, jx, 0.76, z + 0.17, chair);
          kit.block(0.025, 0.38, 0.025, jx - 0.17, 0.76, z - 0.15, M.darkMetal);
          kit.block(0.025, 0.38, 0.025, jx + 0.17, 0.76, z - 0.15, M.darkMetal);
        }
      }
      pumpkinAt(L, G.x0 + 0.62, 1.04, G.zc - 0.25);
    },
    /** 연구실·교무실: 선생님 책상 두 줄, 모니터, 책장, 복사기, 정수기 */
    teacher(kit, L, c, run, G) {
      [G.back + 0.45, G.back + 1.5].forEach((z, r) => {
        for (let x = G.x0 + 1.5; x <= G.x1 - 1.4; x += 1.35) {
          kit.block(1.2, 0.04, 0.7, x, 0.72, z, M.deskTop);
          kit.block(1.1, 0.7, 0.62, x, 0.02, z + 0.02, lam(0x8f949c));
          monitor(kit, x, 0.76, z + 0.12, 1);
          kit.box(0.3, 0.02, 0.22, x - 0.32, 0.75, z - 0.1, M.white); // 서류
          if (r === 0) officeChair(kit, x, z - 0.6, 0x2a3a5a);
        }
      });
      kit.block(0.36, 2.0, 3.2, G.x0 + 0.2, 0, G.zc, M.darkWood);
      kit.panel(3.1, 1.9, G.x0 + 0.385, 1.0, G.zc, Math.PI / 2, tmat('books-' + (c.index % 3), () => X.books(70 + (c.index % 3))), [0, 0, 1.5, 2]);
      kit.block(0.62, 1.0, 0.66, G.x1 - 0.45, 0, G.HW + 2.0, lam(0xd8d8d0)); // 복사기
      kit.box(0.62, 0.06, 0.66, G.x1 - 0.45, 1.03, G.HW + 2.0, lam(0x3a3f48));
      kit.block(0.36, 1.1, 0.36, G.x1 - 0.35, 0, G.HW + 3.3, lam(0xe8eef4)); // 정수기
      kit.cyl(0.14, 0.14, 0.4, G.x1 - 0.35, 1.3, G.HW + 3.3, lam(0x7ab8e8), 12);
      pumpkinAt(L, G.x0 + 1.5, 0.76, G.back + 0.3, 0.1);
    },
    /** 회의실·미래실·연수실: 긴 탁자와 의자, 큰 화면, 화이트보드 */
    meeting(kit, L, c, run, G) {
      const tz = G.back + 1.0;
      const tw = G.w - 3.2;
      kit.block(tw, 0.05, 1.3, G.mid, 0.72, tz, M.deskWood);
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => kit.block(0.08, 0.72, 0.08, G.mid + sx * (tw / 2 - 0.2), 0, tz + sz * 0.5, M.darkMetal)));
      for (let x = G.mid - tw / 2 + 0.5; x <= G.mid + tw / 2 - 0.4; x += 0.9) {
        officeChair(kit, x, tz - 0.95, 0x5a3a6a);
        kit.cyl(0.23, 0.23, 0.07, x, 0.46, tz + 0.95, lam(0x5a3a6a), 12);
        kit.box(0.42, 0.42, 0.06, x, 0.74, tz + 1.17, lam(0x5a3a6a));
      }
      kit.box(0.08, 1.05, 1.9, G.x0 + 0.05, 1.6, G.zc, M.black);
      kit.panel(1.8, 0.98, G.x0 + 0.095, 1.6, G.zc, Math.PI / 2, glowMat('meetScreen', () => X.screen(['회의 자료', '할로윈 파티 계획']), { tint: 0x8090b0 }));
      kit.panel(2.4, 1.15, G.x1 - 0.03, 1.5, G.zc, -Math.PI / 2, lam(0xf2f2ee));
      kit.box(0.04, 0.05, 2.4, G.x1 - 0.06, 0.92, G.zc, M.metal);
      W3.plant(kit, G.x1 - 0.5, G.zb - 0.5);
      pumpkinAt(L, G.mid, 0.75, tz, 0.12);
    },
    /** 과학 실험실·시약실: 실험대(검은 상판), 개수대, 비커, 약품장, 인체 모형 */
    lab(kit, L, c, run, G) {
      const colors = [0xff6b6b, 0x5ad18a, 0x6aa8ff, 0xffd166, 0xc77dff];
      [G.back + 0.55, G.back + 1.6].forEach((z, r) => {
        kit.block(G.w - 2.6, 0.86, 0.95, G.mid, 0, z, lam(0xe8e2d4));
        kit.box(G.w - 2.5, 0.05, 1.0, G.mid, 0.885, z, lam(0x1c1c22));
        kit.box(0.5, 0.05, 0.4, G.mid + 1.2, 0.915, z, M.metal);
        kit.box(0.04, 0.32, 0.04, G.mid + 1.2, 1.07, z + 0.18, M.metal);
        for (let i = 0; i < 4; i++) kit.cyl(0.05, 0.06, 0.16, G.mid - 1.6 + i * 0.45, 0.99, z - 0.1 + r * 0.05, lam(colors[(i + r + c.index) % 5], { emissive: colors[(i + r + c.index) % 5] & 0x333333 }), 10);
      });
      kit.block(0.46, 2.0, 2.6, G.x0 + 0.25, 0, G.zc, lam(0xc8ccd2));
      for (let y = 0.55; y < 1.9; y += 0.5)
        for (let i = 0; i < 7; i++) kit.cyl(0.045, 0.045, 0.2, G.x0 + 0.4, y, G.zc - 1.05 + i * 0.35, lam(colors[(i + Math.round(y * 2)) % 5]), 8);
      // 인체 모형 (조금 으스스해요)
      const bone = lam(0xf0ece0);
      kit.cyl(0.12, 0.1, 0.55, G.x1 - 0.5, 1.15, G.HW + 2.2, bone, 10);
      kit.sphere(0.13, G.x1 - 0.5, 1.6, G.HW + 2.2, bone);
      kit.cyl(0.04, 0.04, 0.8, G.x1 - 0.5, 0.45, G.HW + 2.2, M.metal, 6);
      kit.panel(0.9, 0.25, G.x1 - 0.03, 2.2, G.zc, -Math.PI / 2, tmat('labSign', () => X.label('실험실에서 뛰지 않기', '#ffd23f', '#1b1b1b'), { clamp: true, mat: { alphaTest: 0.5 } }));
      pumpkinAt(L, G.mid - 2.2, 0.91, G.back + 0.4, 0.11);
    },
    /** 정보실: 모니터가 놓인 책상 줄 */
    computer(kit, L, c, run, G) {
      [G.back + 0.45, G.back + 1.5].forEach((z) => {
        for (let x = G.x0 + 1.3; x <= G.x1 - 1.2; x += 0.95) {
          kit.block(0.9, 0.04, 0.65, x, 0.72, z, lam(0xd9d4c8));
          kit.block(0.86, 0.7, 0.04, x, 0.02, z + 0.3, lam(0x8f949c));
          monitor(kit, x, 0.76, z + 0.1, 1);
          kit.box(0.42, 0.02, 0.15, x, 0.75, z - 0.15, M.black); // 자판
        }
      });
      for (let z = G.HW + 1.6; z < G.back - 0.2; z += 0.95) {
        kit.block(0.65, 0.04, 0.9, G.x1 - 0.4, 0.72, z, lam(0xd9d4c8));
        kit.box(0.04, 0.34, 0.52, G.x1 - 0.18, 1.03, z, M.black);
        kit.box(0.01, 0.28, 0.46, G.x1 - 0.205, 1.03, z, screenM());
      }
      kit.panel(2.2, 1.3, G.x0 + 0.03, 1.7, G.zc, Math.PI / 2, lam(0xeeeeea)); // 스크린
      pumpkinAt(L, G.x0 + 1.3, 0.76, G.back + 0.25, 0.1);
    },
    /** 자료실: 철제 선반과 상자 */
    storage(kit, L, c, run, G) {
      const r = X.rand(31 + c.index);
      const box = [0xb08a5a, 0xa07a4a, 0xc49a6c, 0x8a6a4a];
      const shelfRun = (axis, fixed, from, to) => {
        for (let p = from; p + 1.0 <= to; p += 1.1) {
          const cx = p + 0.5;
          for (let y = 0.05; y < 2.0; y += 0.5) {
            if (axis === 'x') kit.box(1.0, 0.03, 0.45, cx, y, fixed, M.metal);
            else kit.box(0.45, 0.03, 1.0, fixed, y, cx, M.metal);
            if (y < 1.9 && r() < 0.8) {
              const bw = 0.3 + r() * 0.35;
              const bh = 0.2 + r() * 0.2;
              if (axis === 'x') kit.block(bw, bh, 0.36, cx - 0.2 + r() * 0.3, y + 0.015, fixed, lam(box[Math.floor(r() * 4)]));
              else kit.block(0.36, bh, bw, fixed, y + 0.015, cx - 0.2 + r() * 0.3, lam(box[Math.floor(r() * 4)]));
            }
          }
          if (axis === 'x') kit.box(0.03, 2.0, 0.45, cx + 0.5, 1.0, fixed, M.darkMetal);
          else kit.box(0.45, 2.0, 0.03, fixed, 1.0, cx + 0.5, M.darkMetal);
        }
      };
      shelfRun('x', G.zb - 0.3, G.x0 + 0.3, G.x1 - 0.3);
      shelfRun('x', G.back + 0.6, G.x0 + 1.4, G.x1 - 1.4);
      shelfRun('z', G.x0 + 0.3, G.HW + 1.0, G.zb - 0.8);
      pumpkinAt(L, G.mid, 0.05, G.back + 0.15, 0.12);
    },
    /** 돌봄·늘봄·다이룸터·채움실·나눔실…: 알록달록 매트, 장난감 선반, 빈백 */
    care(kit, L, c, run, G) {
      const mats = [0xff8a8a, 0xffd166, 0x7ad7a0, 0x7ab8ff, 0xc9a0ff];
      let k = 0;
      for (let x = G.x0 + 1.6; x <= G.x1 - 1.5; x += 1.0)
        for (let z = G.HW + 1.0; z <= G.back - 0.3; z += 1.0) kit.flat(0.97, 0.97, x, 0.008, z, lam(mats[k++ % 5]));
      for (let x = G.x0 + 1.0; x + 1.2 <= G.x1 - 0.6; x += 1.4) {
        kit.block(1.2, 0.8, 0.42, x + 0.6, 0, G.zb - 0.3, lam(0xf2d39a));
        kit.block(0.35, 0.25, 0.3, x + 0.35, 0.8, G.zb - 0.3, lam(mats[Math.round(x) % 5]));
        kit.block(0.3, 0.3, 0.3, x + 0.85, 0.8, G.zb - 0.3, lam(mats[(Math.round(x) + 2) % 5]));
      }
      kit.sphere(0.5, G.x0 + 1.0, 0.28, G.back + 0.6, lam(0xff7f50), 0.55); // 빈백
      kit.sphere(0.5, G.x1 - 1.0, 0.28, G.back + 0.8, lam(0x6a8cff), 0.55);
      kit.block(1.2, 0.5, 0.7, G.mid, 0, G.back + 0.8, lam(0xffe08a)); // 낮은 탁자
      kit.panel(2.4, 1.2, G.x0 + 0.03, 1.6, G.zc, Math.PI / 2, tmat('bulletin-care' + (c.index % 3), () => X.bulletin(60 + c.index, ''), { clamp: true }));
      pumpkinAt(L, G.mid, 0.5, G.back + 0.8, 0.14);
    },
  };

  /** 3층 가운데 연결다리 입구 (창가 쪽): 유리창이 달린 긴 다리가 어둠 속으로 이어져요 */
  function buildBridge(L, kit, bx, hall, wallM) {
    const HW = 1.5;
    const HH = 2.4;
    const D = 9; // 보이는 다리 길이
    const a = bx - 1.1;
    const b = bx + 1.1;
    kit.flat(2.2, D, bx, 0.004, -HW - D / 2, M.hallFloor2 || M.hallFloor, [0, 0, 2, D / 1.2]);
    kit.flat(2.2, D, bx, HH, -HW - D / 2, M.ceiling, [0, 0, 2, D / 1.2], false);
    const side = [];
    for (let z = -HW - 0.8; z - 1.6 > -HW - D + 0.4; z -= 2.2) side.push({ a: z - 1.6, b: z, y0: 0.9, y1: 2.1 });
    wallRun(kit, { axis: 'z', fixed: a, from: -HW - D, to: -HW, face: 1, material: wallM, h: HH, holes: side });
    wallRun(kit, { axis: 'z', fixed: b, from: -HW - D, to: -HW, face: -1, material: wallM, h: HH, holes: side });
    side.forEach((hl, i) => {
      windowFrame(kit, { axis: 'z', fixed: a, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: 1, glass: i % 2 ? M.nightMoon : M.night, bars: 1 });
      windowFrame(kit, { axis: 'z', fixed: b, a: hl.a, b: hl.b, y0: hl.y0, y1: hl.y1, face: -1, glass: M.night, bars: 1 });
    });
    kit.panel(2.2, HH, bx, HH / 2, -HW - D, 0, M.void); // 다리 끝은 캄캄
    kit.box(2.3, 0.08, 0.14, bx, HH + 0.04, -HW + 0.02, M.darkWood);
    // 표지판: 어느 건물로 가는 다리인지
    const other = hall.def.building === 'sin' ? '본관' : '신관';
    const sign = tmat('bridgeSign-' + other, () => X.label('연결다리 → ' + other, 'rgba(159,240,216,0.95)', '#0b2a24'), { clamp: true, mat: { alphaTest: 0.5 } });
    kit.panel(1.5, 0.37, bx, 2.65, -HW + 0.02, 0, sign);
    kit.panel(0.6, 0.3, bx, HH - 0.25, -HW - 0.6, 0, M.exitSign);
  }

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
      const SD = 4.2; // 계단실 깊이
      const LOW = 1.8; // 아래층 쪽으로 보이는 깊이
      const stepM = lam(0x9a9488);
      const nose = lam(0x5a5650);
      const ux = x0 + 1.4; // 올라가는 계단
      const dx = x1 - 1.4; // 내려가는 계단 (들키면 여기로 도망쳐요)
      for (let i = 0; i < 9; i++) {
        kit.block(1.6, 0.17 * (i + 1), 0.3, ux, 0, HW + 0.2 + i * 0.3, stepM);
        kit.box(1.6, 0.03, 0.04, ux, 0.17 * (i + 1), HW + 0.07 + i * 0.3, nose);
        kit.block(1.6, LOW - 0.17 * (i + 1), 0.3, dx, -LOW, HW + 0.15 + i * 0.3, stepM);
        kit.box(1.6, 0.03, 0.04, dx, -0.17 * (i + 1), HW + 0.02 + i * 0.3, nose);
      }
      // 계단참 (아래층으로 꺾어 내려가는 곳)
      kit.block(1.7, LOW - 1.53, SD - 2.7, dx, -LOW, HW + 2.7 + (SD - 2.7) / 2, stepM);
      kit.panel(1.6, HH - 1.53, ux, 1.53 + (HH - 1.53) / 2, HW + 2.9, Math.PI, M.black); // 올라가는 계단 끝은 캄캄해요
      kit.block(1.6, 1.53, SD - 2.9, ux, 0, HW + 2.9 + (SD - 2.9) / 2, M.black);
      // 벽: 계단실은 아래층까지 이어져요
      kit.panel(SD, HH + LOW, x0 + 0.5, (HH - LOW) / 2, HW + SD / 2, Math.PI / 2, wallM, [0, -LOW / 3, SD / 2, HH / 3]);
      kit.panel(SD, HH + LOW, x1 - 0.5, (HH - LOW) / 2, HW + SD / 2, -Math.PI / 2, wallM, [0, -LOW / 3, SD / 2, HH / 3]);
      kit.panel(w - 1, HH + LOW, mid, (HH - LOW) / 2, HW + SD, Math.PI, wallM, [0, -LOW / 3, (w - 1) / 2, HH / 3]);
      kit.panel(SD, LOW, mid + 0.03, -LOW / 2, HW + SD / 2, Math.PI / 2, wallM, [0, 0, SD / 2, LOW / 3]);
      kit.flat(w - 1, SD, mid, HH, HW + SD / 2, M.ceiling, [0, 0, (w - 1) / 1.2, SD / 1.2], false);
      kit.box(0.05, 0.9, 3.0, mid, 0.75, HW + 1.5, M.metal); // 난간
      kit.box(0.08, 0.06, 3.0, mid, 1.2, HW + 1.5, M.darkWood);
      kit.add(BOX(0.06, 0.06, 3.1), M.darkWood, x1 - 0.62, 0.9 - 0.77, HW + 1.35, 0, Math.atan2(1.53, 2.7)); // 내려가는 손잡이
      // 계단참 벽: 아래층 표시와 비상구 불빛
      const down = tmat('stairsDown-' + hall.def.floor, () => X.label('↓ ' + Math.max(1, hall.def.floor - 1) + '층 (아래층)', 'rgba(40,160,90,0.95)', '#ffffff'), { clamp: true, mat: { alphaTest: 0.5 } });
      kit.panel(1.3, 0.33, dx, -0.55, HW + SD - 0.02, Math.PI, down);
      kit.panel(0.6, 0.3, dx, 0.35, HW + SD - 0.02, Math.PI, M.exitSign);
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
      // 정전: 버튼 불도 꺼져 있고, 문에 안내문이 붙어 있어요
      const outM = tmat('evOut', () => X.label('⚡ 정전 · 운행 중지', '#ffd23f', '#1b1b1b'), { clamp: true, mat: { alphaTest: 0.5 } });
      kit.panel(0.95, 0.24, mid, 1.45, HW - 0.005, Math.PI, outM);
      return;
    }
    if (c.kind === 'entrance') {
      wallRun(kit, { axis: 'x', fixed: HW, from: x0, to: x1, face: -1, material: wallM, holes: [{ a: x0 + 0.8, b: x1 - 0.8, y0: 0, y1: 2.6 }] });
      const yardM = glowMat('yard', () => X.yard(), { tint: 0x9098b8 });
      kit.panel(w - 1.6, 2.6, mid, 1.3, HW + 0.5, Math.PI, yardM);
      for (let x = x0 + 0.8; x <= x1 - 0.8 + 0.01; x += (w - 1.6) / 4) kit.box(0.08, 2.6, 0.1, x, 1.3, HW + 0.1, M.frameDark);
      kit.box(w - 1.6, 0.08, 0.1, mid, 2.6, HW + 0.1, M.frameDark);
      kit.box(0.5, 0.06, 0.06, mid, 1.0, HW + 0.05, lam(0x8a8a8a)); // 체인
      const lockSign = tmat('lockedSign', () => X.label('잠겨 있어요', '#d7263d', '#fff'), { clamp: true, mat: { alphaTest: 0.5 } });
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
    const openRoom = hall.rooms.find((r) => r.cell === c.index);
    const lockedRoom = (hall.locked || []).find((l) => l.cell === c.index);
    if (openRoom) buildRoomInside(L, kit, c, holes, run);
    doorXs.forEach((dx, i) => {
      const open = doorsOpen.has(Math.round(dx * 10));
      // 문틀
      kit.box(1.08, 0.06, 0.12, dx, 2.13, HW, M.darkWood);
      kit.box(0.05, 2.1, 0.12, dx - 0.52, 1.05, HW, M.darkWood);
      kit.box(0.05, 2.1, 0.12, dx + 0.52, 1.05, HW, M.darkWood);
      // 문: 들어갈 수 있는 실은 미닫이문이 드르륵 열려요 (처음엔 닫혀 있어요)
      if (openRoom) {
        const dm = new T.Mesh(rect(1.0, 2.08, 0, 0, 1, 1), i ? M.doorDark : M.door);
        dm.position.set(dx, 1.04, HW + 0.05);
        dm.rotation.y = Math.PI;
        L.scene.add(dm);
        L.slideDoors.push({ x: dx, mesh: dm });
        return;
      }
      kit.panel(1.0, 2.08, dx + (open ? 0.96 : 0), 1.04, HW + 0.05, Math.PI, i ? M.doorDark : M.door);
      // 잠긴 실: 문고리에 자물쇠
      if (lockedRoom && lockedRoom.why !== 'done') {
        kit.box(0.16, 0.05, 0.05, dx + 0.36, 1.05, HW - 0.01, M.darkMetal);
        kit.box(0.1, 0.12, 0.05, dx + 0.42, 0.97, HW - 0.04, lam(0xb8a040, { emissive: 0x1a1400 }));
      }
      // 닫힌 교실: 문 안쪽은 캄캄해요
      kit.panel(1.0, 2.1, dx, 1.05, HW + 0.9, Math.PI, M.void);
      kit.panel(0.85, 2.1, dx - 0.5, 1.05, HW + 0.45, Math.PI / 2, M.black);
      kit.panel(0.85, 2.1, dx + 0.5, 1.05, HW + 0.45, -Math.PI / 2, M.black);
    });
    // 팻말: 복도로 튀어나온 이름판 (앞문 위)
    const label = /^\d-\d$/.test(c.name) ? c.name.replace('-', '학년 ') + '반' : c.name;
    const plate = tmat('plate-' + c.name, () => X.namePlate(c.name, /^\d-\d$/.test(c.name) ? label : run.school), { clamp: true });
    const px = doorXs[0];
    kit.box(0.04, 0.3, 0.62, px, 2.5, HW - 0.31, M.white);
    kit.panel(0.6, 0.28, px + 0.022, 2.5, HW - 0.31, Math.PI / 2, plate);
    kit.panel(0.6, 0.28, px - 0.022, 2.5, HW - 0.31, -Math.PI / 2, plate);
    // 교실 앞 신발장 (우리 반은 친구 이름표), 그 위에 게시판
    const classroom = /^\d-\d$/.test(c.name) && doorXs.length === 2;
    if (classroom) {
      const mine = c.name === run.myClass && run.friends && run.friends.length;
      const shoeM = mine
        ? tmat('shoesClass-' + c.name + '-' + run.friends.join(','), () => X.shoeLockers(90 + c.index, run.friends, 12, null, 4))
        : tmat('shoesClass-' + (c.index % 3), () => X.shoeLockers(90 + (c.index % 3), null, 12, null, 4));
      kit.block(3.4, 1.0, 0.3, mid, 0, HW - 0.15, lam(0x7a5a3a));
      kit.panel(3.36, 0.98, mid, 0.5, HW - 0.305, Math.PI, shoeM);
      kit.box(3.44, 0.04, 0.32, mid, 1.02, HW - 0.15, M.darkWood);
    }
    // 게시판 (문 사이 벽, 큰 방만)
    if (doorXs.length === 2) {
      const bb = tmat('bulletin-' + (c.index % 4), () => X.bulletin(41 + c.index, ''), { clamp: true });
      if (classroom) kit.panel(2.4, 0.6, mid, 1.4, HW - 0.02, Math.PI, bb, [0, 0.25, 1, 0.75]);
      else kit.panel(2.4, 1.2, mid, 1.1, HW - 0.02, Math.PI, bb);
    }
    if (c.index % 3 === 1) extinguisher(kit, x1 - 0.25, HW - 0.2, 0);
  }
})();
