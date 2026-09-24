// 記録とグラフ
import { h, esc, toast, confirmDialog } from '../ui.js';
import { renderChart } from '../chart.js';
import { loadRecords, clearRecords, toCSV, downloadText, graduationStatus, RULE_LABEL, resultCode, copyText, updateRecord } from '../storage.js';
import { senderEnabled, sendRecord } from '../sender.js';
import { GRADUATION } from '../config.js';

export function renderHistory(root, app) {
  let rule = app.settings.rule;

  const draw = () => {
    root.innerHTML = '';
    const all = loadRecords();
    const limit = app.settings.limitSec;
    const recs = all.filter(r => r.rule === rule && (rule !== 'time' || r.limitSec === limit));
    const grad = graduationStatus(all);

    // パターン別の誤答回数（全記録）
    const miss = {};
    all.forEach(r => r.wrong.forEach(t => { miss[t] = (miss[t] ?? 0) + 1; }));
    const missRows = Object.entries(app.bank.patterns)
      .map(([id, p]) => ({ id, name: p.name, n: miss[id] ?? 0 }))
      .filter(r => r.n > 0)
      .sort((a, b) => b.n - a.n);
    const maxMiss = Math.max(1, ...missRows.map(r => r.n));

    const best = recs.length ? (rule === 'time' ? Math.max(...recs.map(r => r.correct)) : Math.min(...recs.map(r => r.timeSec))) : null;
    const recent = recs.slice(-5);
    const avg = recent.length ? recent.reduce((a, r) => a + (rule === 'time' ? r.correct : r.timeSec), 0) / recent.length : null;
    const unsent = all.filter(r => !r.sent);

    const el = h(`<div class="history">
      <header class="sub-head">
        <button class="icon-btn" data-home aria-label="ホームへ">←</button>
        <h1>記録とグラフ</h1>
      </header>

      <div class="seg" role="tablist">
        <button role="tab" class="${rule === 'time' ? 'on' : ''}" data-rule="time">時間内の正答数（${limit}秒）</button>
        <button role="tab" class="${rule === 'complete' ? 'on' : ''}" data-rule="complete">全問正答タイム</button>
      </div>

      <section class="panel">
        <div class="stats">
          <div><span class="stat-lbl">回数</span><span class="stat-val">${recs.length}</span></div>
          <div><span class="stat-lbl">ベスト</span><span class="stat-val">${best == null ? '—' : rule === 'time' ? `${best}問` : `${best}秒`}</span></div>
          <div><span class="stat-lbl">直近5回平均</span><span class="stat-val">${avg == null ? '—' : rule === 'time' ? `${avg.toFixed(1)}問` : `${avg.toFixed(1)}秒`}</span></div>
          <div><span class="stat-lbl">卒業</span><span class="stat-val">${grad.graduated ? '達成' : `あと${grad.need}回`}</span></div>
        </div>
        <div class="hist-chart"></div>
        <p class="note">グラフは自分の取り組みをふり返るための記録です。伸びた・伸び悩んだときに「何を変えたか」を言葉にしてみよう。</p>
      </section>

      <section class="panel">
        <h2>まちがえやすいパターン</h2>
        ${missRows.length ? `<table class="miss-table"><tbody>${missRows.map(r => `<tr>
          <th><span class="rv-type">${r.id}</span>${esc(r.name)}</th>
          <td><span class="bar" style="width:${(r.n / maxMiss) * 100}%"></span></td>
          <td class="num">${r.n}回</td></tr>`).join('')}</tbody></table>` : '<p class="muted">まだ誤答の記録はありません。</p>'}
      </section>

      <section class="panel">
        <h2>記録一覧</h2>
        <div class="export-row">
          <button class="btn btn-small" data-csv ${all.length ? '' : 'disabled'}>CSVで保存</button>
          <button class="btn btn-small" data-copy-last ${all.length ? '' : 'disabled'}>最新の結果コードをコピー</button>
          ${senderEnabled() && unsent.length ? `<button class="btn btn-small" data-send-all>未送信 ${unsent.length}件を送信</button>` : ''}
          <button class="btn btn-small btn-danger-ghost" data-clear ${all.length ? '' : 'disabled'}>全記録を削除</button>
        </div>
        ${all.length ? `<div class="table-wrap"><table class="rec-table">
          <thead><tr><th>#</th><th>日付</th><th>ルール</th><th>V</th><th>正答</th><th>時間</th><th>誤答パターン</th></tr></thead>
          <tbody>${all.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => `<tr>
            <td class="num">${i + 1}</td><td>${esc(r.date)} ${esc(r.time)}</td><td>${esc(RULE_LABEL[r.rule])}</td><td class="num">${r.version}</td>
            <td class="num">${r.correct}/${r.total}</td><td class="num">${r.timeSec}s</td><td>${esc(r.wrong.join(' ')) || '—'}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">記録はまだありません。</p>'}
      </section>
      <p class="muted small">記録はこの端末のブラウザにだけ保存されます。ブラウザのデータを消去すると消えるので、ときどきCSVで保存しておきましょう。卒業基準：${GRADUATION.limitSec}秒で${GRADUATION.minCorrect}問以上を${GRADUATION.streak}回連続。</p>
    </div>`);
    root.appendChild(el);
    renderChart(el.querySelector('.hist-chart'), recs, rule, { total: 20 });
  };

  const onClick = async e => {
    const t = e.target;
    if (t.closest('[data-home]')) { app.go('home'); return; }
    const r = t.closest('[data-rule]');
    if (r) { rule = r.dataset.rule; draw(); return; }
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
      if (await confirmDialog('この端末の記録をすべて削除します。元に戻せません。先にCSVで保存しましたか？', { ok: '削除する', danger: true })) {
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
