// ===== 教員が編集する設定はこのファイルに集約 =====

export const APP_TITLE = '力学的エネルギー 立式ドリル';

/** localStorage のキー接頭辞（形式を大きく変えたら v2 に上げる） */
export const STORAGE_PREFIX = 'kedrill.v1.';

/** 設定の既定値（生徒が設定画面で変更可。URLパラメータで上書き可） */
export const DEFAULT_SETTINGS = {
  rule: 'time',        // 'time' = 制限時間内の正答数 / 'complete' = 全問正答までの時間
  limitSec: 120,       // 本番モードの制限時間（rule=time のとき）
  version: 'auto',     // 'auto' = 本番ごとに 1→2→3→4→1… と順送り / 数値で固定
  shuffle: true,       // セット内の出題順をシャッフル
  warmup: false,       // 本番前に K・U・E の式を選ぶウォームアップ
  sound: true,         // 効果音
  showFormula: true,   // タイルに「運動エネルギー ½mv²」などを併記
  student: '',         // 出席番号など（記録・送信に使う。メールアドレスは使わない）
};

/** 到達基準（仕様書 8.4）：制限時間 limitSec の本番で minCorrect 問以上を streak 回連続 */
export const GRADUATION = { minCorrect: 18, streak: 3, limitSec: 120 };

/**
 * 段階3：Google Apps Script ウェブアプリの URL（…/exec）。
 * 空文字なら送信機能は表示されない（段階1・2の運用）。gas/Code.gs を参照。
 */
export const GAS_ENDPOINT = '';

/**
 * URLパラメータで教員が条件を配布できる。例：
 *   ?rule=time&limit=120&v=auto&warmup=1&lock=1
 *   rule    time | complete
 *   limit   秒数
 *   v       auto | 1〜4
 *   warmup  1 | 0
 *   shuffle 1 | 0
 *   lock    1 にすると rule / limit / v を設定画面で変更できなくする
 */
export function readUrlOverrides(search = location.search) {
  const p = new URLSearchParams(search);
  const o = {};
  if (p.has('rule') && ['time', 'complete'].includes(p.get('rule'))) o.rule = p.get('rule');
  if (p.has('limit')) { const n = parseInt(p.get('limit'), 10); if (n >= 10 && n <= 1800) o.limitSec = n; }
  if (p.has('v')) { const v = p.get('v'); o.version = v === 'auto' ? 'auto' : (parseInt(v, 10) || 'auto'); }
  if (p.has('warmup')) o.warmup = p.get('warmup') === '1';
  if (p.has('shuffle')) o.shuffle = p.get('shuffle') !== '0';
  const locked = p.get('lock') === '1';
  return { overrides: o, locked };
}
