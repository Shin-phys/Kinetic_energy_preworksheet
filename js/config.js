// ===== 教員が編集する設定はこのファイルに集約 =====

export const APP_TITLE = '力学的エネルギー 立式ドリル';

/** localStorage のキー接頭辞（v1 とは別領域） */
export const STORAGE_PREFIX = 'kedrill.v2.';

/**
 * 称号の時間区分（仕様書 v2 7.2）。10問あたりの秒数。20問は自動で2倍。
 *   light：光速級 ＝「現実的に極めれば届く最速タイム ＋ 3秒」。試行して決める。
 *   walk ：歩く人級（これより速ければ「完走」より上）
 * その間の級は等比で自動的に割り振られる。
 */
export const TITLE_TIMES = { walk: 120, light: 31 };  // light：教員の最速 28秒 ＋ 3秒（2026-09 試行）

/** 腕試しの時間区分の倍率（初見の問題なので少し甘くしたいときに 1.2 などにする） */
export const CHALLENGE_TIME_FACTOR = 1.0;

/** 誤答時の操作不能時間（ミリ秒）。本番・腕試しのみ（練習は 0） */
export const PENALTY_MS = 1500;

/**
 * 腕試しの解放条件：本番（どのコースでも）でこの級番号以上を獲得
 * 0:導線中の電子 1:歩く人 2:雨粒 3:人類最速 4:新幹線 5:音速 …
 */
export const CHALLENGE_UNLOCK_LEVEL = 4;

/** 設定の既定値（生徒が設定画面で変更可） */
export const DEFAULT_SETTINGS = {
  course: 'first',     // 'first' | 'second' | 'full'
  warmup: false,       // 本番前にエネルギーの名前と式を結びつけるウォームアップ
  sound: true,         // 効果音
  student: '',         // 出席番号など（結果コード・送信に使う。メールアドレスは使わない）
};

/**
 * 段階3：Google Apps Script ウェブアプリの URL（…/exec）。
 * 空文字なら送信機能は表示されない。gas/Code.gs を参照。
 */
export const GAS_ENDPOINT = '';

/**
 * URLパラメータで教員が条件を配布できる。例：
 *   ?course=first&warmup=1&lock=1
 *   course    first | second | full
 *   warmup    1 | 0
 *   challenge 1 にすると腕試しを解放
 *   lock      1 にするとコースを固定（生徒が切り替えられない）
 */
export function readUrlOverrides(search = location.search) {
  const p = new URLSearchParams(search);
  const o = {};
  if (['first', 'second', 'full'].includes(p.get('course'))) o.course = p.get('course');
  if (p.has('warmup')) o.warmup = p.get('warmup') === '1';
  return { overrides: o, locked: p.get('lock') === '1', challenge: p.get('challenge') === '1' };
}
