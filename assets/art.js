/* 할로윈 게임 파티 — 캐릭터와 소품 그림 (그림 파일 없이 캔버스로 그립니다) */
(function () {
  'use strict';

  const HG = (window.HG = window.HG || {});
  const art = (HG.art = {});
  const TAU = Math.PI * 2;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  art.roundRect = rr;

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  /* 한 번 그려 둔 그림을 다시 쓰는 저장소 (화살, 달처럼 자주 그리는 것) */
  const cache = new Map();
  art.sprite = function (key, w, h, draw) {
    let s = cache.get(key);
    if (!s) {
      const k = 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * k);
      c.height = Math.ceil(h * k);
      const x = c.getContext('2d');
      x.scale(k, k);
      draw(x);
      s = { canvas: c, w, h };
      cache.set(key, s);
    }
    return s;
  };

  /* ---------------- 호박 머리 ---------------- */
  art.pumpkin = function (ctx, cx, cy, rx, ry, face, lit) {
    const g = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, 1, cx, cy, rx * 1.15);
    g.addColorStop(0, '#ffb551');
    g.addColorStop(1, '#e2600b');
    ctx.fillStyle = g;
    blob(ctx, cx - rx * 0.42, cy, rx * 0.62, ry);
    blob(ctx, cx + rx * 0.42, cy, rx * 0.62, ry);
    blob(ctx, cx, cy, rx * 0.6, ry * 1.03);

    ctx.strokeStyle = 'rgba(176, 70, 6, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.2, cy, rx * 0.32, ry * 0.95, 0, -1.3, 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.2, cy, rx * 0.32, ry * 0.95, 0, Math.PI - 1.3, Math.PI + 1.3);
    ctx.stroke();

    // 꼭지와 잎
    ctx.fillStyle = '#4f7d2b';
    rr(ctx, cx - 2.4, cy - ry - 4.5, 4.8, 7, 2);
    ctx.fill();
    ctx.fillStyle = '#80b24c';
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - ry - 1);
    ctx.quadraticCurveTo(cx + 9, cy - ry - 8, cx + 12, cy - ry - 2);
    ctx.quadraticCurveTo(cx + 7, cy - ry + 1, cx + 2, cy - ry - 1);
    ctx.fill();

    // 얼굴 (안에서 촛불이 비치는 구멍)
    const glow = lit === false ? '#3a1600' : '#ffd166';
    ctx.fillStyle = glow;
    const e = rx * 0.36;
    if (face === 'scared') {
      blob(ctx, cx - e, cy - ry * 0.18, rx * 0.15, ry * 0.22);
      blob(ctx, cx + e, cy - ry * 0.18, rx * 0.15, ry * 0.22);
      blob(ctx, cx, cy + ry * 0.42, rx * 0.16, ry * 0.2);
      return;
    }
    if (face === 'wow') {
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx - e, cy - ry * 0.1, rx * 0.16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + e, cy - ry * 0.1, rx * 0.16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - e - rx * 0.17, cy - ry * 0.02);
      ctx.lineTo(cx - e, cy - ry * 0.42);
      ctx.lineTo(cx - e + rx * 0.17, cy - ry * 0.02);
      ctx.closePath();
      ctx.moveTo(cx + e - rx * 0.17, cy - ry * 0.02);
      ctx.lineTo(cx + e, cy - ry * 0.42);
      ctx.lineTo(cx + e + rx * 0.17, cy - ry * 0.02);
      ctx.closePath();
      ctx.fill();
    }
    // 웃는 입과 이빨 두 개
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.55, cy + ry * 0.2);
    ctx.quadraticCurveTo(cx, cy + ry * 0.95, cx + rx * 0.55, cy + ry * 0.2);
    ctx.quadraticCurveTo(cx, cy + ry * 0.5, cx - rx * 0.55, cy + ry * 0.2);
    ctx.fill();
    ctx.fillStyle = '#e2600b';
    ctx.fillRect(cx - rx * 0.24, cy + ry * 0.33, rx * 0.13, ry * 0.16);
    ctx.fillRect(cx + rx * 0.11, cy + ry * 0.33, rx * 0.13, ry * 0.16);
  };

  /* ---------------- 호박군 (호박분투 주인공) ----------------
     (x, y)는 몸 전체의 가운데. 발끝은 y + 25. */
  function leg(ctx, x, y, angle) {
    const ex = x + Math.sin(angle) * 9;
    const ey = y + Math.cos(angle) * 9;
    ctx.strokeStyle = '#2b1d3f';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = '#120d1c';
    blob(ctx, ex + 1.5, ey + 1, 4, 2.6);
  }

  art.pumpkinBoy = function (ctx, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    const pose = o.pose || 'run';
    const ph = t * 16;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (pose === 'run') ctx.translate(0, -Math.abs(Math.sin(ph)) * 2);

    // 망토
    const flap = Math.sin(t * 12) * 2 + (pose === 'swing' ? 6 : 4);
    ctx.fillStyle = '#6a34a8';
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.quadraticCurveTo(-13 - flap, 6, -17 - flap, 16 + flap * 0.3);
    ctx.lineTo(-3, 13);
    ctx.closePath();
    ctx.fill();

    // 다리
    let a1 = 0;
    let a2 = 0;
    if (pose === 'run') {
      a1 = Math.sin(ph) * 0.75;
      a2 = -a1;
    } else if (pose === 'swing') {
      a1 = 0.4;
      a2 = 0.15;
    } else if (pose !== 'idle') {
      a1 = -0.7;
      a2 = 0.45;
    }
    leg(ctx, -4, 13, a1);
    leg(ctx, 4, 13, a2);

    // 몸통
    ctx.fillStyle = '#4b2378';
    rr(ctx, -8, 0, 16, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-8, 9, 16, 2.4);

    // 팔
    ctx.strokeStyle = '#4b2378';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    if (pose === 'swing') {
      ctx.beginPath();
      ctx.moveTo(4, 3);
      ctx.lineTo(5, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(-10, 8);
      ctx.stroke();
    } else {
      const sw = pose === 'run' ? Math.sin(ph) * 5 : -6;
      ctx.beginPath();
      ctx.moveTo(5, 3);
      ctx.lineTo(10, 9 + sw * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5, 3);
      ctx.lineTo(-10, 9 - sw * 0.5);
      ctx.stroke();
    }

    art.pumpkin(ctx, 0, -11, 17, 14, o.face || 'happy');
    ctx.restore();
  };

  /* ---------------- 꼬마 유령 (죽림고스트 주인공) ---------------- */
  art.ghost = function (ctx, x, y, o) {
    o = o || {};
    const t = o.t || 0;
    const r = o.r || 20;
    ctx.save();
    ctx.translate(x, y);
    if (o.tilt) ctx.rotate(o.tilt);
    if (o.scale) ctx.scale(o.scale, o.scale);

    if (o.glow !== false) {
      const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.3);
      halo.addColorStop(0, 'rgba(190, 240, 255, 0.28)');
      halo.addColorStop(1, 'rgba(190, 240, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.3, 0, TAU);
      ctx.fill();
    }

    // 몸통: 둥근 머리 + 물결 치마
    const top = -0.25 * r;
    const hem = 0.78 * r;
    ctx.beginPath();
    ctx.arc(0, top, r, Math.PI, 0, false);
    ctx.lineTo(r, hem);
    const bumps = 4;
    for (let i = 0; i < bumps; i++) {
      const x0 = r - (i * 2 * r) / bumps;
      const x1 = r - ((i + 1) * 2 * r) / bumps;
      const wave = Math.sin(t * 7 + i * 1.7) * 0.12 * r;
      ctx.quadraticCurveTo((x0 + x1) / 2, hem + 0.42 * r + wave, x1, hem);
    }
    ctx.closePath();
    const body = ctx.createLinearGradient(0, -r * 1.2, 0, r * 1.2);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(1, '#d8ccf6');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 90, 170, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 작은 팔
    const wave = Math.sin(t * 5) * 0.15 * r;
    ctx.fillStyle = '#efe9ff';
    blob(ctx, -r * 0.98, r * 0.12 + wave, r * 0.22, r * 0.14);
    blob(ctx, r * 0.98, r * 0.12 - wave, r * 0.22, r * 0.14);

    // 볼
    ctx.fillStyle = 'rgba(255, 140, 180, 0.55)';
    blob(ctx, -r * 0.55, r * 0.08, r * 0.17, r * 0.1);
    blob(ctx, r * 0.55, r * 0.08, r * 0.17, r * 0.1);

    // 얼굴
    const face = o.face || 'normal';
    ctx.fillStyle = '#1b1230';
    ctx.strokeStyle = '#1b1230';
    ctx.lineCap = 'round';
    if (face === 'hit') {
      ctx.lineWidth = r * 0.09;
      [-1, 1].forEach((s) => {
        const ex = s * r * 0.36;
        const ey = -r * 0.28;
        const k = r * 0.12;
        ctx.beginPath();
        ctx.moveTo(ex - k, ey - k);
        ctx.lineTo(ex + k, ey + k);
        ctx.moveTo(ex + k, ey - k);
        ctx.lineTo(ex - k, ey + k);
        ctx.stroke();
      });
      blob(ctx, 0, r * 0.22, r * 0.13, r * 0.17);
    } else if (face === 'happy') {
      ctx.lineWidth = r * 0.09;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.arc(s * r * 0.36, -r * 0.2, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(0, r * 0.05, r * 0.16, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      const blink = Math.sin(t * 1.3) > 0.985 ? 0.15 : 1;
      blob(ctx, -r * 0.36, -r * 0.26, r * 0.13, r * 0.19 * blink);
      blob(ctx, r * 0.36, -r * 0.26, r * 0.13, r * 0.19 * blink);
      if (blink === 1) {
        ctx.fillStyle = '#ffffff';
        blob(ctx, -r * 0.31, -r * 0.33, r * 0.045, r * 0.045);
        blob(ctx, r * 0.41, -r * 0.33, r * 0.045, r * 0.045);
        ctx.fillStyle = '#1b1230';
      }
      blob(ctx, 0, r * 0.12, r * 0.08, r * 0.1);
    }
    ctx.restore();
  };

  /* ---------------- 화살 (끝 = 화살촉 끝, 방향 = 날아가는 쪽) ---------------- */
  art.ARROW_LEN = 56;
  function drawArrow(ctx, kind) {
    const len = art.ARROW_LEN;
    const fast = kind === 'fast';
    const tipX = len + 6; // 스프라이트 안에서 화살촉 끝 위치
    ctx.translate(0, 14);
    // 촉 주변 빛 (위험 표시)
    const glow = ctx.createRadialGradient(tipX - 5, 0, 0, tipX - 5, 0, 13);
    glow.addColorStop(0, fast ? 'rgba(255, 70, 70, 0.8)' : 'rgba(255, 130, 50, 0.75)');
    glow.addColorStop(1, 'rgba(255, 110, 50, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(tipX - 5, 0, 13, 0, TAU);
    ctx.fill();
    // 깃
    ctx.fillStyle = fast ? '#ff7aa8' : '#9b5de5';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(7, -7);
    ctx.lineTo(1, -7);
    ctx.lineTo(9, 0);
    ctx.lineTo(1, 7);
    ctx.lineTo(7, 7);
    ctx.closePath();
    ctx.fill();
    // 화살대
    ctx.strokeStyle = fast ? '#f2e7ff' : '#d9c4a1';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(tipX - 10, 0);
    ctx.stroke();
    // 촉
    ctx.fillStyle = fast ? '#ff3b3b' : '#ff6b3d';
    ctx.beginPath();
    ctx.moveTo(tipX, 0);
    ctx.lineTo(tipX - 14, -6.5);
    ctx.lineTo(tipX - 10, 0);
    ctx.lineTo(tipX - 14, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe1c2';
    ctx.beginPath();
    ctx.moveTo(tipX, 0);
    ctx.lineTo(tipX - 8, -2);
    ctx.lineTo(tipX - 8, 1);
    ctx.closePath();
    ctx.fill();
  }

  art.arrow = function (ctx, x, y, angle, kind) {
    const s = art.sprite('arrow-' + (kind || 'normal'), art.ARROW_LEN + 12, 28, (c) => drawArrow(c, kind));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(s.canvas, -(art.ARROW_LEN + 6), -14, s.w, s.h);
    ctx.restore();
  };

  /* ---------------- 사탕 ---------------- */
  const CANDY = [
    ['#ff6fae', '#ffd1e6'],
    ['#5fd9b6', '#d4fff2'],
    ['#b48cff', '#ece2ff'],
    ['#ffad42', '#ffe4c2'],
  ];
  art.candy = function (ctx, x, y, t, kind) {
    const c = CANDY[(kind || 0) % CANDY.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 3 + x * 0.05) * 0.3);
    ctx.fillStyle = c[1];
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-14, -6);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-14, 6);
    ctx.closePath();
    ctx.moveTo(6, 0);
    ctx.lineTo(14, -6);
    ctx.lineTo(13, 0);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c[0];
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c[1];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0.4, 2.8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(-3, -3.2, 1.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  function star(ctx, r1, r2, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  art.goldCandy = function (ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + Math.sin(t * 5) * 0.06;
    const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    halo.addColorStop(0, 'rgba(255, 220, 120, 0.55)');
    halo.addColorStop(1, 'rgba(255, 220, 120, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.fill();
    ctx.rotate(Math.sin(t * 2) * 0.25);
    ctx.scale(pulse, pulse);
    star(ctx, 13, 6.2, 5);
    const g = ctx.createLinearGradient(0, -13, 0, 13);
    g.addColorStop(0, '#fff6c4');
    g.addColorStop(0.5, '#ffcb3d');
    g.addColorStop(1, '#e89400');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#a86400';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(-3, -4, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 반짝이
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fffbe8';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.8 + (i * TAU) / 3;
      const s = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
      ctx.save();
      ctx.translate(Math.cos(a) * 19, Math.sin(a) * 19);
      ctx.scale(s, s);
      star(ctx, 4, 1.1, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  /* ---------------- 박쥐 ---------------- */
  art.bat = function (ctx, x, y, t, size, color) {
    const flap = Math.sin(t * 14);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size || 1, size || 1);
    ctx.fillStyle = color || '#0b0712';
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.lineTo(s * 9, -5 - flap * 6);
      ctx.lineTo(s * 18, -1 - flap * 9);
      ctx.quadraticCurveTo(s * 14, 1, s * 13, 4 - flap * 2);
      ctx.quadraticCurveTo(s * 10, 1, s * 7, 4 - flap);
      ctx.quadraticCurveTo(s * 4, 1, 0, 4);
      ctx.closePath();
      ctx.fill();
    });
    blob(ctx, 0, 1, 4, 5);
    ctx.beginPath();
    ctx.moveTo(-3.5, -2);
    ctx.lineTo(-2.5, -7);
    ctx.lineTo(-0.8, -3);
    ctx.moveTo(3.5, -2);
    ctx.lineTo(2.5, -7);
    ctx.lineTo(0.8, -3);
    ctx.fill();
    ctx.restore();
  };

  /* ---------------- 달 ---------------- */
  art.moon = function (ctx, x, y, r) {
    const s = art.sprite('moon-' + r, r * 6, r * 6, (c) => {
      const m = r * 3;
      const halo = c.createRadialGradient(m, m, r * 0.9, m, m, r * 3);
      halo.addColorStop(0, 'rgba(255, 236, 180, 0.32)');
      halo.addColorStop(1, 'rgba(255, 236, 180, 0)');
      c.fillStyle = halo;
      c.fillRect(0, 0, r * 6, r * 6);
      const disk = c.createRadialGradient(m - r * 0.3, m - r * 0.3, r * 0.1, m, m, r);
      disk.addColorStop(0, '#fffbe8');
      disk.addColorStop(1, '#f1d68f');
      c.fillStyle = disk;
      c.beginPath();
      c.arc(m, m, r, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(205, 170, 100, 0.32)';
      [[-0.35, -0.2, 0.22], [0.3, 0.25, 0.16], [0.1, -0.45, 0.1], [-0.15, 0.45, 0.12]].forEach(([dx, dy, rr2]) => {
        c.beginPath();
        c.arc(m + dx * r, m + dy * r, rr2 * r, 0, TAU);
        c.fill();
      });
    });
    ctx.drawImage(s.canvas, x - r * 3, y - r * 3, s.w, s.h);
  };

  /* ---------------- 호박 등불 (거미줄을 거는 곳) ---------------- */
  art.lantern = function (ctx, x, y, t, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    const halo = ctx.createRadialGradient(0, 2, 4, 0, 2, 36);
    halo.addColorStop(0, 'rgba(255, 196, 90, 0.45)');
    halo.addColorStop(1, 'rgba(255, 196, 90, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 2, 36, 0, TAU);
    ctx.fill();

    if (o.active) {
      ctx.save();
      ctx.rotate(t * 1.5);
      ctx.strokeStyle = '#9ff0d8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 1, 25 + Math.sin(t * 6) * 1.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.strokeStyle = '#2e2142';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -15, 4.5, 0, TAU);
    ctx.stroke();
    art.pumpkin(ctx, 0, 2, 14, 11.5, 'happy');
    ctx.restore();
  };

  /* ---------------- 대나무 한 그루 ---------------- */
  art.bamboo = function (ctx, x, top, bottom, w, color, nodeColor, sway) {
    const segH = 58;
    const n = Math.ceil((bottom - top) / segH);
    for (let i = 0; i < n; i++) {
      const y0 = bottom - (i + 1) * segH;
      const y1 = bottom - i * segH;
      const k0 = (bottom - y0) / (bottom - top);
      const k1 = (bottom - y1) / (bottom - top);
      const x0 = x + sway * k0 * k0;
      const x1 = x + sway * k1 * k1;
      const ww = w * (1 - k0 * 0.25);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1 - ww / 2, y1);
      ctx.lineTo(x0 - ww / 2, y0 + 2);
      ctx.lineTo(x0 + ww / 2, y0 + 2);
      ctx.lineTo(x1 + ww / 2, y1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = nodeColor;
      ctx.fillRect(x0 - ww / 2 - 1, y0, ww + 2, 3);
    }
  };

  art.leaf = function (ctx, x, y, angle, len, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.18, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.18, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  art.star = star;
})();
