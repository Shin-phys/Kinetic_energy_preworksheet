/**
 * 段階3：記録受信用 Google Apps Script（スプレッドシートにバインドして使う）
 *
 * 設置手順
 *  1. 記録用のスプレッドシートを作り、［拡張機能］→［Apps Script］を開く
 *  2. このファイルの内容を貼り付けて保存
 *  3. ［デプロイ］→［新しいデプロイ］→ 種類「ウェブアプリ」
 *       実行ユーザー：自分 ／ アクセスできるユーザー：全員
 *  4. 表示された URL（…/exec）を js/config.js の GAS_ENDPOINT に貼る
 *
 * アプリは Content-Type: text/plain で JSON を送る（CORS のプリフライト回避）。
 * 個人識別はメールアドレスではなく、アプリの設定画面で入力した出席番号。
 */

const SHEET_NAME = '記録';
const HEADERS = [
  '受信日時', '出席番号', '実施日', '時刻', 'ルール', '制限時間(秒)', 'バージョン',
  '正答数', '解答数', '問題数', '所要時間(秒)', '誤答回数', '誤答パターン', 'ウォームアップ', '記録ID',
];
const RULE_LABEL = { time: '時間内正答数', complete: '全問正答タイム' };

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const d = JSON.parse(e.postData.contents);
    if (d.app !== 'kedrill') return json_({ ok: false, error: 'unknown app' });

    const sheet = getSheet_();
    // 同じ記録IDの二重送信は無視
    const ids = sheet.getLastRow() > 1
      ? sheet.getRange(2, HEADERS.length, sheet.getLastRow() - 1, 1).getValues().flat()
      : [];
    if (ids.indexOf(d.id) >= 0) return json_({ ok: true, duplicate: true });

    sheet.appendRow([
      new Date(), String(d.student || ''), d.date, d.time, RULE_LABEL[d.rule] || d.rule, d.limitSec || '',
      d.version, d.correct, d.answered, d.total, d.timeSec, d.misses,
      (d.wrong || []).join(' '), d.warmup || '', d.id,
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: 'kedrill receiver is running' });
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
