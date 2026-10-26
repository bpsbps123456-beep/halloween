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
  const FLOOR_TOP = { sin: { 3: 52, 2: 88, 1: 124 }, bon: { 3: 210, 2: 246, 1: 282 } };

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
      text(ctx, bd.name, 38, FLOOR_TOP[b][2] + ROW_H / 2, 20, o.paper ? '#c0392b' : '#ffd166');
      [3, 2, 1].forEach((f) => {
        text(ctx, f + '층', MAP_X0 - 18, FLOOR_TOP[b][f] + ROW_H / 2, 11, o.paper ? '#55607a' : '#8fa0d0');
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
    // 연결통로
    ctx.strokeStyle = o.paper ? 'rgba(20, 140, 110, 0.8)' : 'rgba(159, 240, 216, 0.6)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 3;
    const c1 = cellRect('sin', 1, 5);
    const c2 = cellRect('bon', 3, 4);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y + ROW_H);
    ctx.lineTo(c2.x + c2.w / 2, c2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, '연결통로', c1.x + 50, 182, 12, o.paper ? '#148c6e' : '#9ff0d8');

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

    // 현위치 (복도 벽의 대피 안내도)
    if (o.here) {
      const r = cellRect(o.here.building, o.here.floor, o.here.index);
      const x = r.x + r.w / 2;
      const y = r.y + r.h + 10;
      ctx.fillStyle = '#e8443a';
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x - 9, y + 8);
      ctx.lineTo(x + 9, y + 8);
      ctx.fill();
      ctx.fillStyle = '#e8443a';
      ctx.fillRect(x - 30, y + 10, 60, 20);
      text(ctx, '현위치', x, y + 20, 13, '#fff');
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
