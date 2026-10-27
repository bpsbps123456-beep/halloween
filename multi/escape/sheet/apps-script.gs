/* 동암초 탈출: 반 전체 명예의 전당 (구글 시트 Apps Script)

   쓰는 법 (README 「반 전체 명예의 전당」에 그림처럼 자세히 있어요)
   1. 구글 시트를 새로 만들고, 메뉴 「확장 프로그램 → Apps Script」를 열어요.
   2. 원래 있던 코드를 모두 지우고 이 파일 내용을 그대로 붙여 넣은 뒤 저장해요.
   3. 「배포 → 새 배포 → 유형: 웹 앱」, 실행 사용자: 나, 액세스 권한: 모든 사용자 → 배포.
   4. 나온 웹 앱 주소(https://script.google.com/macros/s/…/exec)를 게임의 선생님 설정에 붙여 넣어요.

   기록은 이 시트의 「명예의 전당」 탭에 한 줄씩 쌓여요. 지우고 싶은 기록은 그 줄을 지우면 돼요. */

const SHEET_NAME = '명예의 전당';
const HEAD = ['올린 시각', '반', '모둠 이름', '걸린 시간(초)', '걸린 시간', '힌트', '잡힘', '기록 번호'];
const TOP = 10;

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    out = p.action === 'add' ? addRecord(p) : { ok: true, rows: topRows(clean_(p.cls, 40), '').rows };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 글자 정리: 길이 제한, 수식처럼 보이는 글자(=, +, -, @)는 글자로만 남겨요 */
function clean_(v, n) {
  let s = String(v == null ? '' : v)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function count_(v) {
  const n = Math.round(Number(v));
  return n >= 0 && n < 1000 ? n : 0;
}

function timeText_(sec) {
  const s = Math.floor(sec);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function addRecord(p) {
  const cls = clean_(p.cls, 40);
  const name = clean_(p.name, 12) || '이름 없음';
  const score = Math.round(Number(p.score) * 10) / 10;
  if (!cls || !(score > 0 && score < 36000)) return { ok: false, error: '기록이 이상해요' };
  const id = clean_(p.id, 32) || Utilities.getUuid().slice(0, 12);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000); // 여러 모둠이 동시에 올려도 차례대로
  try {
    const sh = sheet_();
    const n = sh.getLastRow() - 1;
    const ids = n > 0 ? sh.getRange(2, 8, n, 1).getValues().map((r) => String(r[0])) : [];
    // 같은 기록을 두 번 보내도 한 줄만 남아요
    if (ids.indexOf(id) < 0) sh.appendRow([new Date(), cls, name, score, timeText_(score), count_(p.hints), count_(p.caught), id]);
  } finally {
    lock.releaseLock();
  }
  const t = topRows(cls, id);
  return { ok: true, rows: t.rows, rank: t.rank };
}

/** 그 반의 빠른 순서 10모둠과, id 기록의 순위(0부터, 없으면 -1) */
function topRows(cls, id) {
  const sh = sheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return { rows: [], rank: -1 };
  const all = sh
    .getRange(2, 1, n, 8)
    .getValues()
    .filter((r) => String(r[1]) === cls && Number(r[3]) > 0)
    .map((r) => ({
      name: String(r[2]).replace(/^'/, ''),
      score: Number(r[3]),
      hints: Number(r[5]) || 0,
      caught: Number(r[6]) || 0,
      id: String(r[7]),
      at: r[0] instanceof Date ? r[0].getTime() : 0,
    }))
    .sort((a, b) => a.score - b.score || a.at - b.at);
  const rank = id ? all.findIndex((r) => r.id === id) : -1;
  return { rows: all.slice(0, TOP), rank };
}
