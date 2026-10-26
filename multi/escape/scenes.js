/* 동암초 탈출 — 그림: 교실·과학실·도서관·방송실·교무실·보건실·현관·복도·바깥·학교 지도 */
(function () {
  'use strict';

  const E = window.EscapeCore;
  const art = HG.art;
  const W = 960;
  const H = 540;
  const TAU = Math.PI * 2;
  const rr = art.roundRect;
  const S = (window.EscapeScenes = {});

  function seeded(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 공통 소품 ---------------- */
  function room(ctx, o) {
    const g = ctx.createLinearGradient(0, 0, 0, 380);
    g.addColorStop(0, o.wall);
    g.addColorStop(1, o.wall2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 382);
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(0, 374, W, 8);
    const f = ctx.createLinearGradient(0, 382, 0, H);
    f.addColorStop(0, o.floor);
    f.addColorStop(1, o.floor2);
    ctx.fillStyle = f;
    ctx.fillRect(0, 382, W, H - 382);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 2;
    for (let y = 404; y < H; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function nightWindow(ctx, x, y, w, h, t) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#0c1230');
    g.addColorStop(1, '#2a2d5e');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff6dc';
    const r = seeded(x * 7 + y);
    for (let i = 0; i < 10; i++) {
      ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillRect(x + r() * w, y + r() * h * 0.7, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(x + w * 0.66, y + h * 0.3, Math.min(w, h) * 0.13, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#3d3159';
    ctx.lineWidth = 8;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
  }

  function cobweb(ctx, x, y, size, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.strokeStyle = 'rgba(230, 225, 255, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      ctx.stroke();
    }
    for (let k = 1; k <= 3; k++) {
      const r = (k / 3.3) * size;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const a = (i / 4) * (Math.PI / 2);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i) ctx.quadraticCurveTo(Math.cos(a - 0.2) * r * 0.85, Math.sin(a - 0.2) * r * 0.85, px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function garland(ctx, x0, x1, y, t) {
    const n = Math.floor((x1 - x0) / 34);
    ctx.strokeStyle = 'rgba(20, 10, 20, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = x0 + (i * (x1 - x0)) / n;
      const yy = y + Math.sin((i / n) * Math.PI) * 14;
      if (i) ctx.lineTo(x, yy);
      else ctx.moveTo(x, yy);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
      const yy = y + Math.sin(((i + 0.5) / n) * Math.PI) * 14;
      const sway = Math.sin(t * 2 + i) * 1.5;
      ctx.fillStyle = ['#ff8a1f', '#7b3fb8', '#2fbf71'][i % 3];
      ctx.beginPath();
      ctx.moveTo(x - 8, yy);
      ctx.lineTo(x + 8, yy);
      ctx.lineTo(x + sway, yy + 15);
      ctx.fill();
    }
  }

  function vignette(ctx, strength) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(5, 3, 10, 0)');
    g.addColorStop(1, 'rgba(5, 3, 10, ' + (strength || 0.55) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function boo(ctx, x, y, t, face) {
    art.ghost(ctx, x, y + Math.sin(t * 2) * 6, { t, r: 22, face: face || 'happy' });
  }

  function exitSign(ctx, x, y) {
    ctx.fillStyle = '#0f8a4a';
    rr(ctx, x - 44, y - 14, 88, 28, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 255, 160, 0.18)';
    ctx.fillRect(x - 60, y - 24, 120, 48);
    HG.text(ctx, '🏃 비상구', x, y + 1, { size: 15, color: '#eafff2' });
  }

  function extinguisher(ctx, x, y) {
    ctx.fillStyle = '#d7263d';
    rr(ctx, x - 9, y - 40, 18, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 4, y - 48, 8, 9);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 7, y - 28, 14, 7);
  }

  /** 숨은 호박 하나 */
  function hiddenPumpkin(ctx, sp, found, flash, t) {
    if (found) {
      const halo = ctx.createRadialGradient(sp.x, sp.y, 2, sp.x, sp.y, 30);
      halo.addColorStop(0, 'rgba(255, 200, 90, 0.75)');
      halo.addColorStop(1, 'rgba(255, 200, 90, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 30, 0, TAU);
      ctx.fill();
      art.pumpkin(ctx, sp.x, sp.y, 12, 10, 'wow', true);
      return;
    }
    if (flash > 0) {
      ctx.strokeStyle = 'rgba(159, 240, 216, ' + (0.4 + 0.5 * Math.abs(Math.sin(t * 8))) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 20 + Math.sin(t * 8) * 3, 0, TAU);
      ctx.stroke();
    }
    ctx.save();
    ctx.globalAlpha = 0.9;
    art.pumpkin(ctx, sp.x, sp.y, 12, 10, 'happy', false);
    ctx.restore();
  }

  /* ---------------- 교실 (우리 반) ---------------- */
  S.classroom = function (ctx, t, st) {
    const spots = new Set(st.spots);
    const pk = (i) => {
      if (spots.has(i)) hiddenPumpkin(ctx, E.SPOTS[i], st.found.has(i), st.flash, t);
    };
    room(ctx, { wall: '#2a2147', wall2: '#1d1733', floor: '#3a2a35', floor2: '#24161f' });
    cobweb(ctx, 0, 0, 70, false);
    cobweb(ctx, W, 0, 70, true);
    garland(ctx, 300, 640, 12, t);
    pk(8);

    // 창문과 창틀
    nightWindow(ctx, 30, 70, 180, 180, t);
    ctx.fillStyle = '#4a3d68';
    ctx.fillRect(22, 250, 196, 10);
    pk(0);

    // 칠판
    ctx.fillStyle = '#4b3324';
    ctx.fillRect(296, 54, 408, 180);
    ctx.fillStyle = '#1e3a30';
    ctx.fillRect(304, 62, 392, 164);
    ctx.globalAlpha = 0.82;
    HG.text(ctx, '할로윈 파티!', 470, 118, { size: 44, font: HG.FONT_DISPLAY, color: '#f4f1e6' });
    HG.text(ctx, st.school + ' ' + st.myClass, 470, 196, { size: 18, color: '#f4f1e6' });
    ctx.globalAlpha = 1;
    if (st.digit != null) {
      ctx.save();
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 18;
      HG.text(ctx, String(st.digit), 640, 140, { size: 84, font: HG.FONT_DISPLAY, color: '#ffe9a8' });
      ctx.restore();
    }
    ctx.fillStyle = '#5d4130';
    ctx.fillRect(300, 230, 400, 8);
    pk(3);

    // 시계 (호박이 뒤에 숨어요)
    pk(4);
    ctx.fillStyle = '#f1ece0';
    ctx.beginPath();
    ctx.arc(784, 100, 28, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3d3159';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#2a1d3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(784, 100);
    ctx.lineTo(784, 80);
    ctx.moveTo(784, 100);
    ctx.lineTo(784 + Math.cos(t * 0.5) * 16, 100 + Math.sin(t * 0.5) * 16);
    ctx.stroke();

    // 책꽂이
    ctx.fillStyle = '#4b3324';
    ctx.fillRect(226, 248, 72, 130);
    const books = ['#e8443a', '#2f6bff', '#ffd23f', '#2fbf71', '#9b4dd8', '#ff8a1f'];
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = books[(r * 2 + k) % books.length];
        ctx.fillRect(232 + k * 12, 256 + r * 40, 10, 32);
      }
    }
    pk(2);

    // 사물함 (오른쪽 아래 하나가 살짝 열려 있어요)
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 2; r++) {
        const x = 752 + c * 46;
        const y = 200 + r * 86;
        if (c === 2 && r === 1) {
          ctx.fillStyle = '#0d0a14';
          ctx.fillRect(x + 2, y + 2, 42, 82);
          pk(5);
          ctx.fillStyle = '#4a5a80';
          ctx.beginPath();
          ctx.moveTo(x + 2, y + 2);
          ctx.lineTo(x + 16, y + 10);
          ctx.lineTo(x + 16, y + 78);
          ctx.lineTo(x + 2, y + 84);
          ctx.fill();
          continue;
        }
        ctx.fillStyle = '#3b4a6b';
        ctx.fillRect(x + 2, y + 2, 42, 82);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let v = 0; v < 3; v++) ctx.fillRect(x + 10, y + 14 + v * 7, 26, 3);
        ctx.fillStyle = '#c9c3d8';
        ctx.fillRect(x + 34, y + 44, 4, 10);
      }
    }

    // 선생님 책상
    ctx.fillStyle = '#7a5236';
    ctx.fillRect(330, 296, 230, 10);
    ctx.fillStyle = '#5d3d28';
    ctx.fillRect(330, 306, 230, 56);
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(336, 306, 10, 86);
    ctx.fillRect(544, 306, 10, 86);
    ctx.fillStyle = '#1a1018';
    ctx.fillRect(346, 362, 198, 30);
    pk(6);
    art.pumpkin(ctx, 520, 282, 14, 11, 'happy');

    // 휴지통 (호박이 반쯤 들어가 있어요)
    pk(1);
    ctx.fillStyle = '#3a3550';
    ctx.beginPath();
    ctx.moveTo(38, 404);
    ctx.lineTo(90, 404);
    ctx.lineTo(84, 470);
    ctx.lineTo(44, 470);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4f4870';
    ctx.fillRect(34, 400, 60, 8);

    // 학생 책상 (앞줄)
    [110, 320, 530, 740].forEach((x, i) => {
      ctx.fillStyle = '#2e2233';
      ctx.fillRect(x + 30, 396, 90, 30);
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(x + 6, 452, 8, 70);
      ctx.fillRect(x + 136, 452, 8, 70);
      if (i === 2) pk(7);
      ctx.fillStyle = '#c79a63';
      ctx.fillRect(x, 440, 150, 12);
      ctx.fillStyle = '#9b7348';
      ctx.fillRect(x, 452, 150, 4);
    });

    boo(ctx, 120, 330, t);
    vignette(ctx, 0.5);
  };

  /* ---------------- 과학실 ---------------- */
  S.BOTTLES = [
    { x: 230, color: '빨강' },
    { x: 330, color: '파랑' },
    { x: 430, color: '노랑' },
  ];

  function bottle(ctx, x, color, selected, t) {
    const c = E.COLORS[color];
    if (selected) {
      const halo = ctx.createRadialGradient(x, 312, 4, x, 312, 64);
      halo.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, 312, 64, 0, TAU);
      ctx.fill();
    }
    const lift = selected ? -10 + Math.sin(t * 6) * 2 : 0;
    ctx.save();
    ctx.translate(0, lift);
    ctx.fillStyle = 'rgba(220, 235, 255, 0.25)';
    rr(ctx, x - 26, 278, 52, 82, 14);
    ctx.fill();
    ctx.fillStyle = c;
    rr(ctx, x - 22, 300, 44, 56, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(x - 14, 306, 6, 36);
    ctx.fillStyle = 'rgba(220, 235, 255, 0.3)';
    ctx.fillRect(x - 9, 254, 18, 26);
    ctx.fillStyle = '#7a5236';
    ctx.fillRect(x - 11, 246, 22, 12);
    ctx.fillStyle = '#f6f1ff';
    rr(ctx, x - 20, 318, 40, 18, 4);
    ctx.fill();
    HG.text(ctx, color, x, 327, { size: 13, color: '#2a1d3f' });
    ctx.restore();
  }

  S.science = function (ctx, t, st) {
    room(ctx, { wall: '#1a2b3d', wall2: '#13202e', floor: '#2c3440', floor2: '#1a1f27' });
    cobweb(ctx, 0, 0, 60, false);
    // 선반과 약병
    const r = seeded(77);
    [110, 190].forEach((y) => {
      ctx.fillStyle = '#4b3324';
      ctx.fillRect(30, y, 520, 8);
      for (let x = 44; x < 540; x += 34 + r() * 12) {
        const h = 26 + r() * 30;
        ctx.fillStyle = ['#e8443a', '#2f6bff', '#ffd23f', '#2fbf71', '#9b4dd8', '#c6f0ff'][Math.floor(r() * 6)];
        ctx.globalAlpha = 0.75;
        rr(ctx, x, y - h, 22, h, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#2a1d3f';
        ctx.fillRect(x + 4, y - h - 6, 14, 6);
      }
    });
    // 칠판: 만들 물약
    ctx.fillStyle = '#4b3324';
    ctx.fillRect(590, 50, 240, 160);
    ctx.fillStyle = '#1e3a30';
    ctx.fillRect(598, 58, 224, 144);
    HG.text(ctx, '만들 물약', 710, 84, { size: 22, color: '#f4f1e6' });
    if (st.target) {
      ctx.fillStyle = E.COLORS[st.target];
      ctx.beginPath();
      ctx.arc(668, 146, 30, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
      HG.text(ctx, st.target, 752, 146, { size: 34, font: HG.FONT_DISPLAY, color: '#f4f1e6' });
    } else {
      HG.text(ctx, '완성!', 710, 146, { size: 40, font: HG.FONT_DISPLAY, color: '#ffe9a8' });
    }
    // 해골 모형
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath();
    ctx.arc(890, 150, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a2b3d';
    ctx.beginPath();
    ctx.arc(882, 148, 5, 0, TAU);
    ctx.arc(898, 148, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e8e2d0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(890, 172);
    ctx.lineTo(890, 280);
    for (let k = 0; k < 4; k++) {
      ctx.moveTo(872, 186 + k * 14);
      ctx.quadraticCurveTo(890, 178 + k * 14, 908, 186 + k * 14);
    }
    ctx.moveTo(890, 280);
    ctx.lineTo(874, 350);
    ctx.moveTo(890, 280);
    ctx.lineTo(906, 350);
    ctx.stroke();
    ctx.fillStyle = '#4b3324';
    ctx.fillRect(870, 350, 40, 24);

    // 실험대
    ctx.fillStyle = '#3d4a5c';
    ctx.fillRect(120, 356, 720, 14);
    ctx.fillStyle = '#2b3442';
    ctx.fillRect(130, 370, 700, 80);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    for (let x = 130; x < 830; x += 140) ctx.strokeRect(x + 6, 378, 128, 64);

    S.BOTTLES.forEach((b) => bottle(ctx, b.x, b.color, st.selected.indexOf(b.color) >= 0, t));

    // 마녀 솥
    const liquid = st.cauldron ? E.COLORS[st.cauldron] : '#3a3f48';
    ctx.fillStyle = '#1b1b22';
    ctx.beginPath();
    ctx.ellipse(650, 312, 92, 54, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = liquid;
    ctx.beginPath();
    ctx.ellipse(650, 284, 80, 16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 4; i++) {
      const bx = 610 + i * 26 + Math.sin(t * 3 + i) * 6;
      const by = 282 - ((t * 30 + i * 13) % 26);
      ctx.beginPath();
      ctx.arc(bx, by, 4 + (i % 2) * 2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#2c2c36';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(650, 284, 84, 18, 0, 0, TAU);
    ctx.stroke();
    if (st.puff > 0) {
      ctx.fillStyle = 'rgba(150, 220, 120, ' + st.puff * 0.7 + ')';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(610 + i * 16, 250 - (1 - st.puff) * 60 - (i % 2) * 14, 18 + (1 - st.puff) * 18, 0, TAU);
        ctx.fill();
      }
    }
    boo(ctx, 80, 300, t);
    vignette(ctx, 0.45);
  };

  /* ---------------- 도서관 ---------------- */
  S.library = function (ctx, t) {
    room(ctx, { wall: '#2a1d14', wall2: '#1d140e', floor: '#3a2a20', floor2: '#22180f' });
    const r = seeded(31);
    [[20, 290], [330, 630], [660, 940]].forEach(([x0, x1]) => {
      ctx.fillStyle = '#4b3324';
      ctx.fillRect(x0, 60, x1 - x0, 316);
      for (let row = 0; row < 4; row++) {
        const y = 70 + row * 76;
        ctx.fillStyle = '#2e1f15';
        ctx.fillRect(x0 + 8, y, x1 - x0 - 16, 64);
        for (let x = x0 + 10; x < x1 - 20; ) {
          const w = 10 + r() * 10;
          const h = 44 + r() * 18;
          ctx.fillStyle = ['#a8323e', '#2f5aa8', '#c99a2e', '#2f8a5e', '#6e3fa0', '#d06a2a', '#e8e2d0'][Math.floor(r() * 7)];
          ctx.fillRect(x, y + 64 - h, w, h);
          x += w + 2;
        }
      }
    });
    ctx.fillStyle = '#ffd166';
    rr(ctx, 380, 14, 200, 38, 8);
    ctx.fill();
    HG.text(ctx, '도서관 · 쉿!', 480, 34, { size: 22, color: '#3a1d00' });
    // 날아다니는 책
    const fx = 880 + Math.sin(t * 1.2) * 20;
    const fy = 420 + Math.sin(t * 2) * 10;
    ctx.fillStyle = '#6e3fa0';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - 26, fy - 10 + Math.sin(t * 8) * 8);
    ctx.lineTo(fx - 26, fy + 14);
    ctx.lineTo(fx, fy + 20);
    ctx.lineTo(fx + 26, fy + 14);
    ctx.lineTo(fx + 26, fy - 10 + Math.sin(t * 8) * 8);
    ctx.closePath();
    ctx.fill();
    boo(ctx, 70, 430, t);
    vignette(ctx, 0.5);
  };

  /* ---------------- 방송실 ---------------- */
  S.broadcast = function (ctx, t, st) {
    room(ctx, { wall: '#1b1f2e', wall2: '#141724', floor: '#262a38', floor2: '#171a24' });
    const on = st && st.onAir;
    ctx.fillStyle = on ? '#e8443a' : '#4a2026';
    rr(ctx, 400, 18, 160, 44, 8);
    ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255, 80, 80, 0.25)';
      ctx.fillRect(380, 6, 200, 68);
    }
    HG.text(ctx, 'ON AIR', 480, 41, { size: 26, color: on ? '#fff' : '#a07078' });
    // 모니터 두 대 (지지직)
    [[60, 90], [740, 90]].forEach(([x, y], k) => {
      ctx.fillStyle = '#0d0f16';
      rr(ctx, x, y, 160, 110, 8);
      ctx.fill();
      const r = seeded(Math.floor(t * 12) + k * 99);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = 'rgba(200, 210, 255, ' + r() * 0.5 + ')';
        ctx.fillRect(x + 8 + r() * 144, y + 8 + r() * 94, 3, 2);
      }
      if (k === 1) art.ghost(ctx, x + 80, y + 58, { t, r: 20, glow: false, face: 'happy' });
    });
    // 스피커
    [20, 900].forEach((x) => {
      ctx.fillStyle = '#23232e';
      rr(ctx, x, 230, 44, 120, 8);
      ctx.fill();
      ctx.fillStyle = '#0d0d12';
      ctx.beginPath();
      ctx.arc(x + 22, 266, 13, 0, TAU);
      ctx.arc(x + 22, 316, 17, 0, TAU);
      ctx.fill();
    });
    // 방송 책상과 믹서
    ctx.fillStyle = '#3a3f52';
    ctx.fillRect(110, 360, 740, 16);
    ctx.fillStyle = '#2a2e3d';
    ctx.fillRect(120, 376, 720, 80);
    ctx.fillStyle = '#4a5068';
    rr(ctx, 250, 320, 460, 44, 8);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const x = 270 + i * 31;
      ctx.fillStyle = '#1b1e28';
      ctx.fillRect(x, 328, 4, 28);
      ctx.fillStyle = ['#ff8a1f', '#e9e4ff', '#9b5de5', '#2fbf71'][i % 4];
      ctx.fillRect(x - 4, 334 + Math.sin(t * 2 + i) * 8, 12, 6);
    }
    // 마이크
    ctx.strokeStyle = '#8a90a8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(780, 360);
    ctx.lineTo(780, 300);
    ctx.lineTo(760, 280);
    ctx.stroke();
    ctx.fillStyle = '#2a2e3d';
    rr(ctx, 744, 258, 26, 34, 12);
    ctx.fill();
    vignette(ctx, 0.5);
  };

  /* ---------------- 교무실 ---------------- */
  S.office = function (ctx, t) {
    room(ctx, { wall: '#1f2236', wall2: '#171a2a', floor: '#2b2d3d', floor2: '#1a1b26' });
    ctx.fillStyle = '#e8e6f0';
    rr(ctx, 300, 40, 360, 150, 8);
    ctx.fill();
    ctx.fillStyle = '#2a2d5e';
    HG.text(ctx, '교무실', 480, 70, { size: 26, color: '#2a2d5e' });
    HG.text(ctx, '10월 31일 할로윈 🎃', 480, 112, { size: 18, color: '#c0392b' });
    HG.text(ctx, '복도에서 뛰지 않기!', 480, 146, { size: 16, color: '#2a2d5e' });
    // 책상과 모니터
    [80, 300, 520, 740].forEach((x, i) => {
      ctx.fillStyle = '#5d4a3a';
      ctx.fillRect(x, 330, 160, 14);
      ctx.fillStyle = '#463729';
      ctx.fillRect(x + 8, 344, 144, 60);
      ctx.fillStyle = '#12141c';
      rr(ctx, x + 40, 262, 80, 56, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(120, 200, 255, ' + (0.25 + 0.15 * Math.sin(t * 2 + i)) + ')';
      ctx.fillRect(x + 46, 268, 68, 44);
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(x + 74, 318, 12, 12);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 12, 320, 22, 10);
    });
    // 캐비닛
    ctx.fillStyle = '#4a5068';
    ctx.fillRect(820, 150, 110, 226);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    for (let k = 0; k < 4; k++) ctx.strokeRect(826, 158 + k * 54, 98, 48);
    boo(ctx, 90, 200, t);
    vignette(ctx, 0.5);
  };

  /* ---------------- 보건실 ---------------- */
  S.nurse = function (ctx, t) {
    room(ctx, { wall: '#1e2b2e', wall2: '#162123', floor: '#2b3638', floor2: '#1a2224' });
    // 시력표
    ctx.fillStyle = '#f4f1e6';
    rr(ctx, 60, 50, 120, 190, 6);
    ctx.fill();
    ['ㅌ', 'ㅂ ㄱ', 'ㅅ ㅎ ㅁ', 'ㅇ ㄹ ㅈ ㅋ'].forEach((line, i) => {
      HG.text(ctx, line, 120, 82 + i * 42, { size: 28 - i * 5, color: '#2a2d5e' });
    });
    // 약장
    ctx.fillStyle = '#e8e6f0';
    rr(ctx, 760, 70, 160, 200, 8);
    ctx.fill();
    ctx.fillStyle = '#d7263d';
    ctx.fillRect(828, 92, 24, 64);
    ctx.fillRect(808, 112, 64, 24);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.strokeRect(772, 176, 136, 82);
    // 침대와 커튼
    ctx.fillStyle = '#5a7a9a';
    ctx.fillRect(220, 280, 260, 18);
    ctx.fillStyle = '#e8e6f0';
    ctx.fillRect(220, 262, 260, 20);
    ctx.fillStyle = '#fff';
    rr(ctx, 228, 246, 70, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#3f5670';
    ctx.fillRect(226, 298, 10, 80);
    ctx.fillRect(464, 298, 10, 80);
    ctx.fillStyle = 'rgba(160, 220, 210, 0.75)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(500 + i * 26, 40);
      ctx.quadraticCurveTo(512 + i * 26 + Math.sin(t + i) * 4, 200, 500 + i * 26, 372);
      ctx.lineTo(522 + i * 26, 372);
      ctx.quadraticCurveTo(534 + i * 26 + Math.sin(t + i) * 4, 200, 522 + i * 26, 40);
      ctx.fill();
    }
    boo(ctx, 360, 210, t);
    vignette(ctx, 0.5);
  };

  /* ---------------- 중앙 현관 (안쪽) ---------------- */
  S.entrance = function (ctx, t, st) {
    room(ctx, { wall: '#24203a', wall2: '#1a1729', floor: '#383448', floor2: '#201d2c' });
    // 바닥 타일
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = -200; x < W + 200; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, 382);
      ctx.lineTo(W / 2 + (x - W / 2) * 1.8, H);
      ctx.stroke();
    }
    // 신발장
    [[30, 240], [720, 930]].forEach(([x0, x1]) => {
      ctx.fillStyle = '#4b3324';
      ctx.fillRect(x0, 160, x1 - x0, 216);
      for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 4; r++) {
          ctx.fillStyle = '#5d4130';
          ctx.fillRect(x0 + 8 + c * ((x1 - x0 - 16) / 5), 168 + r * 52, (x1 - x0 - 16) / 5 - 6, 46);
        }
      }
    });
    exitSign(ctx, 480, 52);
    // 유리문 바깥: 밤하늘과 운동장
    const open = st.open || 0;
    const dx = 300;
    const dw = 360;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, 90, dw, 288);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, 90, 0, 378);
    sky.addColorStop(0, '#0b1030');
    sky.addColorStop(1, '#3a2f63');
    ctx.fillStyle = sky;
    ctx.fillRect(dx, 90, dw, 288);
    art.moon(ctx, 560, 150, 26);
    ctx.fillStyle = '#1a1430';
    ctx.fillRect(dx, 320, dw, 58);
    if (open > 0) {
      ctx.fillStyle = 'rgba(255, 225, 150, ' + open * 0.5 + ')';
      ctx.fillRect(dx, 90, dw, 288);
    }
    ctx.restore();
    // 문짝 두 개 (열리면 양쪽으로 접혀요)
    const leaf = (dw / 2) * (1 - open * 0.85);
    const shake = st.shake ? Math.sin(t * 60) * 3 * st.shake : 0;
    [[dx + shake, 1], [dx + dw - leaf + shake, -1]].forEach(([x]) => {
      ctx.fillStyle = 'rgba(160, 200, 255, 0.12)';
      ctx.fillRect(x, 90, leaf, 288);
      ctx.strokeStyle = '#9aa3b8';
      ctx.lineWidth = 6;
      ctx.strokeRect(x + 3, 93, leaf - 6, 282);
    });
    ctx.fillStyle = '#5a6278';
    ctx.fillRect(dx - 12, 80, dw + 24, 14);
    ctx.fillRect(dx - 12, 80, 14, 300);
    ctx.fillRect(dx + dw - 2, 80, 14, 300);
    // 쇠사슬과 자물쇠
    if (!st.unlocked) {
      ctx.strokeStyle = '#b8b8c8';
      ctx.lineWidth = 5;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.ellipse(410 + i * 13, 236 + Math.sin(i * 0.9) * 6, 7, 4, (i % 2) * 1.2, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = '#d4a017';
      rr(ctx, 456, 236, 48, 44, 8);
      ctx.fill();
      ctx.strokeStyle = '#d4a017';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(480, 236, 16, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#5a3d00';
      ctx.beginPath();
      ctx.arc(480, 254, 5, 0, TAU);
      ctx.fill();
      ctx.fillRect(478, 256, 4, 12);
    }
    boo(ctx, 840, 110, t, open > 0.5 ? 'happy' : 'normal');
    vignette(ctx, 0.45);
  };

  /* ---------------- 바깥 (탈출 성공!) ---------------- */
  S.outside = function (ctx, t, st) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070a1f');
    sky.addColorStop(1, '#3a2c5e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const r = seeded(5);
    ctx.fillStyle = '#fff6dc';
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t + i));
      ctx.fillRect(r() * W, r() * 300, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    art.moon(ctx, 800, 90, 40);
    // 본관과 신관
    const building = (x, y, w, h, floors, cols) => {
      ctx.fillStyle = '#1c1730';
      ctx.fillRect(x, y, w, h);
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const lit = (f * 7 + c * 3) % 5 === 0;
          ctx.fillStyle = lit ? '#ffd27a' : '#2a2342';
          ctx.fillRect(x + 14 + c * ((w - 28) / cols), y + 16 + f * (h / floors), (w - 28) / cols - 10, h / floors - 26);
        }
      }
    };
    building(120, 200, 500, 200, 3, 10);
    building(660, 240, 240, 160, 3, 5);
    HG.text(ctx, '본관', 370, 186, { size: 18, color: '#b9abd2' });
    HG.text(ctx, '신관', 780, 226, { size: 18, color: '#b9abd2' });
    // 땅과 교문
    ctx.fillStyle = '#16121f';
    ctx.fillRect(0, 400, W, 140);
    ctx.fillStyle = '#5a4a5e';
    ctx.fillRect(40, 300, 46, 160);
    ctx.fillRect(874, 300, 46, 160);
    // 세로 학교 이름판
    ctx.fillStyle = '#e8e2d0';
    rr(ctx, 48, 316, 30, 136, 3);
    ctx.fill();
    Array.from(st.school.replace('등학교', '')).slice(0, 6).forEach((ch, i, a) => {
      HG.text(ctx, ch, 63, 334 + i * (120 / Math.max(a.length, 4)), { size: 17, color: '#2a1d3f' });
    });
    art.pumpkinBoy(ctx, 420, 452, { t, pose: 'run', face: 'wow' });
    art.ghost(ctx, 500, 420 + Math.sin(t * 3) * 8, { t, r: 24, face: 'happy' });
    (st.sparks || []).forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.6));
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  /* ---------------- 복도 (경비원) ---------------- */
  const FLOOR_Y = 440;

  function guardFigure(ctx, x, t, g) {
    const walking = g.state === 'walk' || g.state === 'chase';
    const ph = t * (g.state === 'chase' ? 16 : 9);
    const swing = walking ? Math.sin(ph) * 10 : 0;
    ctx.save();
    ctx.translate(x, FLOOR_Y);
    ctx.scale(g.face, 1);
    // 다리
    ctx.strokeStyle = '#141a2e';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -50);
    ctx.lineTo(-6 + swing * 0.6, -4);
    ctx.moveTo(8, -50);
    ctx.lineTo(8 - swing * 0.6, -4);
    ctx.stroke();
    // 몸
    ctx.fillStyle = '#26325a';
    rr(ctx, -20, -112, 42, 66, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(4, -100, 9, 7);
    // 손전등 든 팔
    ctx.strokeStyle = '#26325a';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(10, -98);
    ctx.lineTo(34, -84);
    ctx.stroke();
    ctx.fillStyle = '#c9c3d8';
    rr(ctx, 30, -90, 18, 10, 3);
    ctx.fill();
    // 머리와 모자
    ctx.fillStyle = '#d9c9b0';
    ctx.beginPath();
    ctx.arc(2, -126, 15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#141a2e';
    rr(ctx, -16, -146, 34, 14, 5);
    ctx.fill();
    ctx.fillRect(6, -136, 20, 5);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-2, -143, 7, 6);
    // 눈 (으스스하게 빛나요)
    ctx.fillStyle = g.state === 'chase' || g.state === 'alert' ? '#ff4d4d' : '#ffe9a8';
    ctx.beginPath();
    ctx.arc(9, -127, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(2, -118, 14, 3);
    ctx.restore();
  }

  function guardLight(ctx, x, g) {
    const y = FLOOR_Y - 85;
    const tip = x + g.face * g.cone;
    const grad = ctx.createLinearGradient(x, 0, tip, 0);
    grad.addColorStop(0, 'rgba(255, 240, 170, 0.5)');
    grad.addColorStop(1, 'rgba(255, 240, 170, 0.04)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x + g.face * 40, y);
    ctx.lineTo(tip, y - 70);
    ctx.lineTo(tip, FLOOR_Y + 40);
    ctx.closePath();
    ctx.fill();
  }

  function corridorCell(ctx, c, h, t) {
    const x0 = c.x0;
    const x1 = c.x1;
    const name = c.name;
    if (name === '계단') {
      ctx.fillStyle = '#1a1626';
      ctx.fillRect(x0 + 30, 120, x1 - x0 - 60, FLOOR_Y - 120);
      ctx.strokeStyle = '#3d3552';
      ctx.lineWidth = 4;
      for (let k = 0; k < 8; k++) {
        ctx.beginPath();
        ctx.moveTo(x0 + 40 + k * 26, FLOOR_Y - k * 36);
        ctx.lineTo(x0 + 66 + k * 26, FLOOR_Y - k * 36);
        ctx.lineTo(x0 + 66 + k * 26, FLOOR_Y - (k + 1) * 36);
        ctx.stroke();
      }
      exitSign(ctx, (x0 + x1) / 2, 92);
      return;
    }
    if (name === 'EV') {
      ctx.fillStyle = '#6f7790';
      ctx.fillRect(x0 + 90, 210, 120, 230);
      ctx.strokeStyle = '#3d4458';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 + 150, 210);
      ctx.lineTo(x0 + 150, 440);
      ctx.stroke();
      ctx.fillStyle = '#d7263d';
      rr(ctx, x0 + 100, 170, 100, 28, 4);
      ctx.fill();
      HG.text(ctx, '불나면 타지 마세요', x0 + 150, 184, { size: 11, color: '#fff' });
      return;
    }
    if (name === '화장실') {
      ctx.fillStyle = '#3a4860';
      ctx.fillRect(x0 + 100, 250, 100, 190);
      ctx.fillStyle = '#ffffff';
      HG.text(ctx, '🚻', x0 + 150, 225, { size: 30 });
      return;
    }
    if (name === '현관') {
      ctx.fillStyle = 'rgba(160, 200, 255, 0.15)';
      ctx.fillRect(x0 + 60, 160, x1 - x0 - 120, 280);
      ctx.strokeStyle = '#9aa3b8';
      ctx.lineWidth = 6;
      ctx.strokeRect(x0 + 60, 160, x1 - x0 - 120, 280);
      ctx.strokeStyle = '#b8b8c8';
      ctx.lineWidth = 4;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(x0 + 100 + i * 12, 300 + Math.sin(i) * 5, 6, 3.5, (i % 2) * 1.2, 0, TAU);
        ctx.stroke();
      }
      HG.text(ctx, '잠김', (x0 + x1) / 2, 140, { size: 20, color: '#ff8a8a' });
      return;
    }
    // 교실·특별실: 앞문·뒷문, 위에 튀어나온 이름판, 가운데 게시판과 창문
    [x0 + 30, x1 - 100].forEach((dx) => {
      ctx.fillStyle = '#5d4130';
      ctx.fillRect(dx, 270, 70, 170);
      ctx.fillStyle = 'rgba(150, 190, 255, 0.18)';
      ctx.fillRect(dx + 14, 290, 42, 46);
      ctx.fillStyle = '#c9c3d8';
      ctx.fillRect(dx + 56, 360, 6, 18);
    });
    ctx.fillStyle = 'rgba(150, 190, 255, 0.12)';
    ctx.fillRect(x0 + 110, 150, x1 - x0 - 220, 80);
    ctx.strokeStyle = '#3d3159';
    ctx.lineWidth = 4;
    ctx.strokeRect(x0 + 110, 150, x1 - x0 - 220, 80);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(x0 + 120, 262, x1 - x0 - 240, 70);
    ['#ff8a1f', '#9ff0d8', '#ffd166'].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(x0 + 128 + i * 24, 270 + (i % 2) * 6, 18, 24);
    });
    // 이름판 (복도로 튀어나온 판)
    ctx.fillStyle = '#e8e2d0';
    rr(ctx, x0 + 22, 236, 86, 26, 4);
    ctx.fill();
    HG.text(ctx, name, x0 + 65, 250, { size: name.length > 4 ? 12 : 16, color: '#2a1d3f' });
    if (c.index % 3 === 0) extinguisher(ctx, x1 - 14, FLOOR_Y);
  }

  function hidingSpot(ctx, sp, h, i, t) {
    const hidden = h.player.hidden === i;
    if (sp.kind === 'locker') {
      ctx.fillStyle = '#4a5a80';
      ctx.fillRect(sp.x - 26, 300, 52, 140);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      for (let v = 0; v < 4; v++) ctx.fillRect(sp.x - 16, 316 + v * 8, 32, 3);
      HG.text(ctx, '청소함', sp.x, 410, { size: 11, color: '#d9d4ee' });
    } else if (sp.kind === 'door') {
      ctx.fillStyle = '#0d0a14';
      ctx.fillRect(sp.x - 35, 270, 70, 170);
      ctx.fillStyle = '#5d4130';
      ctx.fillRect(sp.x - 35, 270, 30, 170);
    }
    if (hidden) {
      const scared = Math.abs(h.guard.x - sp.x) < 260;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sp.x - 6, 336, scared ? 2.4 : 3.4, 0, TAU);
      ctx.arc(sp.x + 6, 336, scared ? 2.4 : 3.4, 0, TAU);
      ctx.fill();
    } else if (Math.abs(h.player.x - sp.x) <= E.HIDE_REACH) {
      ctx.strokeStyle = 'rgba(159, 240, 216, ' + (0.5 + 0.4 * Math.sin(t * 6)) + ')';
      ctx.lineWidth = 3;
      ctx.strokeRect(sp.x - 40, 262, 80, 182);
    }
  }

  /** 복도 그리기. camX = 화면 왼쪽 끝의 복도 좌표 */
  S.hall = function (ctx, t, h, camX) {
    const bon = h.def.building === 'bon';
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    g.addColorStop(0, bon ? '#221d38' : '#1c2540');
    g.addColorStop(1, bon ? '#2c2547' : '#25304f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, FLOOR_Y);
    const f = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
    f.addColorStop(0, '#3a3450');
    f.addColorStop(1, '#16131f');
    ctx.fillStyle = f;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    ctx.save();
    ctx.translate(-camX, 0);
    ctx.fillStyle = '#1a1626';
    ctx.fillRect(camX, 52, W, 10);
    for (let x = Math.floor(camX / 300) * 300 + 150; x < camX + W + 300; x += 300) {
      ctx.fillStyle = '#3a3552';
      ctx.fillRect(x - 50, 62, 100, 8);
      // 달빛이 바닥에 비쳐요
      ctx.fillStyle = 'rgba(200, 210, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x - 40, FLOOR_Y);
      ctx.lineTo(x + 60, FLOOR_Y);
      ctx.lineTo(x + 120, H);
      ctx.lineTo(x - 10, H);
      ctx.fill();
    }
    h.cells.forEach((c) => {
      if (c.x1 < camX - 20 || c.x0 > camX + W + 20) return;
      corridorCell(ctx, c, h, t);
    });
    // 도착 문 표시
    ctx.strokeStyle = 'rgba(255, 209, 102, ' + (0.6 + 0.4 * Math.sin(t * 4)) + ')';
    ctx.lineWidth = 4;
    ctx.strokeRect(h.goalX - 46, 258, 92, 186);
    HG.text(ctx, '여기로!', h.goalX, 232, { size: 18, color: '#ffd166', stroke: 'rgba(10, 6, 20, 0.85)', strokeWidth: 5 });

    h.spots.forEach((sp, i) => hidingSpot(ctx, sp, h, i, t));

    // 경비원
    const gd = h.guard;
    const inside = gd.state === 'enter' || gd.state === 'inRoom';
    if (!inside) {
      guardLight(ctx, gd.x, gd);
      guardFigure(ctx, gd.x, t, gd);
    } else {
      ctx.fillStyle = 'rgba(255, 240, 170, 0.35)';
      ctx.fillRect(gd.x - 30, 286, 60, 150);
      HG.text(ctx, '🔦 교실 확인 중…', gd.x, 250, { size: 15, color: '#ffe9a8', stroke: 'rgba(10, 6, 20, 0.85)', strokeWidth: 4 });
    }
    if (gd.state === 'alert' || gd.state === 'chase') HG.text(ctx, '!', gd.x, FLOOR_Y - 175, { size: 46, font: HG.FONT_DISPLAY, color: '#ff4d4d', stroke: '#1a0000', strokeWidth: 6 });
    if (gd.state === 'search') HG.text(ctx, '?', gd.x, FLOOR_Y - 175, { size: 42, font: HG.FONT_DISPLAY, color: '#ffd166', stroke: '#1a0d00', strokeWidth: 6 });

    // 아이 (호박군)
    const p = h.player;
    if (p.hidden < 0) {
      art.pumpkinBoy(ctx, p.x, FLOOR_Y - 34, { t, pose: p.walking ? 'run' : 'idle', scale: 1.35, rot: 0 });
    }
    ctx.restore();

    // 위쪽 작은 지도: 복도 전체에서 내 위치와 경비원
    const mx = 20;
    const mw = 300;
    const k = mw / h.length;
    ctx.fillStyle = 'rgba(10, 8, 20, 0.7)';
    rr(ctx, mx - 10, 8, mw + 20, 30, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(mx, 22, mw, 3);
    h.spots.forEach((sp) => {
      ctx.fillStyle = '#9ff0d8';
      ctx.fillRect(mx + sp.x * k - 2, 17, 4, 12);
    });
    HG.text(ctx, '🚪', mx + h.goalX * k, 23, { size: 14 });
    if (!inside) {
      ctx.fillStyle = 'rgba(255, 240, 170, 0.5)';
      ctx.fillRect(Math.min(mx + gd.x * k, mx + (gd.x + gd.face * gd.cone) * k), 18, gd.cone * k, 10);
    }
    HG.text(ctx, '👮', mx + gd.x * k, 23, { size: 14 });
    HG.text(ctx, '🎃', mx + p.x * k, 23, { size: 14 });
    vignette(ctx, 0.4);
  };

  /* ---------------- 학교 지도 (대피 안내도 바탕) ---------------- */
  const WIDE = ['도서관', '교무실', '보건실', '중앙 현관', '과학실', '정보실', '다이룸터', '채움실', '나눔실', '몽글마루', '늘봄교실', '돌봄교실', '지능형과학실'];
  const NARROW = ['계단', 'EV', '화장실', '현관'];
  const weight = (n) => (WIDE.indexOf(n) >= 0 ? 1.25 : NARROW.indexOf(n) >= 0 ? 0.55 : 1);
  const MAP_X0 = 80;
  const MAP_X1 = 936;
  const ROW_H = 32;
  const FLOOR_TOP = { sin: { 3: 52, 2: 88, 1: 124 }, bon: { 3: 210, 2: 246, 1: 282 } };

  /** 지도에서 방 칸의 위치 */
  function cellRect(building, floor, index) {
    const row = E.BUILDINGS[building].floors[floor];
    const total = row.reduce((s, n) => s + weight(n), 0);
    const unit = (MAP_X1 - MAP_X0) / total;
    let x = MAP_X0;
    for (let i = 0; i < index; i++) x += weight(row[i]) * unit;
    return { x, y: FLOOR_TOP[building][floor], w: weight(row[index]) * unit, h: ROW_H };
  }
  S.cellRect = cellRect;

  function fitText(ctx, str, x, y, maxW, size, color) {
    let s = size;
    ctx.font = s + 'px ' + HG.FONT_UI;
    while (s > 7 && ctx.measureText(str).width > maxW) {
      s -= 1;
      ctx.font = s + 'px ' + HG.FONT_UI;
    }
    HG.text(ctx, str, x, y, { size: s, color });
  }

  function arrow(ctx, a, b, color, width, dash, t) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ? [10, 8] : []);
    ctx.lineDashOffset = dash ? -t * 30 : 0;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const mx = (a.x + b.x) / 2;
    ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(b.y - a.y, b.x - mx);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(ang - 0.5) * 12, b.y - Math.sin(ang - 0.5) * 12);
    ctx.lineTo(b.x - Math.cos(ang + 0.5) * 12, b.y - Math.sin(ang + 0.5) * 12);
    ctx.fill();
  }

  /** places: 경로의 방 이름들, done: 끝낸 방 개수 */
  S.map = function (ctx, t, places, done) {
    ctx.fillStyle = '#0f1530';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120, 160, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const routeSet = new Set(places);
    ['sin', 'bon'].forEach((b) => {
      const bd = E.BUILDINGS[b];
      HG.text(ctx, bd.name, 38, FLOOR_TOP[b][2] + ROW_H / 2, { size: 20, color: '#ffd166' });
      [3, 2, 1].forEach((f) => {
        HG.text(ctx, f + '층', MAP_X0 - 18, FLOOR_TOP[b][f] + ROW_H / 2, { size: 11, color: '#8fa0d0' });
        bd.floors[f].forEach((name, i) => {
          const r = cellRect(b, f, i);
          const onRoute = routeSet.has(name) && !(name === '현관');
          ctx.fillStyle = onRoute ? 'rgba(255, 138, 31, 0.28)' : 'rgba(255, 255, 255, 0.06)';
          ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
          ctx.strokeStyle = 'rgba(200, 210, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
          fitText(ctx, name, r.x + r.w / 2, r.y + r.h / 2 + 1, r.w - 4, 11, onRoute ? '#fff2dc' : '#b9c3e6');
        });
      });
    });
    // 연결통로
    ctx.strokeStyle = 'rgba(159, 240, 216, 0.6)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 3;
    const c1 = cellRect('sin', 1, 5);
    const c2 = cellRect('bon', 3, 4);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y + ROW_H);
    ctx.lineTo(c2.x + c2.w / 2, c2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    HG.text(ctx, '연결통로', c1.x + 50, 182, { size: 12, color: '#9ff0d8' });

    // 탈출 경로 (대피 안내도처럼 빨간 화살표)
    const pts = places.map((name) => {
      const at = E.locate(name);
      const r = cellRect(at.building, at.floor, at.index);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2, name };
    });
    for (let i = 0; i + 1 < pts.length; i++) {
      const past = i + 1 < done;
      const now = i + 1 === done;
      arrow(ctx, pts[i], pts[i + 1], past ? 'rgba(47, 191, 113, 0.9)' : now ? '#ff4d4d' : 'rgba(255, 120, 120, 0.35)', now ? 4 : 3, now, t);
    }
    pts.forEach((p, i) => {
      const cleared = i < done;
      const current = i === done;
      ctx.fillStyle = cleared ? '#2fbf71' : current ? '#ff8a1f' : '#3a3f6a';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 22, current ? 13 + Math.sin(t * 5) * 2 : 11, 0, TAU);
      ctx.fill();
      HG.text(ctx, cleared ? '✓' : String(i + 1), p.x, p.y - 21, { size: 13, color: '#fff' });
    });
    // 중앙 현관 아래로 탈출 화살표
    const exit = pts[pts.length - 1];
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.moveTo(exit.x - 14, exit.y + 18);
    ctx.lineTo(exit.x + 14, exit.y + 18);
    ctx.lineTo(exit.x + 14, exit.y + 34);
    ctx.lineTo(exit.x + 26, exit.y + 34);
    ctx.lineTo(exit.x, exit.y + 58);
    ctx.lineTo(exit.x - 26, exit.y + 34);
    ctx.lineTo(exit.x - 14, exit.y + 34);
    ctx.fill();
    HG.text(ctx, '탈출!', exit.x + 52, exit.y + 44, { size: 16, color: '#ff8a8a' });
  };

  /* ---------------- 제목 화면 배경 ---------------- */
  S.title = function (ctx, t, school) {
    S.outside(ctx, t, { school, sparks: [] });
    ctx.fillStyle = 'rgba(8, 5, 14, 0.35)';
    ctx.fillRect(0, 0, W, H);
  };
})();
