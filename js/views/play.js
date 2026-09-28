// 出題画面（仕様書 v2 5・6章）
// ウォームアップ → カウントダウン → タイムアタック（本番・腕試し）／練習
import { h, esc, confirmDialog } from '../ui.js';
import { buildCourse, COURSES, shuffle } from '../core/questions.js';
import { Session } from '../core/session.js';
import { TERMS, TERM_INFO, emptyAnswer, pressTerm, sortTerms, formatEquation, formatSide, hintsFor } from '../core/answer.js';
import { renderDiagram } from '../diagrams.js';
import { sfx } from '../sound.js';
import { addRecord, makeRecord, loadRecords } from '../storage.js';
import { PENALTY_MS } from '../config.js';

const KEY_TERM = { k: 'K', u: 'U', e: 'E', 1: 'K', 2: 'U', 3: 'E' };
const MODE_LABEL = { main: '本番', practice: '練習', challenge: '腕試し' };

export function fmtWatch(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

export function renderPlay(root, app, params) {
  const { mode = 'main', course = 'first', questions: custom = null, title = '' } = params;
  const s = app.settings;
  const timed = mode !== 'practice';
  const questions = custom ?? buildCourse(app.bank, course);
  const session = new Session({ questions });

  const intervals = [];
  const timeouts = [];
  const later = (fn, ms) => timeouts.push(setTimeout(fn, ms));
  let keyHandler = null;
  let warmup = null;
  let alive = true;

  const onKey = e => {
    if (document.querySelector('.modal-back')) return;
    if (keyHandler) keyHandler(e);
  };
  document.addEventListener('keydown', onKey);
  // タップ後にボタンへフォーカスが残ると Enter/Space が二重に効くので外す
  const onPointerUp = () => { const a = document.activeElement; if (a && a !== document.body && a.tagName === 'BUTTON') a.blur(); };
  root.addEventListener('pointerup', onPointerUp);

  const cleanup = () => {
    alive = false;
    intervals.forEach(clearInterval);
    timeouts.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey);
    root.removeEventListener('pointerup', onPointerUp);
  };

  const quit = async () => {
    const msg = timed ? '中断してホームに戻りますか？（この回の記録は残りません）' : '練習をやめてホームに戻りますか？';
    if (await confirmDialog(msg, { ok: '中断する' }) && alive) app.go('home');
  };

  // ---------------- ウォームアップ（本番のみ・任意） ----------------
  function runWarmup(next) {
    const order = shuffle(TERMS);
    const choices = shuffle(TERMS);
    let i = 0, correct = 0, busy = false;
    const t0 = performance.now();
    const el = h(`<div class="warmup">
      <button class="icon-btn quit" aria-label="中断">×</button>
      <p class="wu-title">ウォームアップ：式を選ぼう（タイムには入りません）</p>
      <p class="wu-count"></p>
      <p class="wu-prompt"></p>
      <div class="wu-choices">${choices.map((t, n) => `<button class="wu-choice" data-t="${t}"><kbd class="kb">${n + 1}</kbd>${TERM_INFO[t].formula}</button>`).join('')}</div>
      <p class="wu-msg" aria-live="polite"></p>
    </div>`);
    root.appendChild(el);
    const show = () => {
      el.querySelector('.wu-prompt').textContent = TERM_INFO[order[i]].name;
      el.querySelector('.wu-count').textContent = `${i + 1} / 3`;
    };
    const msg = el.querySelector('.wu-msg');
    const choose = t => {
      if (busy) return;
      const ok = t === order[i];
      ok ? (correct++, sfx.correct()) : sfx.wrong();
      el.querySelector(`[data-t="${t}"]`).classList.add(ok ? 'is-ok' : 'is-ng');
      if (!ok) {
        el.querySelector(`[data-t="${order[i]}"]`).classList.add('is-answer');
        msg.textContent = `${TERM_INFO[order[i]].name} = ${TERM_INFO[order[i]].formula}`;
      }
      busy = true;
      later(() => {
        el.querySelectorAll('.wu-choice').forEach(b => b.classList.remove('is-ok', 'is-ng', 'is-answer'));
        msg.textContent = '';
        busy = false;
        if (++i < 3) { show(); return; }
        warmup = { correct, sec: (performance.now() - t0) / 1000 };
        msg.textContent = `${correct} / 3 正解`;
        busy = true;
        later(() => { el.remove(); next(); }, 800);
      }, ok ? 250 : 900);
    };
    el.addEventListener('click', e => {
      if (e.target.closest('.quit')) { quit(); return; }
      const b = e.target.closest('.wu-choice');
      if (b) choose(b.dataset.t);
    });
    keyHandler = e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) { e.preventDefault(); choose(choices[n - 1]); }
      if (e.key === 'Escape') { e.preventDefault(); quit(); }
    };
    show();
  }

  // ---------------- カウントダウン ----------------
  function countdown(next) {
    const el = h(`<div class="countdown mode-${mode}"><span class="cd-num"></span>
      <p class="cd-note">${MODE_LABEL[mode]}・${esc(COURSES[course].label)}　<b>この結果は記録されます</b></p></div>`);
    root.appendChild(el);
    const span = el.querySelector('.cd-num');
    let n = 3;
    keyHandler = e => { if (e.key === 'Escape') { e.preventDefault(); quit(); } };
    const step = () => {
      if (!alive) return;
      if (n === 0) { el.remove(); sfx.start(); next(); return; }
      span.textContent = n;
      span.classList.remove('pop'); void span.offsetWidth; span.classList.add('pop');
      sfx.tick();
      n--;
      later(step, 650);
    };
    step();
  }

  // ---------------- 出題 ----------------
  function startPlay() {
    const switchRow = row => `
      <div class="sw-row" data-row="${row}">
        <span class="row-lbl">${row === 'start' ? 'はじめ' : 'あと'}</span>
        <div class="sws">${TERMS.map(t => `
          <button class="sw sw-${t}" data-row="${row}" data-t="${t}" aria-pressed="false" aria-label="${row === 'start' ? 'はじめ' : 'あと'}の${t}">
            <span class="sw-sym">${t}</span>${s.showFormula ? `<span class="sw-f">${TERM_INFO[t].formula}</span>` : ''}
          </button>`).join('')}
        </div>
      </div>`;

    const el = h(`<div class="play mode-${mode}">
      <header class="play-bar">
        <button class="icon-btn quit" aria-label="中断">×</button>
        <span class="play-mode">${mode === 'challenge' ? esc(COURSES[course].label) : `${MODE_LABEL[mode]}・${esc(title || COURSES[course].label)}`}</span>
        <span class="rec-flag">${timed ? '<i></i>記録されます' : '練習中・記録されません'}</span>
        <span class="play-progress"></span>
        <span class="play-timer" ${timed ? '' : 'hidden'}></span>
      </header>
      <main class="play-main">
        <section class="q-card">
          <p class="q-no"></p>
          <p class="q-text"></p>
          <div class="q-diagram"></div>
        </section>
        <section class="answer">
          <div class="eq-preview" aria-live="polite"></div>
          <div class="sw-rows">${switchRow('start')}<span class="eq-sign" aria-hidden="true">=</span>${switchRow('end')}</div>
          <div class="hint" hidden>
            <div class="hint-bar"><i></i></div>
            <div class="hint-body"></div>
          </div>
          <div class="actions">
            <button class="btn btn-na" data-na aria-pressed="false"><kbd class="kb">0</kbd>保存則は使えない</button>
            <button class="btn btn-primary btn-go" data-go><kbd class="kb">Enter</kbd>判定</button>
          </div>
          <div class="fb" hidden>
            <p class="fb-head">○ 正解</p>
            <p class="fb-trap" hidden></p>
            <div class="fb-actions">
              <button class="btn" data-explain>解説を見る</button>
              <button class="btn btn-primary" data-next><kbd class="kb">Enter</kbd>次へ</button>
            </div>
          </div>
        </section>
      </main>
      <div class="flash" aria-hidden="true"></div>
      <p class="sr-only" aria-live="assertive" data-live></p>
    </div>`);
    root.appendChild(el);

    const $ = sel => el.querySelector(sel);
    const answerEl = $('.answer');
    const hintEl = $('.hint');
    const fb = $('.fb');
    const flashEl = $('.flash');
    const live = $('[data-live]');

    let answer = emptyAnswer();
    let row = 'start';
    let locked = false;
    let fbOpen = false;

    const render = () => {
      for (const r of ['start', 'end']) {
        const list = answer[r];
        el.querySelector(`.sw-row[data-row="${r}"]`).classList.toggle('is-focus', row === r);
        for (const t of TERMS) {
          const b = el.querySelector(`.sw[data-row="${r}"][data-t="${t}"]`);
          const on = list.includes(t) || (t === 'U' && list.includes('-U'));
          const neg = t === 'U' && list.includes('-U');
          b.classList.toggle('on', on);
          b.classList.toggle('neg', neg);
          b.setAttribute('aria-pressed', String(on));
          b.querySelector('.sw-sym').textContent = neg ? '−U' : t;
        }
      }
      const na = el.querySelector('[data-na]');
      na.classList.toggle('on', answer.notApplicable);
      na.setAttribute('aria-pressed', String(answer.notApplicable));
      const both = answer.start.length || answer.end.length;
      $('.eq-preview').innerHTML = answer.notApplicable
        ? '<span class="na-preview">保存則は使えない</span>'
        : both
        ? `<span>${esc(formatSide(sortTerms(answer.start)))}</span> = <span>${esc(formatSide(sortTerms(answer.end)))}</span>`
        : '<span class="placeholder">スイッチを押して式をつくる</span>';
    };

    const updateHud = () => {
      $('.play-progress').textContent = `${Math.min(session.index + 1, session.total)} / ${session.total}`;
      if (timed) $('.play-timer').textContent = fmtWatch(session.elapsedSec);
    };

    const hideHint = () => { hintEl.hidden = true; hintEl.className = 'hint'; };

    const loadQuestion = () => {
      const q = session.current;
      if (!q) return;
      $('.q-no').textContent = q.no ? `No.${q.no}` : '';
      $('.q-text').textContent = q.text;
      $('.q-diagram').innerHTML = renderDiagram(q.diagram, q.label);
      answer = emptyAnswer();
      row = 'start';
      hideHint();
      render();
      updateHud();
    };

    const flash = ok => {
      flashEl.className = `flash ${ok ? 'ok' : 'ng'}`;
      void flashEl.offsetWidth;
      flashEl.classList.add('run');
    };

    const finish = () => {
      if (!alive) return;
      const summary = session.summary();
      cleanup();
      if (timed) {
        sfx.finish();
        const before = loadRecords();
        const record = makeRecord({ summary, course, settings: s, warmup });
        addRecord(record);
        app.go('result', { mode, course, summary, record, before });
      } else {
        app.go('result', { mode, course, summary, title });
      }
    };

    const next = () => {
      session.advance();
      if (session.finished) { finish(); return; }
      loadQuestion();
    };

    // ---- 操作 ----
    const press = (r, t) => {
      if (locked || fbOpen) return;
      row = r;
      answer = { ...answer, notApplicable: false, [r]: pressTerm(answer[r], t) };
      render();
    };
    // 「保存則は使えない」も選ぶだけ。判定ボタンで提出する（スイッチとは同時に選べない）
    const toggleNA = () => {
      if (locked || fbOpen) return;
      answer = answer.notApplicable ? emptyAnswer() : { start: [], end: [], notApplicable: true };
      render();
    };
    const setRow = r => { if (locked || fbOpen) return; row = r; render(); };
    const clearRow = () => { if (locked || fbOpen) return; answer = { ...answer, notApplicable: false, [row]: [] }; render(); };

    const showHint = (q, ans, wrongs) => {
      const penalty = timed ? PENALTY_MS : 0;
      let html;
      if (wrongs >= 2) {
        html = `<p class="hint-answer">正解は <b>${esc(formatEquation(q))}</b>。${q.applicable ? '入力して判定しよう。' : '「保存則は使えない」を選んで判定しよう。'}</p>`;
      } else {
        const list = hintsFor(q, ans, app.bank.commonHints);
        html = `<p class="hint-title">ヒント</p>${list.map(t => `<p>${esc(t)}</p>`).join('') || '<p>もう一度読んでみよう。</p>'}`;
      }
      hintEl.querySelector('.hint-body').innerHTML = html;
      hintEl.hidden = false;
      hintEl.className = `hint ${wrongs >= 2 ? 'is-answer' : ''}`;
      if (penalty > 0) {
        locked = true;
        answerEl.classList.add('is-locked');
        const bar = hintEl.querySelector('.hint-bar i');
        bar.style.transition = 'none'; bar.style.width = '100%';
        void bar.offsetWidth;
        bar.style.transition = `width ${penalty}ms linear`; bar.style.width = '0%';
        later(() => { locked = false; answerEl.classList.remove('is-locked'); }, penalty);
      }
    };

    const submit = ans => {
      if (locked || fbOpen || session.finished) return;
      const q = session.current;
      const { correct, wrongs } = session.submit(ans);
      flash(correct);
      correct ? sfx.correct() : sfx.wrong();
      live.textContent = correct ? '正解' : '不正解';
      if (!correct) { showHint(q, ans, wrongs); return; }
      if (timed) {
        locked = true;
        later(() => { locked = false; next(); }, 180);
        return;
      }
      // 練習：解説を見られるパネル
      fbOpen = true;
      hideHint();
      fb.hidden = false;
      fb.querySelector('.fb-trap').hidden = true;
      fb.querySelector('.fb-trap').textContent = q.trap;
      answerEl.classList.add('is-fb');
    };
    const judgeNow = () => submit({ ...answer });
    const closeFb = () => { fbOpen = false; fb.hidden = true; answerEl.classList.remove('is-fb'); next(); };

    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.quit')) { quit(); return; }
      const sw = t.closest('.sw');
      if (sw) { press(sw.dataset.row, sw.dataset.t); return; }
      const rw = t.closest('.sw-row');
      if (rw) { setRow(rw.dataset.row); return; }
      if (t.closest('[data-na]')) { toggleNA(); return; }
      if (t.closest('[data-go]')) { judgeNow(); return; }
      if (t.closest('[data-explain]')) { fb.querySelector('.fb-trap').hidden = false; return; }
      if (t.closest('[data-next]')) closeFb();
    });

    keyHandler = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let handled = true;
      if (fbOpen) {
        if (k === 'Enter' || k === ' ') closeFb();
        else if (k === 'Escape') quit();
        else handled = false;
      } else if (KEY_TERM[k]) press(row, KEY_TERM[k]);
      else if (k === '4' || k === '=' || k === 'Tab') setRow(row === 'start' ? 'end' : 'start');
      else if (k === 'ArrowLeft' || k === 'ArrowUp') setRow('start');
      else if (k === 'ArrowRight' || k === 'ArrowDown') setRow('end');
      else if (k === 'Enter' || k === ' ') judgeNow();
      else if (k === '0' || k === 'n') toggleNA();
      else if (k === 'Backspace' || k === 'Delete') clearRow();
      else if (k === 'Escape') quit();
      else handled = false;
      if (handled) e.preventDefault();
    };

    session.start();
    loadQuestion();
    if (timed) intervals.push(setInterval(() => { if (alive) updateHud(); }, 100));
  }

  // ---------------- 流れ ----------------
  if (mode === 'main' && s.warmup) runWarmup(() => countdown(startPlay));
  else if (timed) countdown(startPlay);
  else startPlay();
  return cleanup;
}
