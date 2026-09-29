// 画面部品の小さなヘルパー
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 式を含む文字列を HTML に：エスケープしたうえで、添字 ₀〜₉ を <sub> にする */
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
export const math = s => esc(s).replace(/[₀-₉]/g, c => `<sub>${SUBS.indexOf(c)}</sub>`);

/** HTML文字列から要素を1つ作る */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function fmtTime(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}
export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let toastTimer = null;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('<div class="toast" role="status" aria-live="polite"></div>'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/** 確認ダイアログ（ブラウザ標準の confirm は使わない） */
export function confirmDialog(message, { ok = 'OK', cancel = 'キャンセル', danger = false } = {}) {
  return new Promise(resolve => {
    const d = h(`<div class="modal-back" role="dialog" aria-modal="true">
      <div class="modal">
        <p>${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn" data-v="0">${esc(cancel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(ok)}</button>
        </div>
      </div></div>`);
    const close = v => { d.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(true); }
    };
    d.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (b) close(b.dataset.v === '1');
      else if (e.target === d) close(false);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(d);
    d.querySelector('[data-v="1"]').focus();
  });
}

/** 情報モーダル */
export function infoDialog(html, { title = '' } = {}) {
  const d = h(`<div class="modal-back" role="dialog" aria-modal="true">
    <div class="modal modal-wide">
      ${title ? `<h2>${esc(title)}</h2>` : ''}
      <div class="modal-body">${html}</div>
      <div class="modal-actions"><button class="btn btn-primary" data-close>閉じる</button></div>
    </div></div>`);
  const close = () => { d.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); } };
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(d);
  d.querySelector('[data-close]').focus();
}
