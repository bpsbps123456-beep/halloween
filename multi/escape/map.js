/* 동암초 탈출 — 대피 안내도 그림 (지도 화면과 복도 벽 포스터에 같이 써요) */
(function () {
  'use strict';

  const E = window.EscapeCore;
  const M = (window.EscapeMap = {});
  const TAU = Math.PI * 2;
  const W = 960;
  const H = 540;

  const WIDE = ['도서관', '교무실', '보건실', '중앙 현관', '과학실', '정보실', '다이룸터', '채움실', '나눔실', '몽글마루', '늘봄교실', '돌봄교실', '지능형과학실'];
  const NARROW = ['계단', 'EV', '화장실', '현관'];
  const weight = (n) => (WIDE.indexOf(n) >= 0 ? 1.25 : NARROW.indexOf(n) >= 0 ? 0.55 : 1);
  const MAP_X0 = 80;
  const MAP_X1 = 936;
  const ROW_H = 32;
  // 층끼리 모아 그려요: 3층(신관·본관, 가운데 연결다리) → 2층 → 1층
  const FLOOR_TOP = { sin: { 3: 40, 2: 150, 1: 250 }, bon: { 3: 98, 2: 186, 1: 286 } };
  const BUILDING_INK = { sin: '#ffd166', bon: '#9fd0ff' };
  const BUILDING_PAPER = { sin: '#c0392b', bon: '#1f5fa8' };

  /** 지도에서 방 칸의 위치 (960×540 그림 좌표) */
  function cellRect(building, floor, index) {
    const row = E.BUILDINGS[building].floors[floor];
    const total = row.reduce((s, n) => s + weight(n), 0);
    const unit = (MAP_X1 - MAP_X0) / total;
    let x = MAP_X0;
    for (let i = 0; i < index; i++) x += weight(row[i]) * unit;
    return { x, y: FLOOR_TOP[building][floor], w: weight(row[index]) * unit, h: ROW_H };
  }
  M.cellRect = cellRect;

  function text(ctx, str, x, y, size, color, font) {
    ctx.font = size + 'px ' + (font || HG.FONT_UI);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function fitText(ctx, str, x, y, maxW, size, color) {
    let s = size;
    ctx.font = s + 'px ' + HG.FONT_UI;
    while (s > 7 && ctx.measureText(str).width > maxW) {
      s -= 1;
      ctx.font = s + 'px ' + HG.FONT_UI;
    }
    text(ctx, str, x, y, s, color);
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

  /** 지도 그리기 (960×540 좌표). places: 경로의 방 이름들, done: 끝낸 방 개수
      opts.here = {building, floor, index} 이면 '현위치' 표시 (복도 포스터) */
  M.draw = function (ctx, t, places, done, opts) {
    const o = opts || {};
    ctx.fillStyle = o.paper ? '#f4f1e6' : '#0f1530';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = o.paper ? 'rgba(40, 60, 120, 0.08)' : 'rgba(120, 160, 255, 0.07)';
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
    const ink = o.paper ? '#1b2a4a' : '#b9c3e6';
    const routeSet = new Set(places);
    ['sin', 'bon'].forEach((b) => {
      const bd = E.BUILDINGS[b];
      [3, 2, 1].forEach((f) => {
        const y = FLOOR_TOP[b][f] + ROW_H / 2;
        text(ctx, bd.name, MAP_X0 - 52, y, 13, o.paper ? BUILDING_PAPER[b] : BUILDING_INK[b]);
        text(ctx, f + '층', MAP_X0 - 20, y, 13, o.paper ? '#33405e' : '#c9d3f0');
        ctx.fillStyle = o.paper ? BUILDING_PAPER[b] : BUILDING_INK[b];
        ctx.fillRect(MAP_X0 - 5, FLOOR_TOP[b][f] + 2, 3, ROW_H - 4);
        bd.floors[f].forEach((name, i) => {
          const r = cellRect(b, f, i);
          const onRoute = routeSet.has(name) && name !== '현관';
          ctx.fillStyle = onRoute ? (o.paper ? 'rgba(255, 138, 31, 0.35)' : 'rgba(255, 138, 31, 0.28)') : o.paper ? 'rgba(30, 50, 110, 0.06)' : 'rgba(255, 255, 255, 0.06)';
          ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
          ctx.strokeStyle = o.paper ? 'rgba(27, 42, 74, 0.55)' : 'rgba(200, 210, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
          fitText(ctx, name, r.x + r.w / 2, r.y + r.h / 2 + 1, r.w - 4, 11, onRoute ? (o.paper ? '#5a2a00' : '#fff2dc') : ink);
        });
      });
    });
    // 잠긴 현관 (신관 현관, 본관 동쪽 현관): 그래서 본관 중앙 현관까지 돌아가요
    [
      ['sin', 1, 0],
      ['bon', 1, 11],
    ].forEach(([b, f, i]) => {
      const r = cellRect(b, f, i);
      ctx.strokeStyle = '#e8443a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r.x + 6, r.y + 5);
      ctx.lineTo(r.x + r.w - 6, r.y + r.h - 5);
      ctx.moveTo(r.x + r.w - 6, r.y + 5);
      ctx.lineTo(r.x + 6, r.y + r.h - 5);
      ctx.stroke();
      text(ctx, '잠김', r.x + r.w / 2, b === 'sin' ? r.y - 8 : r.y + r.h + 9, 11, '#ff6b6b');
    });
    // 연결다리: 신관 3층 가운데 ↔ 본관 3층 가운데
    const bxm = (MAP_X0 + MAP_X1) / 2;
    const y0 = FLOOR_TOP.sin[3] + ROW_H;
    const y1 = FLOOR_TOP.bon[3];
    ctx.fillStyle = o.paper ? 'rgba(20, 140, 110, 0.35)' : 'rgba(159, 240, 216, 0.35)';
    ctx.fillRect(bxm - 9, y0, 18, y1 - y0);
    ctx.strokeStyle = o.paper ? '#148c6e' : '#9ff0d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(bxm - 9, y0, 18, y1 - y0);
    text(ctx, '3층 연결다리', bxm + 52, (y0 + y1) / 2, 12, o.paper ? '#148c6e' : '#9ff0d8');

    // 탈출 경로 (대피 안내도처럼 빨간 화살표)
    const pts = places.map((name) => {
      const at = E.locate(name);
      const r = cellRect(at.building, at.floor, at.index);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2, name };
    });
    for (let i = 0; i + 1 < pts.length; i++) {
      const past = i + 1 < done;
      const now = i + 1 === done;
      arrow(ctx, pts[i], pts[i + 1], past ? 'rgba(47, 191, 113, 0.9)' : now ? '#ff4d4d' : 'rgba(255, 120, 120, 0.45)', now ? 4 : 3, now, t);
    }
    pts.forEach((p, i) => {
      const cleared = i < done;
      const current = i === done;
      ctx.fillStyle = cleared ? '#2fbf71' : current ? '#ff8a1f' : '#3a3f6a';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 22, current ? 13 + Math.sin(t * 5) * 2 : 11, 0, TAU);
      ctx.fill();
      text(ctx, cleared ? '✓' : String(i + 1), p.x, p.y - 21, 13, '#fff');
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
    text(ctx, '탈출!', exit.x + 52, exit.y + 44, 16, o.paper ? '#c0392b' : '#ff8a8a');

    // 현위치 (복도 벽의 대피 안내도): 그 칸을 빨갛게 두르고 이름표를 달아요
    if (o.here) {
      const r = cellRect(o.here.building, o.here.floor, o.here.index);
      ctx.strokeStyle = '#e8443a';
      ctx.lineWidth = 4;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      const x = r.x + r.w / 2;
      ctx.fillStyle = '#e8443a';
      ctx.fillRect(x - 30, r.y - 18, 60, 18);
      text(ctx, '현위치', x, r.y - 9, 13, '#fff');
    }
  };

  /** 복도 벽에 붙일 대피 안내도 포스터 (캔버스) */
  M.poster = function (places, here, school) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 720;
    const g = c.getContext('2d');
    g.fillStyle = '#1b6e3c';
    g.fillRect(0, 0, 1024, 720);
    g.fillStyle = '#fff';
    g.fillRect(16, 96, 992, 608);
    text(g, '대피 안내도', 512, 50, 52, '#fff');
    text(g, school || '', 900, 50, 22, '#d8f5e2');
    g.save();
    g.translate(32, 100);
    g.scale(960 / W, 600 / H);
    M.draw(g, 0, places, 0, { paper: true, here });
    g.restore();
    return c;
  };
})();
