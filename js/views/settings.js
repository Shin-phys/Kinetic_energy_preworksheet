// 設定画面
import { h, esc, toast } from '../ui.js';
import { getNextVersion } from '../storage.js';

export function renderSettings(root, app) {
  const s = app.settings;
  const lockedKeys = app.locked ? new Set(Object.keys(app.overrides)) : new Set();
  const dis = key => (lockedKeys.has(key) ? 'disabled' : '');
  const vc = app.versionCount;

  const el = h(`<div class="settings">
    <header class="sub-head">
      <button class="icon-btn" data-home aria-label="ホームへ">←</button>
      <h1>設定</h1>
    </header>
    ${lockedKeys.size ? '<p class="note">一部の設定は先生が指定したリンクで固定されています。</p>' : ''}

    <form class="panel form" onsubmit="return false">
      <fieldset ${dis('rule')}>
        <legend>本番の記録方法</legend>
        <label class="radio"><input type="radio" name="rule" value="time" ${s.rule === 'time' ? 'checked' : ''}>
          <span><b>時間内の正答数</b>：制限時間内に何問正解できたか</span></label>
        <label class="radio"><input type="radio" name="rule" value="complete" ${s.rule === 'complete' ? 'checked' : ''}>
          <span><b>全問正答までの時間</b>：まちがえた問題は後ろに回り、20問すべて正解するまでのタイム</span></label>
      </fieldset>

      <label class="field">
        <span>制限時間（時間内の正答数のとき）</span>
        <select name="limitSec" ${dis('limitSec')}>
          ${[60, 90, 120, 150, 180, 240].map(n => `<option value="${n}" ${s.limitSec === n ? 'selected' : ''}>${n}秒${n === 120 ? '（標準）' : ''}</option>`).join('')}
          ${[60, 90, 120, 150, 180, 240].includes(s.limitSec) ? '' : `<option value="${s.limitSec}" selected>${s.limitSec}秒</option>`}
        </select>
      </label>

      <label class="field">
        <span>出題バージョン</span>
        <select name="version" ${dis('version')}>
          <option value="auto" ${s.version === 'auto' ? 'selected' : ''}>順送り（次はバージョン${getNextVersion(vc)}）</option>
          ${app.bank.versions.map(v => `<option value="${v.version}" ${String(s.version) === String(v.version) ? 'selected' : ''}>バージョン${v.version}に固定（${esc(v.theme)}）</option>`).join('')}
        </select>
      </label>

      <label class="check"><input type="checkbox" name="shuffle" ${s.shuffle ? 'checked' : ''} ${dis('shuffle')}><span>セット内の出題順をシャッフルする</span></label>
      <label class="check"><input type="checkbox" name="warmup" ${s.warmup ? 'checked' : ''} ${dis('warmup')}><span>本番前にウォームアップ（K・U・Eの式を選ぶ）</span></label>
      <label class="check"><input type="checkbox" name="showFormula" ${s.showFormula ? 'checked' : ''}><span>タイルに名前と式（½mv² など）を表示する</span></label>
      <label class="check"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}><span>効果音</span></label>

      <label class="field">
        <span>出席番号（任意・結果コードや送信に使います）</span>
        <input type="text" name="student" value="${esc(s.student)}" maxlength="20" placeholder="例：1-3-15" autocomplete="off">
      </label>
    </form>
  </div>`);
  root.appendChild(el);

  const form = el.querySelector('form');
  form.addEventListener('change', e => {
    const t = e.target;
    let v;
    if (t.type === 'checkbox') v = t.checked;
    else if (t.name === 'limitSec') v = parseInt(t.value, 10);
    else if (t.name === 'version') v = t.value === 'auto' ? 'auto' : parseInt(t.value, 10);
    else v = t.value.trim();
    app.setSettings({ [t.name]: v });
    toast('保存しました');
  });
  el.querySelector('[data-home]').addEventListener('click', () => app.go('home'));
  const onKey = e => { if (e.key === 'Escape') app.go('home'); };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
