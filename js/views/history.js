// 記録とグラフ（コースごと）
import { h, esc, toast, confirmDialog } from '../ui.js';
import { renderChart } from '../chart.js';
import { COURSES } from '../core/questions.js';
import { TITLES } from '../core/titles.js';
import { loadRecords, clearRecords, toCSV, downloadText, recordsOf, resultCode, copyText, updateRecord } from '../storage.js';
import { senderEnabled, sendRecord } from '../sender.js';

const TABS = ['first', 'second', 'full', 'basic'];

export function renderHistory(root, app) {
  let course = TABS.includes(app.settings.course) ? app.settings.course : 'first';

  const draw = () => {
    root.innerHTML = '';
    const all = loadRecords();
    const recs = recordsOf(all, course);
    const best = recs.length ? Math.min(...recs.map(r => r.timeSec)) : null;
    const topLevel = recs.length ? Math.max(...recs.map(r => r.level)) : null;
    const topStar = recs.some(r => r.level === topLevel && r.star);
    const recent = recs.slice(-5);
    const avg = recent.length ? recent.reduce((a, r) => a + r.timeSec, 0) / recent.length : null;

    // ミスの多い問題（本番は No.、腕試しはパターン）
    const miss = {};
    for (const r of recs) {
      const keys = r.missedNos.length ? r.missedNos.map(n => `No.${n}`) : r.missedTypes;
      keys.forEach(k => { miss[k] = (miss[k] ?? 0) + 1; });
    }
    const missRows = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxMiss = Math.max(1, ...missRows.map(r => r[1]));
    const noText = no => app.bank.main.find(q => q.no === Number(no.slice(3)))?.text ?? '';
    const unsent = all.filter(r => !r.sent);

    const el = h(`<div class="history">
      <header class="sub-head">
        <button class="icon-btn" data-home aria-label="ホームへ">←</button>
        <h1>記録とグラフ</h1>
      </header>

      <div class="seg" role="tablist">${TABS.map(c => `<button role="tab" class="${c === course ? 'on' : ''}" data-course="${c}">${COURSES[c].label}</button>`).join('')}</div>

      <section class="panel">
        <div class="stats">
          <div><span class="stat-lbl">回数</span><span class="stat-val">${recs.length}</span></div>
          <div><span class="stat-lbl">自己ベスト</span><span class="stat-val">${best == null ? '—' : `${best}秒`}</span></div>
          <div><span class="stat-lbl">直近5回の平均</span><span class="stat-val">${avg == null ? '—' : `${avg.toFixed(1)}秒`}</span></div>
          <div><span class="stat-lbl">最高の称号</span><span class="stat-val small-val">${topLevel == null ? '—' : esc(TITLES[topLevel].name + (topStar ? '★' : ''))}</span></div>
        </div>
        <div class="hist-chart"></div>
        <p class="note">グラフは下へ行くほど速い。伸びた・伸び悩んだときに「何を変えたか」を言葉にしてみよう。</p>
      </section>

      <section class="panel">
        <h2>ミスの多い問題</h2>
        ${missRows.length ? `<table class="miss-table"><tbody>${missRows.map(([k, n]) => `<tr>
          <th><span class="rv-type">${esc(k)}</span><span class="miss-text">${esc(k.startsWith('No.') ? noText(k) : app.bank.patterns[k]?.name ?? '')}</span></th>
          <td><span class="bar" style="width:${(n / maxMiss) * 100}%"></span></td>
          <td class="num">${n}回</td></tr>`).join('')}</tbody></table>` : '<p class="muted">まだミスの記録はありません。</p>'}
      </section>

      <section class="panel">
        <h2>記録一覧（全コース）</h2>
        <div class="export-row">
          <button class="btn btn-small" data-csv ${all.length ? '' : 'disabled'}>CSVで保存</button>
          <button class="btn btn-small" data-copy-last ${all.length ? '' : 'disabled'}>最新の結果コードをコピー</button>
          ${senderEnabled() && unsent.length ? `<button class="btn btn-small" data-send-all>未送信 ${unsent.length}件を送信</button>` : ''}
          <button class="btn btn-small btn-danger-ghost" data-clear ${all.length ? '' : 'disabled'}>全記録を削除</button>
        </div>
        ${all.length ? `<div class="table-wrap"><table class="rec-table">
          <thead><tr><th>#</th><th>日時</th><th>コース</th><th>タイム</th><th>ミス</th><th>称号</th><th>ミスした問題</th></tr></thead>
          <tbody>${all.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => `<tr>
            <td class="num">${i + 1}</td><td>${esc(r.date)} ${esc(r.time)}</td><td>${esc(COURSES[r.course].label)}</td>
            <td class="num">${r.timeSec}秒</td><td class="num">${r.misses}</td><td>${esc(TITLES[r.level].name)}${r.star ? '★' : ''}</td>
            <td>${esc(r.missedNos.length ? r.missedNos.map(n => `No.${n}`).join(' ') : r.missedTypes.join(' ')) || '—'}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">記録はまだありません。</p>'}
      </section>
      <p class="muted small">記録はこの端末のブラウザにだけ保存されます（練習モードは記録されません）。紙の記録用紙にも書き写しておこう。</p>
    </div>`);
    root.appendChild(el);
    renderChart(el.querySelector('.hist-chart'), recs, course);
  };

  const onClick = async e => {
    const t = e.target;
    if (t.closest('[data-home]')) { app.go('home'); return; }
    const c = t.closest('[data-course]');
    if (c) { course = c.dataset.course; draw(); return; }
    if (t.closest('[data-csv]')) {
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const who = app.settings.student ? `_${app.settings.student}` : '';
      downloadText(`energy-drill${who}_${stamp}.csv`, toCSV(loadRecords()));
      return;
    }
    if (t.closest('[data-copy-last]')) {
      const all = loadRecords();
      toast((await copyText(resultCode(all[all.length - 1]))) ? 'コピーしました' : 'コピーできませんでした');
      return;
    }
    if (t.closest('[data-send-all]')) {
      const list = loadRecords().filter(x => !x.sent);
      let ok = 0;
      for (const rec of list) {
        try { await sendRecord(rec); updateRecord(rec.id, { sent: true }); ok++; } catch { /* 次へ */ }
      }
      toast(`${ok} / ${list.length} 件を送信しました`);
      draw();
      return;
    }
    if (t.closest('[data-clear]')) {
      if (await confirmDialog('この端末の記録をすべて削除します。称号図鑑もリセットされます。元に戻せません。', { ok: '削除する', danger: true })) {
        clearRecords();
        draw();
      }
    }
  };
  root.addEventListener('click', onClick);
  const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.modal-back')) app.go('home'); };
  document.addEventListener('keydown', onKey);
  draw();
  return () => { root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
}
