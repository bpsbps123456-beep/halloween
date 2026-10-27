/* 구글 시트 Apps Script(multi/escape/sheet/apps-script.gs)를 Node에서 돌려 보는 가짜 시트.
   escape-sheet.test.js 와 브라우저 확인에서 같이 써요. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createSheetApp() {
  const sheets = new Map();
  function makeSheet() {
    const rows = [];
    return {
      rows,
      appendRow(r) {
        // 시트처럼: 앞에 ' 를 붙인 글자는 ' 없이 글자로 남아요
        rows.push(r.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)));
      },
      setFrozenRows() {},
      getLastRow: () => rows.length,
      getRange(r, c, nr, nc) {
        return { getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)) };
      },
    };
  }
  let uid = 0;
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets.get(n) || null,
        insertSheet: (n) => {
          const s = makeSheet();
          sheets.set(n, s);
          return s;
        },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Utilities: { getUuid: () => 'uuid-' + ++uid + '-0000-0000' },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../multi/escape/sheet/apps-script.gs'), 'utf8'), ctx);
  return {
    sheets,
    /** 웹 앱 주소에 ?a=b 로 부른 것처럼 */
    get(params) {
      return JSON.parse(ctx.doGet({ parameter: params }).text);
    },
  };
}

module.exports = { createSheetApp };
