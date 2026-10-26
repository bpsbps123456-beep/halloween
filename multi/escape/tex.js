/* 동암초 탈출 — 3D 학교에 입힐 그림(텍스처)을 코드로 그려요. 그림 파일이 하나도 없어요.
   모두 캔버스를 돌려주고, world.js 가 THREE 텍스처로 바꿔요. */
(function () {
  'use strict';

  const X = (window.EscapeTex = {});
  const TAU = Math.PI * 2;
  const UI = () => HG.FONT_UI;
  const DISPLAY = () => HG.FONT_DISPLAY;

  function make(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  function rand(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  X.rand = rand;
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  X.rr = rr;
  /** 글자 (너무 길면 줄여서 maxW 안에) */
  function txt(g, str, x, y, size, color, o) {
    o = o || {};
    let s = size;
    const font = () => (o.weight ? o.weight + ' ' : '') + s + 'px ' + (o.font || UI());
    g.font = font();
    if (o.maxW) {
      while (s > 8 && g.measureText(str).width > o.maxW) {
        s -= 1;
        g.font = font();
      }
    }
    g.textAlign = o.align || 'center';
    g.textBaseline = o.baseline || 'middle';
    if (o.stroke) {
      g.lineJoin = 'round';
      g.lineWidth = o.strokeWidth || 4;
      g.strokeStyle = o.stroke;
      g.strokeText(str, x, y);
    }
    g.fillStyle = color;
    g.fillText(str, x, y);
  }
  X.txt = txt;
  function speckle(g, w, h, n, colors, rnd, size, alpha) {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = (alpha || 0.5) * (0.4 + rnd() * 0.6);
      g.fillStyle = colors[Math.floor(rnd() * colors.length)];
      const s = (0.4 + rnd()) * (size || 2);
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
    g.globalAlpha = 1;
  }
  function grain(g, w, h, rnd, n, color, alpha) {
    g.strokeStyle = color;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * (0.3 + rnd() * 0.7);
      g.lineWidth = 0.6 + rnd() * 1.4;
      const y = rnd() * h;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 2 + (rnd() - 0.5) * 1.5);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  /* ---------------- 바닥·벽·천장 ---------------- */
  /** 복도 바닥: 테라조 타일 (한 장 = 60cm, 그림 하나 = 1.2m) */
  X.terrazzo = function (base, grout, seed) {
    const c = make(512, 512);
    const g = c.getContext('2d');
    const r = rand(seed || 11);
    g.fillStyle = base || '#a4ad9e';
    g.fillRect(0, 0, 512, 512);
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.04})`;
        g.fillRect(tx * 256, ty * 256, 256, 256);
      }
    speckle(g, 512, 512, 3800, ['#ffffff', '#5b6458', '#d5dacf', '#7c877a', '#efe8d6', '#3f463d'], r, 2.4, 0.55);
    // 은은한 광택
    const sh = g.createLinearGradient(0, 0, 512, 512);
    sh.addColorStop(0, 'rgba(255,255,255,0.05)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(255,255,255,0.04)');
    g.fillStyle = sh;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = grout || '#6c7468';
    g.lineWidth = 3;
    [0, 256, 512].forEach((v) => {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, 512);
      g.moveTo(0, v);
      g.lineTo(512, v);
      g.stroke();
    });
    return c;
  };

  /** 교실 마루 (나무 판, 그림 하나 = 2m) */
  X.woodFloor = function (seed, tone) {
    const c = make(512, 512);
    const g = c.getContext('2d');
    const r = rand(seed || 5);
    const base = tone || [168, 122, 78];
    const rows = 10;
    const h = 512 / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 200;
      while (x < 512) {
        const len = 160 + r() * 200;
        const k = 0.82 + r() * 0.3;
        g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
        g.fillRect(x, i * h, len, h);
        g.fillStyle = 'rgba(40,20,5,0.55)';
        g.fillRect(x, i * h, 2, h);
        x += len;
      }
      g.fillStyle = 'rgba(40,20,5,0.5)';
      g.fillRect(0, i * h, 512, 2);
    }
    grain(g, 512, 512, r, 140, '#3a2410', 0.18);
    return c;
  };

  /** 비닐 타일 (보건실·교무실) */
  X.vinyl = function (seed, base) {
    const c = make(512, 512);
    const g = c.getContext('2d');
    const r = rand(seed || 9);
    g.fillStyle = base || '#d8cfbd';
    g.fillRect(0, 0, 512, 512);
    for (let ty = 0; ty < 4; ty++)
      for (let tx = 0; tx < 4; tx++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
        g.fillRect(tx * 128, ty * 128, 128, 128);
      }
    speckle(g, 512, 512, 1500, ['#8a7f6a', '#f6f0e2', '#b3a68c'], r, 1.8, 0.4);
    g.strokeStyle = 'rgba(80,70,50,0.35)';
    g.lineWidth = 2;
    for (let v = 0; v <= 512; v += 128) {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, 512);
      g.moveTo(0, v);
      g.lineTo(512, v);
      g.stroke();
    }
    return c;
  };

  /** 벽 (그림 하나 = 가로 2m, 세로 3m: 아래 1m 징두리판, 그 위 띠, 하얀 벽) */
  X.wall = function (lower, upper, seed) {
    const c = make(512, 768);
    const g = c.getContext('2d');
    const r = rand(seed || 3);
    const H = 768;
    const m = H / 3; // 1m
    g.fillStyle = upper || '#e6e2d6';
    g.fillRect(0, 0, 512, H);
    speckle(g, 512, H - m, 1800, ['#ffffff', '#cfc9b8'], r, 2, 0.25);
    // 아래 징두리판
    g.fillStyle = lower || '#8fb39a';
    g.fillRect(0, H - m * 1.0, 512, m * 1.0);
    for (let x = 0; x < 512; x += 128) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(x, H - m, 3, m);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(x + 3, H - m, 2, m);
    }
    speckle(g, 512, m, 400, ['#ffffff', '#000000'], r, 1.5, 0.08);
    // 걸레받이와 손잡이 띠
    g.fillStyle = '#5a4535';
    g.fillRect(0, H - 22, 512, 22);
    g.fillStyle = '#9b7a55';
    g.fillRect(0, H - m - 14, 512, 16);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, H - m - 14, 512, 3);
    // 위쪽 몰딩
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 0, 512, 10);
    return c;
  };

  /** 천장 텍스 (그림 하나 = 1.2m) */
  X.ceiling = function (seed) {
    const c = make(256, 256);
    const g = c.getContext('2d');
    const r = rand(seed || 7);
    g.fillStyle = '#d9d6cf';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(90,85,75,${0.2 + r() * 0.3})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 0.8 + r() * 1.2, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#a8a397';
    g.lineWidth = 3;
    [0, 128, 256].forEach((v) => {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, 256);
      g.moveTo(0, v);
      g.lineTo(256, v);
      g.stroke();
    });
    return c;
  };

  /** 화장실 타일 */
  X.tiles = function (color, seed) {
    const c = make(256, 256);
    const g = c.getContext('2d');
    const r = rand(seed || 13);
    g.fillStyle = '#9aa3ad';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const k = 0.9 + r() * 0.12;
        g.fillStyle = color || `rgb(${200 * k | 0},${214 * k | 0},${224 * k | 0})`;
        g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
      }
    return c;
  };

  /** 방음벽 (방송실) */
  X.foam = function () {
    const c = make(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#3b4258';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const cx = x * 32 + 16 + (y % 2) * 16;
        const cy = y * 32 + 16;
        const gr = g.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, 16);
        gr.addColorStop(0, '#6c7594');
        gr.addColorStop(1, '#2b3044');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx % 256, cy, 14, 0, TAU);
        g.fill();
      }
    return c;
  };

  /* ---------------- 문·창문·표지 ---------------- */
  /** 교실 미닫이문 (1m × 2.1m) */
  X.door = function (tone, seed) {
    const c = make(256, 540);
    const g = c.getContext('2d');
    const r = rand(seed || 21);
    g.fillStyle = '#6b5442';
    g.fillRect(0, 0, 256, 540);
    g.fillStyle = tone || '#c49a6c';
    g.fillRect(10, 10, 236, 520);
    grain(g, 256, 540, r, 50, '#6b4a2a', 0.15);
    // 위쪽 유리
    g.fillStyle = '#4b4f63';
    g.fillRect(40, 50, 176, 200);
    const gl = g.createLinearGradient(40, 50, 216, 250);
    gl.addColorStop(0, 'rgba(160,190,255,0.35)');
    gl.addColorStop(0.45, 'rgba(160,190,255,0.06)');
    gl.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    gl.addColorStop(1, 'rgba(120,140,200,0.1)');
    g.fillStyle = gl;
    g.fillRect(40, 50, 176, 200);
    g.strokeStyle = '#3c2f25';
    g.lineWidth = 6;
    g.strokeRect(40, 50, 176, 200);
    // 손잡이 홈과 아래 발판
    g.fillStyle = '#4a3a2c';
    rr(g, 196, 300, 26, 64, 8);
    g.fill();
    g.fillStyle = '#9aa0a8';
    g.fillRect(10, 470, 236, 60);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 6; i++) g.fillRect(20, 480 + i * 9, 216, 2);
    return c;
  };

  /** 교실 팻말 (복도로 튀어나온 이름판) */
  X.namePlate = function (name, sub) {
    const c = make(512, 160);
    const g = c.getContext('2d');
    g.fillStyle = '#28303f';
    rr(g, 0, 0, 512, 160, 18);
    g.fill();
    g.fillStyle = '#f7f3e6';
    rr(g, 10, 10, 492, 140, 12);
    g.fill();
    g.fillStyle = '#2f7a4f';
    g.fillRect(10, 118, 492, 32);
    txt(g, name, 256, 66, 76, '#1b2233', { maxW: 460 });
    txt(g, sub || '동암초등학교', 256, 135, 22, '#ffffff', { maxW: 460 });
    return c;
  };

  /** 비상구 표지 (초록 바탕, 달리는 사람) */
  X.exitSign = function () {
    const c = make(256, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#1e9e55';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#f2fff6';
    g.fillRect(14, 14, 76, 100);
    g.fillStyle = '#1e9e55';
    g.fillRect(20, 20, 64, 88);
    // 달리는 사람
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(150, 32, 11, 0, TAU);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(146, 46);
    g.lineTo(134, 76);
    g.lineTo(150, 98);
    g.moveTo(134, 76);
    g.lineTo(114, 104);
    g.moveTo(144, 54);
    g.lineTo(168, 66);
    g.moveTo(144, 54);
    g.lineTo(122, 62);
    g.stroke();
    // 화살표
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(190, 48);
    g.lineTo(226, 64);
    g.lineTo(190, 80);
    g.closePath();
    g.fill();
    g.fillRect(176, 58, 20, 12);
    txt(g, '비상구', 204, 108, 20, '#ffffff');
    return c;
  };

  /** 밤 창밖 (하늘·달·별·나무·건너편 건물) */
  X.nightWindow = function (seed, moon) {
    const c = make(512, 512);
    const g = c.getContext('2d');
    const r = rand(seed || 31);
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#070b22');
    sky.addColorStop(0.6, '#18204a');
    sky.addColorStop(1, '#2a2650');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.7})`;
      g.fillRect(r() * 512, r() * 300, 1.5 + r() * 1.5, 1.5 + r() * 1.5);
    }
    if (moon) {
      const mx = 330 + r() * 80;
      const glow = g.createRadialGradient(mx, 110, 10, mx, 110, 120);
      glow.addColorStop(0, 'rgba(255,240,200,0.5)');
      glow.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 512, 300);
      g.fillStyle = '#fff3cf';
      g.beginPath();
      g.arc(mx, 110, 42, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(200,180,140,0.35)';
      g.beginPath();
      g.arc(mx - 12, 100, 9, 0, TAU);
      g.arc(mx + 14, 122, 6, 0, TAU);
      g.fill();
    }
    // 먼 산
    g.fillStyle = '#141530';
    g.beginPath();
    g.moveTo(0, 360);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, 330 + Math.sin(x * 0.015 + r() * 0.3) * 26);
    g.lineTo(512, 512);
    g.lineTo(0, 512);
    g.fill();
    // 건너편 건물
    g.fillStyle = '#0c0d20';
    g.fillRect(40, 300, 300, 212);
    for (let y = 320; y < 500; y += 40)
      for (let x = 56; x < 330; x += 34) {
        g.fillStyle = r() < 0.1 ? '#ffd27a' : 'rgba(80,90,140,0.35)';
        g.fillRect(x, y, 20, 22);
      }
    // 나무
    g.fillStyle = '#05060f';
    for (let i = 0; i < 6; i++) {
      const tx = r() * 512;
      g.beginPath();
      g.arc(tx, 430, 40 + r() * 30, 0, TAU);
      g.fill();
      g.fillRect(tx - 5, 430, 10, 90);
    }
    return c;
  };

  /** 바닥에 비친 창 모양 달빛 */
  X.moonPatch = function () {
    const c = make(256, 256);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    gr.addColorStop(0, 'rgba(170,190,255,0.55)');
    gr.addColorStop(1, 'rgba(170,190,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillRect(124, 0, 10, 256);
    g.fillRect(0, 120, 256, 10);
    return c;
  };

  /** 게시판 (코르크 + 아이들 그림) */
  X.bulletin = function (seed, title, noPumpkin) {
    const c = make(512, 256);
    const g = c.getContext('2d');
    const r = rand(seed || 41);
    g.fillStyle = '#6e4a2e';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#bb8b56';
    g.fillRect(10, 10, 492, 236);
    speckle(g, 512, 256, 2200, ['#8a6034', '#d9ae78', '#6b4523'], r, 2, 0.5);
    if (title) {
      g.fillStyle = '#ff8a1f';
      rr(g, 156, 16, 200, 34, 8);
      g.fill();
      txt(g, title, 256, 34, 22, '#2a1400', { maxW: 190 });
    }
    const pal = ['#fff6d6', '#d6f0ff', '#ffe0ec', '#e2ffd8', '#efe2ff', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      const w = 80 + r() * 30;
      const h = 90 + r() * 40;
      const x = 22 + i * 80 + r() * 8;
      const y = title ? 62 + r() * 40 : 26 + r() * 60;
      g.save();
      g.translate(x + w / 2, y + h / 2);
      g.rotate((r() - 0.5) * 0.16);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
      g.fillStyle = pal[i % pal.length];
      g.fillRect(-w / 2, -h / 2, w, h);
      // 아이 그림: 집, 해, 사람, 호박 …
      const kind = noPumpkin ? 1 + Math.floor(r() * 3) : Math.floor(r() * 4);
      g.lineWidth = 3;
      if (kind === 0) {
        g.fillStyle = '#ff8a1f';
        g.beginPath();
        g.ellipse(0, 10, 26, 20, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#2b1a0a';
        g.beginPath();
        g.moveTo(-12, 4);
        g.lineTo(-6, -4);
        g.lineTo(0, 4);
        g.moveTo(4, 4);
        g.lineTo(10, -4);
        g.lineTo(16, 4);
        g.fill();
        g.fillStyle = '#3c7d2f';
        g.fillRect(-3, -16, 6, 8);
      } else if (kind === 1) {
        g.strokeStyle = '#2f6bff';
        g.strokeRect(-24, -4, 48, 34);
        g.beginPath();
        g.moveTo(-30, -2);
        g.lineTo(0, -28);
        g.lineTo(30, -2);
        g.stroke();
        g.fillStyle = '#ffd23f';
        g.beginPath();
        g.arc(26, -36, 9, 0, TAU);
        g.fill();
      } else if (kind === 2) {
        g.strokeStyle = '#333';
        g.beginPath();
        g.arc(0, -20, 10, 0, TAU);
        g.moveTo(0, -10);
        g.lineTo(0, 16);
        g.moveTo(-16, -2);
        g.lineTo(16, -2);
        g.moveTo(0, 16);
        g.lineTo(-12, 34);
        g.moveTo(0, 16);
        g.lineTo(12, 34);
        g.stroke();
      } else {
        g.fillStyle = '#9b4dd8';
        g.beginPath();
        g.moveTo(-26, 28);
        g.quadraticCurveTo(-24, -30, 0, -32);
        g.quadraticCurveTo(24, -30, 26, 28);
        g.fill();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(-8, -10, 5, 0, TAU);
        g.arc(8, -10, 5, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#d7263d';
      g.beginPath();
      g.arc(0, -h / 2 + 6, 4, 0, TAU);
      g.fill();
      g.restore();
    }
    return c;
  };

  /** 청소함 앞면 (0.9m × 1.9m) */
  X.locker = function (label) {
    const c = make(256, 540);
    const g = c.getContext('2d');
    const base = g.createLinearGradient(0, 0, 256, 0);
    base.addColorStop(0, '#6f8199');
    base.addColorStop(0.5, '#8ea0b8');
    base.addColorStop(1, '#6a7c94');
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 540);
    g.strokeStyle = '#4b5a6e';
    g.lineWidth = 4;
    g.strokeRect(6, 6, 244, 528);
    g.beginPath();
    g.moveTo(128, 6);
    g.lineTo(128, 534);
    g.stroke();
    // 환기 구멍 (안에 숨으면 이 틈으로 밖이 보여요)
    g.fillStyle = '#1c222c';
    [40, 460].forEach((y) => {
      for (let i = 0; i < 6; i++) {
        rr(g, 22, y + i * 9, 88, 4, 2);
        g.fill();
        rr(g, 146, y + i * 9, 88, 4, 2);
        g.fill();
      }
    });
    g.fillStyle = '#c9ced6';
    rr(g, 108, 250, 10, 44, 3);
    g.fill();
    rr(g, 138, 250, 10, 44, 3);
    g.fill();
    g.fillStyle = '#f7f3e6';
    g.fillRect(78, 150, 100, 40);
    txt(g, label || '청소함', 128, 171, 26, '#1b2233', { maxW: 92 });
    return c;
  };

  /** 교실 뒤 사물함 (12칸 × 2줄) */
  X.cubbies = function (seed, names) {
    const c = make(1024, 256);
    const g = c.getContext('2d');
    const r = rand(seed || 51);
    g.fillStyle = '#8a6a4a';
    g.fillRect(0, 0, 1024, 256);
    const pal = ['#f1e3c6', '#e3d2b0', '#ecdcbf'];
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 12; i++) {
        const x = 8 + i * 84.5;
        const y = 8 + row * 124;
        g.fillStyle = pal[(i + row) % 3];
        g.fillRect(x, y, 78, 116);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 60, y + 50, 10, 18);
        const name = names && names[row * 12 + i];
        g.fillStyle = '#ffffff';
        g.fillRect(x + 6, y + 10, 66, 24);
        txt(g, name || String(row * 12 + i + 1), x + 39, y + 23, name ? 18 : 15, '#333', { maxW: 62 });
        if (r() < 0.15) {
          g.fillStyle = ['#3d6bd8', '#9b4dd8', '#2fbf71'][Math.floor(r() * 3)];
          rr(g, x + 24, y + 70, 30, 22, 5);
          g.fill();
        }
      }
    return c;
  };

  /** 책등이 빼곡한 책장 칸 */
  X.books = function (seed) {
    const c = make(512, 256);
    const g = c.getContext('2d');
    const r = rand(seed || 61);
    g.fillStyle = '#2a1a10';
    g.fillRect(0, 0, 512, 256);
    // 보라색 책은 없어요 (빛나는 속담 책과 헷갈리지 않게)
    const pal = ['#8e2b2b', '#2b4f8e', '#2f7a4f', '#c08a2a', '#2b7a8a', '#8a5a2b', '#3d3d3d', '#b8452a', '#d8cfa0', '#5a6b2b'];
    for (let row = 0; row < 2; row++) {
      let x = 4;
      const y1 = row * 128 + 124;
      while (x < 506) {
        const w = 10 + r() * 18;
        const h = 80 + r() * 38;
        const col = pal[Math.floor(r() * pal.length)];
        if (r() < 0.06) {
          // 비스듬히 기댄 책
          g.save();
          g.translate(x, y1);
          g.rotate(-0.25);
          g.fillStyle = col;
          g.fillRect(0, -h, w, h);
          g.restore();
          x += w + 18;
          continue;
        }
        g.fillStyle = col;
        g.fillRect(x, y1 - h, w, h);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x + 1, y1 - h, 2, h);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + w - 2, y1 - h, 2, h);
        g.fillStyle = 'rgba(255,240,200,0.6)';
        g.fillRect(x + 2, y1 - h + 12, w - 4, 3);
        g.fillRect(x + 2, y1 - 22, w - 4, 3);
        x += w + 1;
      }
      g.fillStyle = '#5a3b22';
      g.fillRect(0, y1, 512, 4);
    }
    return c;
  };

  /* ---------------- 칠판·화이트보드 ---------------- */
  function chalkBoard(w, h) {
    const c = make(w, h);
    const g = c.getContext('2d');
    const r = rand(71);
    g.fillStyle = '#5b3d26';
    g.fillRect(0, 0, w, h);
    const b = g.createLinearGradient(0, 0, w, h);
    b.addColorStop(0, '#244d3d');
    b.addColorStop(1, '#1b3d31');
    g.fillStyle = b;
    g.fillRect(14, 14, w - 28, h - 28);
    // 지운 자국
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 60 + r() * 120, 20 + r() * 40, r() * 3, 0, TAU);
      g.fill();
    }
    return { c, g };
  }
  function chalk(g, str, x, y, size, color, align) {
    g.save();
    g.shadowColor = color || '#f4f1e6';
    g.shadowBlur = 2;
    txt(g, str, x, y, size, color || '#f4f1e6', { align: align || 'center', font: DISPLAY() });
    g.restore();
  }
  X.chalk = chalk;

  /** 분필 그림 아이콘 */
  function icon(g, kind, x, y, s, mode) {
    const ink = mode === 'ink';
    g.save();
    g.translate(x, y);
    g.scale(s / 40, s / 40);
    g.lineWidth = ink ? 2.5 : 3.2;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const stroke = (c) => {
      g.strokeStyle = c;
      g.stroke();
    };
    if (kind === '🎃') {
      g.beginPath();
      g.ellipse(0, 4, 18, 15, 0, 0, TAU);
      if (ink) {
        g.fillStyle = '#ff8a1f';
        g.fill();
      }
      stroke(ink ? '#8a3b00' : '#ffb35c');
      g.beginPath();
      g.moveTo(-6, -10);
      g.quadraticCurveTo(0, 4, -6, 18);
      g.moveTo(6, -10);
      g.quadraticCurveTo(0, 4, 6, 18);
      stroke(ink ? '#b85a10' : '#ffb35c');
      g.beginPath();
      g.moveTo(0, -11);
      g.lineTo(2, -19);
      stroke(ink ? '#2f7a2f' : '#b7f09a');
    } else if (kind === '🦇') {
      g.beginPath();
      g.moveTo(0, -2);
      g.quadraticCurveTo(-10, -14, -22, -8);
      g.quadraticCurveTo(-18, 0, -20, 6);
      g.quadraticCurveTo(-12, 2, -8, 8);
      g.quadraticCurveTo(-4, 4, 0, 8);
      g.quadraticCurveTo(4, 4, 8, 8);
      g.quadraticCurveTo(12, 2, 20, 6);
      g.quadraticCurveTo(18, 0, 22, -8);
      g.quadraticCurveTo(10, -14, 0, -2);
      if (ink) {
        g.fillStyle = '#2a2140';
        g.fill();
      }
      stroke(ink ? '#2a2140' : '#d9ccff');
      g.beginPath();
      g.arc(0, 0, 4, 0, TAU);
      stroke(ink ? '#2a2140' : '#d9ccff');
    } else if (kind === '🕷️') {
      g.beginPath();
      g.arc(0, 4, 8, 0, TAU);
      g.moveTo(5, -6);
      g.arc(0, -6, 5, 0, TAU);
      if (ink) {
        g.fillStyle = '#222';
        g.fill();
      }
      stroke(ink ? '#222' : '#f4f1e6');
      g.beginPath();
      [-1, 1].forEach((sd) => {
        for (let k = 0; k < 4; k++) {
          const yy = -2 + k * 4;
          g.moveTo(sd * 6, yy);
          g.quadraticCurveTo(sd * 16, yy - 8, sd * 22, yy + 6);
        }
      });
      stroke(ink ? '#222' : '#f4f1e6');
    } else if (kind === '🩹') {
      g.save();
      g.rotate(-0.6);
      g.beginPath();
      rr(g, -22, -8, 44, 16, 8);
      g.fillStyle = ink ? '#f2c79a' : 'rgba(255,255,255,0.2)';
      g.fill();
      stroke(ink ? '#a8754a' : '#ffe0c0');
      g.fillStyle = ink ? '#e8d2b8' : 'rgba(255,255,255,0.4)';
      g.fillRect(-7, -6, 14, 12);
      g.restore();
    } else if (kind === '💊') {
      g.save();
      g.rotate(-0.5);
      g.beginPath();
      rr(g, -20, -8, 40, 16, 8);
      g.fillStyle = ink ? '#ffffff' : 'rgba(255,255,255,0.2)';
      g.fill();
      stroke(ink ? '#555' : '#ffd6d6');
      g.beginPath();
      g.moveTo(-20 + 8, -8);
      g.arcTo(-20, -8, -20, 0, 8);
      g.arcTo(-20, 8, -12, 8, 8);
      g.lineTo(0, 8);
      g.lineTo(0, -8);
      g.closePath();
      g.fillStyle = ink ? '#e8443a' : 'rgba(255,120,120,0.6)';
      g.fill();
      g.restore();
    } else if (kind === '🌡️') {
      g.beginPath();
      rr(g, -5, -20, 10, 30, 5);
      g.fillStyle = ink ? '#ffffff' : 'rgba(255,255,255,0.15)';
      g.fill();
      stroke(ink ? '#555' : '#f4f1e6');
      g.beginPath();
      g.arc(0, 14, 8, 0, TAU);
      g.fillStyle = '#e8443a';
      g.fill();
      g.fillRect(-2, -8, 4, 20);
    }
    g.restore();
  }
  X.icon = icon;
  const ICONS = ['🎃', '🦇', '🕷️', '🩹', '💊', '🌡️'];

  /** 그림 식 한 줄: ['🎃','×','🦇','−','🕷️'] 처럼 아이콘과 글자를 섞어 그려요 */
  function tokens(g, list, cx, y, size, color, mode) {
    const font = (mode === 'ink' ? '' : '') + size + 'px ' + (mode === 'ink' ? UI() : DISPLAY());
    g.font = font;
    const widths = list.map((tk) => (ICONS.indexOf(tk) >= 0 ? size * 1.15 : g.measureText(tk).width + size * 0.25));
    let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
    list.forEach((tk, i) => {
      const w = widths[i];
      if (ICONS.indexOf(tk) >= 0) icon(g, tk, x + w / 2, y, size, mode);
      else if (mode === 'ink') txt(g, tk, x + w / 2, y, size, color);
      else chalk(g, tk, x + w / 2, y, size, color);
      x += w;
    });
  }
  X.tokens = tokens;

  /** 분필로 그은 바를 정(正) 표시: n번 */
  function tally(g, x, y, n, size) {
    g.save();
    g.strokeStyle = '#f4f1e6';
    g.lineWidth = size * 0.09;
    g.lineCap = 'round';
    g.shadowColor = '#f4f1e6';
    g.shadowBlur = 2;
    for (let k = 0; k < n; k++) {
      const box = Math.floor(k / 5);
      const st = k % 5;
      const ox = x + box * size * 1.15;
      const w = size * 0.8;
      g.beginPath();
      if (st === 0) {
        g.moveTo(ox, y - size * 0.42);
        g.lineTo(ox + w, y - size * 0.42);
      } else if (st === 1) {
        g.moveTo(ox + w / 2, y - size * 0.42);
        g.lineTo(ox + w / 2, y + size * 0.42);
      } else if (st === 2) {
        g.moveTo(ox + w / 2, y);
        g.lineTo(ox + w * 0.9, y);
      } else if (st === 3) {
        g.moveTo(ox + w * 0.15, y - size * 0.05);
        g.lineTo(ox + w * 0.15, y + size * 0.42);
      } else {
        g.moveTo(ox, y + size * 0.42);
        g.lineTo(ox + w, y + size * 0.42);
      }
      g.stroke();
    }
    g.restore();
  }
  const nameHash = (str) => Array.from(str).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

  /** 우리 반 칠판: 담임 선생님, 주번, 떠든 사람 + 유령의 수수께끼
      o = { school, myClass, teacher, duty: [], noisy: [] } */
  /** 복도 옆 다른 교실 칠판 (밤이라 아무도 없어요) */
  X.roomBoard = function () {
    const { c, g } = chalkBoard(960, 320);
    chalk(g, '10월 31일 할로윈', 480, 70, 44, '#ffd9a0');
    chalk(g, '복도에서 뛰지 않기!', 480, 150, 38);
    chalk(g, '숙제: 분장 준비물 챙기기', 480, 215, 30, '#d6f5ff');
    chalk(g, '🎃', 840, 260, 48);
    return c;
  };
  X.classBoard = function (o, form) {
    const { c, g } = chalkBoard(1280, 384);
    // 왼쪽: 우리 반 소식
    chalk(g, '할로윈 파티 D-0', 270, 58, 46, '#ffd9a0');
    chalk(g, o.teacher ? '담임  ' + o.teacher + ' 선생님' : o.school + ' ' + o.myClass, 270, 112, 30);
    if (o.duty && o.duty.length) chalk(g, '주번  ' + o.duty.join(', '), 270, 156, 28, '#d6f5ff');
    else chalk(g, o.school + ' ' + o.myClass, 270, 156, 24, '#d6f5ff');
    chalk(g, '★ 사탕 나눔 6교시   ★ 분장 대회 강당', 270, 198, 22, '#ffd0e6');
    // 떠든 사람 (정 표시)
    const noisy = o.noisy && o.noisy.length ? o.noisy.slice(0, 4) : ['유령 부'];
    g.strokeStyle = 'rgba(244,241,230,0.75)';
    g.lineWidth = 3;
    g.strokeRect(40, 226, 470, 136);
    chalk(g, '떠든 사람', 110, 250, 26, '#ffe9a8');
    noisy.forEach((name, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 60 + col * 230;
      const y = 290 + row * 46;
      chalk(g, name, x, y, 28, '#f4f1e6', 'left');
      g.font = '28px ' + DISPLAY();
      tally(g, x + Math.min(110, g.measureText(name).width + 14), y, 3 + (nameHash(name) % 6), 26);
    });
    // 가운데 줄
    g.fillStyle = 'rgba(244,241,230,0.35)';
    g.fillRect(548, 40, 4, 310);
    // 오른쪽: 유령의 수수께끼
    chalk(g, '★ 오늘의 수수께끼 ★', 910, 58, 34, '#ffe9a8');
    tokens(g, form.concat(['=', '?']), 910, 146, 60, '#f4f1e6', 'chalk');
    chalk(g, '교실에 숨은 것들을 모두 세어 봐!', 910, 232, 30, '#d6f5ff');
    chalk(g, '답은 ' + (o.teacher ? o.teacher + ' ' : '') + '선생님 책상 서랍 비밀번호', 910, 284, 26, '#ffd0e6');
    chalk(g, '— 유령 부', 1180, 330, 24, '#ffd0e6');
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(70, 372, 30, 6);
    g.fillRect(1180, 372, 22, 6);
    return c;
  };

  /** 급훈 액자 */
  X.motto = function (text) {
    const c = make(1024, 256);
    const g = c.getContext('2d');
    const r = rand(17);
    g.fillStyle = '#5a3b22';
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#fbf7ea';
    g.fillRect(18, 18, 988, 220);
    speckle(g, 1024, 256, 300, ['#d8d0b8'], r, 2, 0.3);
    txt(g, '급 훈', 512, 54, 28, '#c0392b');
    txt(g, text, 512, 150, 84, '#1b2233', { font: DISPLAY(), maxW: 940 });
    return c;
  };

  /** 과학실 칠판: 물약 비율 */
  X.potionBoard = function (recipes) {
    const { c, g } = chalkBoard(1024, 380);
    chalk(g, '마녀의 물약 만들기', 512, 46, 42, '#d9b3ff');
    recipes.forEach((rc, i) => {
      const x = 180 + i * 332;
      g.fillStyle = HGcolor(rc.color);
      g.beginPath();
      g.arc(x - 70, 108, 16, 0, TAU);
      g.fill();
      chalk(g, i + 1 + '. ' + rc.color + ' 물약', x + 10, 106, 32, '#f4f1e6');
      rc.lines.forEach((ln, k) => {
        g.save();
        g.shadowColor = '#ffe9a8';
        g.shadowBlur = 2;
        txt(g, ln, x, 160 + k * 52, k ? 22 : 30, k ? '#ffe9a8' : '#d6f5ff', { maxW: 312 }); // ÷ 가 잘 보이는 글꼴
        g.restore();
      });
    });
    g.fillStyle = 'rgba(244,241,230,0.35)';
    g.fillRect(345, 80, 3, 250);
    g.fillRect(677, 80, 3, 250);
    chalk(g, '※ 계산한 양을 정확히 부을 것!  눈금은 10mL', 512, 350, 24, '#ffd0e6');
    return c;
  };
  function HGcolor(name) {
    return (window.EscapeCore && window.EscapeCore.COLORS[name]) || '#888';
  }

  /** 교무실 화이트보드: 자리 단서 */
  X.officeBoard = function (lines, title) {
    const c = make(1024, 560);
    const g = c.getContext('2d');
    g.fillStyle = '#b8bec8';
    g.fillRect(0, 0, 1024, 560);
    g.fillStyle = '#fbfcfe';
    g.fillRect(14, 14, 996, 532);
    const sh = g.createLinearGradient(0, 0, 1024, 560);
    sh.addColorStop(0, 'rgba(200,215,240,0.25)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(200,215,240,0.2)');
    g.fillStyle = sh;
    g.fillRect(14, 14, 996, 532);
    txt(g, title || '선생님 자리 (왼쪽부터 1~5번)', 512, 56, 38, '#c0392b', { maxW: 960 });
    lines.forEach((ln, i) => txt(g, '• ' + ln, 50, 120 + i * 66, 30, '#1b3a8a', { align: 'left', maxW: 940 }));
    txt(g, '— 6학년 연구실 메모', 960, 520, 22, '#555', { align: 'right' });
    g.fillStyle = '#d7263d';
    g.fillRect(60, 536, 80, 10);
    g.fillStyle = '#1b3a8a';
    g.fillRect(160, 536, 80, 10);
    return c;
  };

  /* ---------------- 포스터 ---------------- */
  function paper(w, h, color) {
    const c = make(w, h);
    const g = c.getContext('2d');
    g.fillStyle = color || '#fbf7ea';
    g.fillRect(0, 0, w, h);
    const r = rand(w + h);
    speckle(g, w, h, 300, ['#d8d0b8', '#ffffff'], r, 2, 0.3);
    return { c, g };
  }

  /** 방송실 모스 부호표 */
  X.morsePoster = function (MORSE) {
    const { c, g } = paper(512, 768, '#fff8e8');
    g.fillStyle = '#c0392b';
    g.fillRect(0, 0, 512, 96);
    txt(g, '모스 부호 (숫자)', 256, 50, 44, '#ffffff');
    txt(g, '●  짧게 삐   ▬  길게 삐—', 256, 128, 26, '#333');
    for (let d = 0; d < 10; d++) {
      const col = d < 5 ? 0 : 1;
      const row = d % 5;
      const digit = (d + 1) % 10; // 1 2 3 4 5 / 6 7 8 9 0
      const x = 30 + col * 246;
      const y = 180 + row * 112;
      g.fillStyle = col ? '#eef4ff' : '#fff0e0';
      rr(g, x, y, 222, 96, 12);
      g.fill();
      txt(g, String(digit), x + 34, y + 50, 52, '#1b2233', { font: DISPLAY() });
      const code = MORSE[digit];
      let px = x + 74;
      Array.from(code).forEach((sym) => {
        g.fillStyle = '#1b2233';
        if (sym === '.') {
          g.beginPath();
          g.arc(px + 8, y + 50, 8, 0, TAU);
          g.fill();
          px += 24;
        } else {
          rr(g, px, y + 43, 26, 14, 6);
          g.fill();
          px += 34;
        }
      });
    }
    txt(g, '숫자와 숫자 사이는 조금 길게 쉬어요', 256, 740, 22, '#555');
    return c;
  };

  /** 도서관 한국십진분류 포스터 */
  X.kdcPoster = function () {
    const { c, g } = paper(512, 768, '#f2fbff');
    g.fillStyle = '#2b6cb0';
    g.fillRect(0, 0, 512, 96);
    txt(g, '책의 주소 (십진분류)', 256, 50, 40, '#fff');
    const rows = [
      ['000', '총류', '#9aa3ad'],
      ['100', '철학', '#c08a2a'],
      ['200', '종교', '#8a5a2b'],
      ['300', '사회과학', '#2f7a4f'],
      ['400', '자연과학', '#2b7a8a'],
      ['500', '기술과학', '#3d6bd8'],
      ['600', '예술', '#b8452a'],
      ['700', '언어', '#6a3d8e'],
      ['800', '문학', '#d7263d'],
      ['900', '역사', '#5a4535'],
    ];
    rows.forEach((rw, i) => {
      const y = 140 + i * 60;
      g.fillStyle = rw[2];
      rr(g, 50, y - 22, 110, 44, 10);
      g.fill();
      txt(g, rw[0], 105, y, 28, '#fff');
      txt(g, rw[1], 200, y, 30, '#1b2233', { align: 'left' });
    });
    txt(g, '속담 책은 어디에 있을까?', 256, 744, 24, '#555');
    return c;
  };

  /** 복도 안전 포스터 */
  X.safetyPoster = function (kind) {
    const { c, g } = paper(512, 700, kind === 1 ? '#fff4f4' : '#f4fff6');
    const sets = [
      ['복도에서는', '사뿐사뿐 걸어요', '#2f7a4f'],
      ['불이 나면', '계단으로 대피해요', '#c0392b'],
      ['손을 깨끗이', '30초 동안 씻어요', '#2b6cb0'],
    ];
    const s = sets[kind % sets.length];
    g.fillStyle = s[2];
    g.fillRect(0, 0, 512, 120);
    txt(g, s[0], 256, 64, 52, '#fff');
    txt(g, s[1], 256, 200, 48, s[2]);
    // 그림: 발자국 / 계단 / 비누
    g.fillStyle = s[2];
    if (kind % 3 === 0) {
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse(170 + i * 60, 470 - (i % 2) * 70, 22, 36, 0.2, 0, TAU);
        g.fill();
      }
    } else if (kind % 3 === 1) {
      for (let i = 0; i < 5; i++) g.fillRect(120 + i * 56, 560 - i * 56, 220 - i * 30, 24);
      txt(g, '엘리베이터 ✕   계단 ○', 256, 330, 40, '#333');
    } else {
      g.beginPath();
      g.ellipse(256, 450, 110, 60, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc(160 + i * 28, 360 - (i % 3) * 30, 14, 0, TAU);
        g.fill();
      }
    }
    txt(g, '동암초 생활 안전', 256, 666, 24, '#666');
    return c;
  };

  /** 할로윈 포스터 */
  X.halloweenPoster = function () {
    const { c, g } = paper(512, 700, '#2a1640');
    g.fillStyle = '#ff8a1f';
    txt(g, '해피 할로윈', 256, 90, 70, '#ff8a1f', { font: DISPLAY() });
    txt(g, '10월 31일', 256, 170, 40, '#ffd166');
    icon(g, '🎃', 256, 380, 260, 'ink');
    icon(g, '🦇', 110, 250, 80, 'ink');
    icon(g, '🦇', 410, 230, 70, 'ink');
    txt(g, '사탕 많이 받으세요!', 256, 620, 34, '#f4f1e6');
    return c;
  };

  /** 6-3 시간표 */
  X.timetable = function (myClass, teacher) {
    const { c, g } = paper(512, 512, '#fffdf4');
    txt(g, myClass + ' 시간표' + (teacher ? ' · 담임 ' + teacher : ''), 256, 44, teacher ? 32 : 40, '#c0392b', { maxW: 480 });
    const days = ['월', '화', '수', '목', '금'];
    const subj = [
      ['국어', '수학', '사회', '과학', '체육'],
      ['수학', '영어', '국어', '음악', '국어'],
      ['과학', '국어', '수학', '사회', '할로윈'],
      ['체육', '실과', '창체', '수학', '파티'],
      ['음악', '미술', '', '영어', '파티'],
    ];
    days.forEach((d, i) => txt(g, d, 110 + i * 80, 100, 30, '#2b6cb0'));
    subj.forEach((row, r) =>
      row.forEach((sname, i) => {
        g.fillStyle = sname === '할로윈' || sname === '파티' ? '#ffe0b8' : r % 2 ? '#f2f6ff' : '#ffffff';
        g.fillRect(74 + i * 80, 124 + r * 72, 74, 66);
        txt(g, sname, 111 + i * 80, 158 + r * 72, 24, '#1b2233');
      })
    );
    subj.forEach((_, r) => txt(g, r + 1 + '', 40, 158 + r * 72, 24, '#888'));
    return c;
  };

  /** 2026년 10월 달력 (31일에 동그라미) */
  X.calendar = function () {
    const { c, g } = paper(384, 448, '#ffffff');
    g.fillStyle = '#d7263d';
    g.fillRect(0, 0, 384, 70);
    txt(g, '2026년 10월', 192, 38, 34, '#fff');
    const head = ['일', '월', '화', '수', '목', '금', '토'];
    head.forEach((h, i) => txt(g, h, 30 + i * 54, 96, 20, i === 0 ? '#d7263d' : '#333'));
    // 2026년 10월 1일은 목요일
    for (let d = 1; d <= 31; d++) {
      const k = d + 3;
      const col = k % 7;
      const row = Math.floor(k / 7);
      const x = 30 + col * 54;
      const y = 136 + row * 56;
      txt(g, String(d), x, y, 24, col === 0 ? '#d7263d' : '#333');
      if (d === 31) {
        g.strokeStyle = '#ff8a1f';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, 22, 0, TAU);
        g.stroke();
        txt(g, '할로윈!', x - 8, y + 34, 16, '#ff8a1f');
      }
    }
    return c;
  };

  /** 벽시계 */
  X.clock = function (h, m) {
    const c = make(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(128, 128, 120, 0, TAU);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#33405a';
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      txt(g, String(i || 12), 128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92, 26, '#222');
    }
    const hand = (a, len, w) => {
      g.lineWidth = w;
      g.lineCap = 'round';
      g.strokeStyle = '#222';
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      g.stroke();
    };
    hand((((h % 12) + m / 60) / 12) * TAU, 56, 9);
    hand((m / 60) * TAU, 84, 6);
    return c;
  };

  /** 시력표 */
  X.eyeChart = function () {
    const { c, g } = paper(320, 640, '#ffffff');
    txt(g, '시력표', 160, 40, 30, '#c0392b');
    const rows = ['ㅁ', 'ㅇ ㅅ', 'ㄱ ㄴ ㄷ', 'ㅂ ㅈ ㅎ ㅊ', 'ㄹ ㅋ ㅌ ㅍ ㅁ', 'ㅅ ㅇ ㄱ ㄴ ㄷ ㅂ'];
    rows.forEach((rw, i) => txt(g, rw, 160, 110 + i * 86, 70 - i * 10, '#111'));
    return c;
  };

  /** 키 재기 자 */
  X.heightChart = function () {
    const c = make(128, 1024);
    const g = c.getContext('2d');
    g.fillStyle = '#ffe9a8';
    g.fillRect(0, 0, 128, 1024);
    for (let cm = 0; cm <= 100; cm += 1) {
      const y = 1024 - (cm / 100) * 1024;
      g.fillStyle = '#5a3b00';
      g.fillRect(0, y, cm % 10 === 0 ? 60 : cm % 5 === 0 ? 40 : 20, 2);
      if (cm % 10 === 0 && cm > 0) txt(g, String(100 + cm), 92, y + 2, 22, '#5a3b00');
    }
    return c;
  };

  /** 보건실 처방전 쪽지 */
  X.note = function (tokenList, n) {
    const { c, g } = paper(512, 320, '#fffef4');
    g.fillStyle = '#d7263d';
    g.fillRect(0, 0, 512, 52);
    txt(g, '처방전 ' + n, 256, 28, 30, '#fff');
    g.strokeStyle = 'rgba(80,120,200,0.25)';
    for (let y = 90; y < 320; y += 40) {
      g.beginPath();
      g.moveTo(20, y);
      g.lineTo(492, y);
      g.stroke();
    }
    tokens(g, tokenList, 256, 180, 50, '#1b2233', 'ink');
    txt(g, '— 보건 선생님', 470, 290, 20, '#888', { align: 'right' });
    return c;
  };

  /** 신발장 */
  X.shoeLockers = function (seed) {
    const c = make(512, 512);
    const g = c.getContext('2d');
    const r = rand(seed || 81);
    g.fillStyle = '#7a5a3a';
    g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 6; x++) {
        const px = 8 + x * 84;
        const py = 8 + y * 84;
        g.fillStyle = '#2a1d12';
        g.fillRect(px, py, 78, 78);
        if (r() < 0.7) {
          g.fillStyle = ['#e8e8f0', '#2f6bff', '#e8443a', '#ffd23f', '#333'][Math.floor(r() * 5)];
          g.beginPath();
          g.ellipse(px + 26, py + 62, 18, 9, 0, 0, TAU);
          g.ellipse(px + 54, py + 62, 18, 9, 0, 0, TAU);
          g.fill();
        }
        g.fillStyle = '#fff';
        g.fillRect(px + 22, py + 4, 34, 12);
      }
    return c;
  };

  /** 약장 앞면 (유리 + 약병) */
  X.medicine = function (seed, noCross) {
    const c = make(512, 640);
    const g = c.getContext('2d');
    const r = rand(seed || 91);
    g.fillStyle = '#e9eef2';
    g.fillRect(0, 0, 512, 640);
    g.fillStyle = '#cfd8df';
    g.fillRect(16, 16, 480, 608);
    for (let s = 0; s < 4; s++) {
      const y = 40 + s * 150;
      g.fillStyle = '#9fb0bd';
      g.fillRect(16, y + 120, 480, 8);
      let x = 30;
      while (x < 470) {
        const w = 26 + r() * 26;
        const h = 50 + r() * 60;
        g.fillStyle = ['#ffffff', '#e8443a', '#2f6bff', '#ffd23f', '#2fbf71', '#b48cff', '#f4a261'][Math.floor(r() * 7)];
        rr(g, x, y + 120 - h, w, h, 6);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(x + 4, y + 120 - h + 16, w - 8, 14);
        x += w + 8;
      }
    }
    const gl = g.createLinearGradient(0, 0, 512, 640);
    gl.addColorStop(0, 'rgba(255,255,255,0.35)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0.02)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    gl.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gl;
    g.fillRect(16, 16, 480, 608);
    g.strokeStyle = '#8a99a6';
    g.lineWidth = 8;
    g.strokeRect(16, 16, 480, 608);
    g.beginPath();
    g.moveTo(256, 16);
    g.lineTo(256, 624);
    g.stroke();
    if (!noCross) {
      // 빨간 십자
      g.fillStyle = '#e8443a';
      g.fillRect(226, 28, 60, 20);
      g.fillRect(246, 8, 20, 60);
    }
    return c;
  };

  /** 방송 장비 판 (페이더, 손잡이, 불빛) */
  X.console = function () {
    const c = make(1024, 384);
    const g = c.getContext('2d');
    g.fillStyle = '#23262f';
    g.fillRect(0, 0, 1024, 384);
    for (let i = 0; i < 16; i++) {
      const x = 40 + i * 60;
      g.fillStyle = '#0e1016';
      g.fillRect(x + 16, 150, 8, 200);
      g.fillStyle = '#c9ced6';
      g.fillRect(x + 4, 200 + ((i * 37) % 120), 32, 18);
      for (let k = 0; k < 3; k++) {
        g.fillStyle = '#3a3f4c';
        g.beginPath();
        g.arc(x + 20, 30 + k * 40, 13, 0, TAU);
        g.fill();
        g.strokeStyle = ['#ffd166', '#9ff0d8', '#ff6fae'][k];
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x + 20, 30 + k * 40);
        g.lineTo(x + 20 + Math.cos(i + k) * 11, 30 + k * 40 + Math.sin(i + k) * 11);
        g.stroke();
      }
    }
    return c;
  };

  /** 모니터 화면 */
  X.screen = function (lines, color) {
    const c = make(512, 320);
    const g = c.getContext('2d');
    g.fillStyle = '#05080f';
    g.fillRect(0, 0, 512, 320);
    const gl = g.createRadialGradient(256, 160, 20, 256, 160, 300);
    gl.addColorStop(0, 'rgba(60,90,160,0.5)');
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, 512, 320);
    (lines || []).forEach((ln, i) => txt(g, ln, 256, 110 + i * 60, i ? 30 : 44, color || '#9ff0d8', { maxW: 480 }));
    return c;
  };

  /** ON AIR 등 */
  X.onAir = function (on) {
    const c = make(512, 160);
    const g = c.getContext('2d');
    g.fillStyle = '#1a0c0c';
    rr(g, 0, 0, 512, 160, 24);
    g.fill();
    g.fillStyle = on ? '#ff2a2a' : '#4a1414';
    rr(g, 14, 14, 484, 132, 16);
    g.fill();
    txt(g, 'ON AIR', 256, 82, 92, on ? '#fff6f0' : '#7a3a3a', { weight: '700' });
    return c;
  };

  /** 학교 이름 현판 */
  X.plaque = function (school) {
    const c = make(1024, 256);
    const g = c.getContext('2d');
    const r = rand(99);
    g.fillStyle = '#4a2e18';
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#7a4e2a';
    g.fillRect(16, 16, 992, 224);
    grain(g, 1024, 256, r, 60, '#3a2210', 0.25);
    txt(g, school, 512, 132, 120, '#ffd98a', { font: DISPLAY(), stroke: '#2a1608', strokeWidth: 8, maxW: 940 });
    return c;
  };

  /** 트로피 진열장 */
  X.trophies = function () {
    const c = make(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = '#2a2236';
    g.fillRect(0, 0, 512, 512);
    for (let s = 0; s < 3; s++) {
      const y = 150 + s * 160;
      g.fillStyle = '#5a4a6a';
      g.fillRect(10, y, 492, 8);
      for (let i = 0; i < 5; i++) {
        const x = 50 + i * 100;
        g.fillStyle = i % 2 ? '#e8c35a' : '#c9ced6';
        g.beginPath();
        g.moveTo(x - 22, y - 110);
        g.lineTo(x + 22, y - 110);
        g.quadraticCurveTo(x + 20, y - 60, x + 4, y - 48);
        g.lineTo(x + 4, y - 24);
        g.lineTo(x + 16, y - 24);
        g.lineTo(x + 16, y);
        g.lineTo(x - 16, y);
        g.lineTo(x - 16, y - 24);
        g.lineTo(x - 4, y - 24);
        g.lineTo(x - 4, y - 48);
        g.quadraticCurveTo(x - 20, y - 60, x - 22, y - 110);
        g.fill();
      }
    }
    const gl = g.createLinearGradient(0, 0, 512, 512);
    gl.addColorStop(0, 'rgba(255,255,255,0.18)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, 512, 512);
    return c;
  };

  /** 현관 유리문 밖: 운동장 밤 풍경 */
  X.yard = function () {
    const c = make(512, 512);
    const g = c.getContext('2d');
    const r = rand(111);
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#0a0f2c');
    sky.addColorStop(0.55, '#1f2a5a');
    sky.addColorStop(0.56, '#3a3324');
    sky.addColorStop(1, '#5a4a32');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.6})`;
      g.fillRect(r() * 512, r() * 260, 2, 2);
    }
    g.fillStyle = '#fff3cf';
    g.beginPath();
    g.arc(400, 90, 30, 0, TAU);
    g.fill();
    g.fillStyle = '#0a0b18';
    for (let i = 0; i < 9; i++) {
      const tx = i * 64 + r() * 20;
      g.beginPath();
      g.arc(tx, 270, 30 + r() * 20, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#d8d0b8';
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(256, 420, 200, 50, 0, 0, TAU);
    g.stroke();
    return c;
  };

  /* ---------------- 반짝이는 표시 (스프라이트) ---------------- */
  X.label = function (text, bg, fg) {
    const c = make(512, 128);
    const g = c.getContext('2d');
    g.fillStyle = bg || 'rgba(255,209,102,0.92)';
    rr(g, 6, 14, 500, 100, 50);
    g.fill();
    txt(g, text, 256, 66, 56, fg || '#2a1400', { maxW: 460 });
    return c;
  };
  X.bang = function (ch, color) {
    const c = make(128, 128);
    const g = c.getContext('2d');
    txt(g, ch, 64, 70, 110, color, { font: DISPLAY(), stroke: '#1a0000', strokeWidth: 10 });
    return c;
  };
  X.mark = function () {
    const c = make(128, 128);
    const g = c.getContext('2d');
    g.strokeStyle = '#9ff0d8';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(64, 64, 50, 0, TAU);
    g.stroke();
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(38, 66);
    g.lineTo(58, 86);
    g.lineTo(92, 44);
    g.stroke();
    return c;
  };
  X.glow = function (color) {
    const c = make(128, 128);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, color || 'rgba(255,240,180,1)');
    gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return c;
  };
  /** 손전등 빛 원뿔: 위(손전등 쪽)에서 진하고 아래(먼 쪽)로 흐려져요 */
  X.beam = function () {
    const c = make(16, 256);
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 16, 256);
    return c;
  };
  /** 꼬마 유령 '부' */
  X.ghost = function () {
    const c = make(256, 256);
    const g = c.getContext('2d');
    const glow = g.createRadialGradient(128, 120, 20, 128, 120, 128);
    glow.addColorStop(0, 'rgba(200,220,255,0.5)');
    glow.addColorStop(1, 'rgba(200,220,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#f6f1ff';
    g.beginPath();
    g.moveTo(60, 200);
    g.quadraticCurveTo(56, 50, 128, 44);
    g.quadraticCurveTo(200, 50, 196, 200);
    for (let i = 0; i < 4; i++) g.quadraticCurveTo(180 - i * 34, 230, 162 - i * 34, 204);
    g.closePath();
    g.fill();
    g.fillStyle = '#2a1d3f';
    g.beginPath();
    g.ellipse(104, 116, 10, 14, 0, 0, TAU);
    g.ellipse(152, 116, 10, 14, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#ff9ec7';
    g.beginPath();
    g.ellipse(88, 142, 10, 6, 0, 0, TAU);
    g.ellipse(168, 142, 10, 6, 0, 0, TAU);
    g.fill();
    g.strokeStyle = '#2a1d3f';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(128, 140, 12, 0.2, Math.PI - 0.2);
    g.stroke();
    return c;
  };
  /** 거미줄 (투명 바탕) */
  X.cobweb = function () {
    const c = make(256, 256);
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(230,230,255,0.55)';
    g.lineWidth = 1.6;
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 250, Math.sin(a) * 250);
      g.stroke();
    }
    for (let k = 1; k <= 6; k++) {
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * (Math.PI / 2);
        const rr2 = k * 38 + (i % 2) * 6;
        const x = Math.cos(a) * rr2;
        const y = Math.sin(a) * rr2;
        if (i === 0) g.moveTo(x, y);
        else g.quadraticCurveTo(Math.cos(a - 0.13) * (rr2 - 10), Math.sin(a - 0.13) * (rr2 - 10), x, y);
      }
      g.stroke();
    }
    return c;
  };
  /** 커튼 */
  X.curtain = function (color) {
    const c = make(256, 512);
    const g = c.getContext('2d');
    for (let x = 0; x < 256; x++) {
      const k = 0.78 + 0.22 * Math.sin(x * 0.12);
      const base = color || [238, 214, 140];
      g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      g.fillRect(x, 0, 1, 512);
    }
    return c;
  };
})();
