// 設定画面
import { h, esc, toast } from '../ui.js';

export function renderSettings(root, app) {
  const s = app.settings;
  const el = h(`<div class="settings">
    <header class="sub-head">
      <button class="icon-btn" data-home aria-label="ホームへ">←</button>
      <h1>設定</h1>
    </header>
    <form class="panel form" onsubmit="return false">
      <label class="check"><input type="checkbox" name="warmup" ${s.warmup ? 'checked' : ''}><span>本番の前にウォームアップ（エネルギーの名前と式を結びつける。タイムには入らない）</span></label>
      <label class="check"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}><span>効果音</span></label>
      <label class="field">
        <span>出席番号（任意・結果コードや送信に使います）</span>
        <input type="text" name="student" value="${esc(s.student)}" maxlength="20" placeholder="例：1-3-15" autocomplete="off">
      </label>
    </form>
    ${app.locked ? '<p class="note">コースは先生が指定したリンクで固定されています。</p>' : ''}
  </div>`);
  root.appendChild(el);

  el.querySelector('form').addEventListener('change', e => {
    const t = e.target;
    app.setSettings({ [t.name]: t.type === 'checkbox' ? t.checked : t.value.trim() });
    toast('保存しました');
  });
  el.querySelector('[data-home]').addEventListener('click', () => app.go('home'));
  const onKey = e => { if (e.key === 'Escape') app.go('home'); };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
