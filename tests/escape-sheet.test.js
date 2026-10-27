/* 반 전체 명예의 전당: 구글 시트 Apps Script 가 기록을 잘 모으고 순서대로 돌려주는지 확인해요. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSheetApp } = require('./sheet-mock.js');
const E = require('../multi/escape/core.js').EscapeCore;

const CLS = '동암초등학교 6-3';

test('시트: 빈 시트는 빈 목록, 기록을 올리면 빠른 순서로 돌려줘요', () => {
  const app = createSheetApp();
  assert.deepEqual(app.get({ action: 'list', cls: CLS }), { ok: true, rows: [] });
  app.get({ action: 'add', cls: CLS, name: '1모둠', score: '612.4', hints: '2', caught: '1', id: 'a' });
  const r = app.get({ action: 'add', cls: CLS, name: '2모둠', score: '480', hints: '0', caught: '0', id: 'b' });
  assert.ok(r.ok);
  assert.equal(r.rank, 0, '2모둠이 1등');
  assert.deepEqual(
    r.rows.map((x) => [x.name, x.score, x.hints, x.caught]),
    [
      ['2모둠', 480, 0, 0],
      ['1모둠', 612.4, 2, 1],
    ]
  );
  // 머리줄 + 두 줄, 사람이 읽는 시간 칸
  const sh = app.sheets.get('명예의 전당');
  assert.equal(sh.rows.length, 3);
  assert.equal(sh.rows[1][4], '10:12');
});

test('시트: 같은 기록을 두 번 보내도 한 줄, 다른 반 기록은 섞이지 않아요', () => {
  const app = createSheetApp();
  app.get({ action: 'add', cls: CLS, name: '1모둠', score: '600', id: 'same' });
  app.get({ action: 'add', cls: CLS, name: '1모둠', score: '600', id: 'same' });
  app.get({ action: 'add', cls: '동암초등학교 6-2', name: '옆반', score: '100', id: 'x' });
  const rows = app.get({ action: 'list', cls: CLS }).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '1모둠');
});

test('시트: 10모둠까지만 보여 주고, 11등도 순위는 알려 줘요', () => {
  const app = createSheetApp();
  for (let i = 0; i < 12; i++) app.get({ action: 'add', cls: CLS, name: i + 1 + '모둠', score: String(300 + i * 10), id: 'r' + i });
  const r = app.get({ action: 'add', cls: CLS, name: '늦은 모둠', score: '999', id: 'late' });
  assert.equal(r.rows.length, 10);
  assert.equal(r.rank, 12);
});

test('시트: 이상한 기록은 안 받고, 수식처럼 보이는 이름은 글자로 남겨요', () => {
  const app = createSheetApp();
  assert.equal(app.get({ action: 'add', cls: CLS, name: 'x', score: 'abc' }).ok, false);
  assert.equal(app.get({ action: 'add', cls: CLS, name: 'x', score: '-5' }).ok, false);
  assert.equal(app.get({ action: 'add', cls: '', name: 'x', score: '100' }).ok, false);
  const r = app.get({ action: 'add', cls: CLS, name: '=HYPERLINK("x")', score: '200', id: 'f' });
  assert.ok(r.ok);
  assert.equal(r.rows[0].name, '=HYPERLINK("x")'.slice(0, 12));
  assert.equal(app.get({ action: 'add', cls: CLS, name: '   ', score: '210', id: 'g' }).rows[1].name, '이름 없음');
});

test('시트 주소: 구글 Apps Script 웹 앱 주소만 받아요', () => {
  const ok = 'https://script.google.com/macros/s/AKfycbx_abc-123/exec';
  assert.equal(E.normalizeSettings({ sheet: ok }).sheet, ok);
  assert.equal(E.normalizeSettings({ sheet: ' ' + ok + '?x=1 ' }).sheet, ok);
  const ws = 'https://script.google.com/a/macros/gclass.ice.go.kr/s/AKfy/exec';
  assert.equal(E.normalizeSettings({ sheet: ws }).sheet, ws);
  assert.equal(E.normalizeSettings({ sheet: 'https://evil.example.com/exec' }).sheet, '');
  assert.equal(E.normalizeSettings({ sheet: 'https://script.google.com/macros/s/AKfy/dev' }).sheet, '');
  const code = E.encodeSettings({ sheet: ok });
  assert.equal(E.decodeSettings(code).sheet, ok);
});
