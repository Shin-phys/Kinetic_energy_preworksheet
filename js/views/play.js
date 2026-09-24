// 出題画面（ウォームアップ → カウントダウン → 本番／練習）
import { h, esc, fmtClock, confirmDialog } from '../ui.js';
import { buildSet, shuffle } from '../core/questions.js';
import { Session } from '../core/session.js';
import { TERMS, TERM_INFO, emptyAnswer, pressTerm, tapChip, formatEquation, formatAnswer, sortTerms } from '../core/answer.js';
import { renderDiagram } from '../diagrams.js';
import { sfx } from '../sound.js';
import { addRecord, makeRecord, advanceVersion } from '../storage.js';

const KEY_TERM = { k: 'K', u: 'U', e: 'E', 1: 'K', 2: 'U', 3: 'E' };

export function renderPlay(root, app, params) {
  const { mode = 'exam', questions: custom = null, title = '' } = params;
  const s = app.settings;
  const version = app.currentVersion();
  const questions = custom ?? buildSet(app.bank, version, { shuffled: s.shuffle });
  const session = new Session({ questions, mode, rule: s.rule, limitSec: s.limitSec });

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
    const ok = await confirmDialog(mode === 'exam' ? '中断してホームに戻りますか？（この回の記録は残りません）' : '練習をやめてホームに戻りますか？', { ok: '中断する' });
    if (ok && alive) app.go('home');
  };

  // ---------------- ウォームアップ ----------------
  function runWarmup(next) {
    const order = shuffle(TERMS);
    const choices = shuffle(TERMS);
    let i = 0, correct = 0;
    const t0 = performance.now();
    const el = h(`<div class="warmup">
      <button class="icon-btn quit" aria-label="中断">×</button>
      <p class="wu-title">ウォームアップ：式を選ぼう</p>
      <p class="wu-count"></p>
      <p class="wu-prompt"></p>
      <div class="wu-choices">${choices.map((t, n) => `<button class="wu-choice" data-t="${t}"><kbd class="kb">${n + 1}</kbd>${TERM_INFO[t].formula}</button>`).join('')}</div>
      <p class="wu-msg" aria-live="polite"></p>
    </div>`);
    root.appendChild(el);
    const promptEl = el.querySelector('.wu-prompt');
    const countEl = el.querySelector('.wu-count');
    const msgEl = el.querySelector('.wu-msg');
    let busy = false;
    const show = () => {
      promptEl.textContent = TERM_INFO[order[i]].name;
      countEl.textContent = `${i + 1} / 3`;
    };
    const choose = t => {
      if (busy) return;
      const ok = t === order[i];
      if (ok) { correct++; sfx.correct(); } else { sfx.wrong(); }
      const btn = el.querySelector(`[data-t="${t}"]`);
      btn.classList.add(ok ? 'is-ok' : 'is-ng');
      if (!ok) {
        el.querySelector(`[data-t="${order[i]}"]`).classList.add('is-answer');
        msgEl.textContent = `${TERM_INFO[order[i]].name} = ${TERM_INFO[order[i]].formula}`;
      }
      busy = true;
      later(() => {
        el.querySelectorAll('.wu-choice').forEach(b => b.classList.remove('is-ok', 'is-ng', 'is-answer'));
        msgEl.textContent = '';
        busy = false;
        i++;
        if (i < 3) { show(); return; }
        warmup = { correct, sec: (performance.now() - t0) / 1000 };
        msgEl.textContent = `${correct} / 3 正解（${warmup.sec.toFixed(1)}秒）`;
        busy = true;
        later(() => { el.remove(); next(); }, 900);
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
    const el = h('<div class="countdown"><span></span></div>');
    root.appendChild(el);
    const span = el.querySelector('span');
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
    const isExam = mode === 'exam';
    const el = h(`<div class="play ${isExam ? 'is-exam' : 'is-practice'}">
      <header class="play-bar">
        <button class="icon-btn quit" aria-label="中断">×</button>
        <span class="play-mode">${isExam ? '本番' : '練習'}${title ? `・${esc(title)}` : ''}</span>
        <span class="play-progress" aria-live="off"></span>
        <span class="play-timer" aria-live="off"></span>
      </header>
      <main class="play-main">
        <section class="q-card">
          <div class="q-diagram"></div>
          <p class="q-text"></p>
        </section>
        <section class="answer">
          <div class="eq">
            <div class="box" data-box="start" role="button" tabindex="-1" aria-label="はじめ">
              <span class="box-lbl">はじめ</span><div class="chips"></div>
            </div>
            <span class="eq-sign">=</span>
            <div class="box" data-box="end" role="button" tabindex="-1" aria-label="あと">
              <span class="box-lbl">あと</span><div class="chips"></div>
            </div>
          </div>
          <div class="tiles">
            ${TERMS.map((t, n) => `<button class="tile tile-${t}" data-term="${t}">
              <kbd class="kb">${t}</kbd>
              <span class="tile-sym">${t}</span>
              ${s.showFormula ? `<span class="tile-name">${TERM_INFO[t].name}</span><span class="tile-f">${TERM_INFO[t].formula}</span>` : ''}
            </button>`).join('')}
          </div>
          <div class="actions">
            <button class="btn btn-na" data-na><kbd class="kb">0</kbd>保存則は使えない</button>
            <button class="btn btn-primary btn-go" data-go><kbd class="kb">Enter</kbd><span class="go-lbl"></span></button>
          </div>
          <div class="fb" hidden>
            <p class="fb-head"></p>
            <p class="fb-your"></p>
            <p class="fb-trap"></p>
            <div class="fb-actions">
              <button class="btn" data-retry><kbd class="kb">R</kbd>もう一度</button>
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
    const boxes = { start: $('[data-box="start"]'), end: $('[data-box="end"]') };
    const flashEl = $('.flash');
    const fb = $('.fb');
    const live = $('[data-live]');

    let answer = emptyAnswer();
    let focus = 'start';
    let locked = false;
    let feedbackOpen = false;
    let isRetry = false;

    const renderBoxes = () => {
      for (const side of ['start', 'end']) {
        const b = boxes[side];
        const terms = sortTerms(answer[side]);
        b.classList.toggle('is-focus', focus === side);
        b.classList.toggle('is-empty', terms.length === 0);
        b.querySelector('.chips').innerHTML = terms.length
          ? terms.map((t, n) => `${n ? '<span class="plus">+</span>' : ''}<button class="chip chip-${t === '-U' ? 'U neg' : t}" data-chip="${t}" aria-label="${t === '-U' ? 'マイナスU' : t}を操作">${t === '-U' ? '(−U)' : t}</button>`).join('')
          : '<span class="placeholder">タイルを置く</span>';
      }
      const toEnd = focus === 'start' && answer.end.length === 0;
      $('.go-lbl').textContent = toEnd ? 'あと へ →' : '判定 ✓';
    };

    const updateHud = () => {
      const p = session.progress;
      $('.play-progress').textContent = session.rule === 'complete' ? `正解 ${p.done} / ${p.total}` : `${p.done} / ${p.total}`;
      const t = $('.play-timer');
      if (session.rule === 'time') {
        const r = session.remainingSec;
        t.textContent = fmtClock(r);
        t.classList.toggle('is-low', r <= 15);
      } else {
        t.textContent = fmtClock(session.elapsedSec);
      }
    };

    const loadQuestion = () => {
      const q = session.current;
      if (!q) return;
      $('.q-diagram').innerHTML = renderDiagram(q.diagram, q.label);
      $('.q-text').textContent = q.text;
      answer = emptyAnswer();
      focus = 'start';
      isRetry = false;
      renderBoxes();
      updateHud();
    };

    const flash = ok => {
      flashEl.className = `flash ${ok ? 'ok' : 'ng'}`;
      void flashEl.offsetWidth;
      flashEl.classList.add('run');
    };

    const finish = () => {
      if (!alive) return;
      session.finish();
      cleanup();
      const summary = session.summary();
      if (isExam) {
        sfx.finish();
        const record = makeRecord({ summary, settings: s, version, warmup });
        addRecord(record);
        if (s.version === 'auto' && !custom) advanceVersion(version, app.versionCount);
        app.go('result', { mode, summary, record, version });
      } else {
        app.go('result', { mode, summary, version, title });
      }
    };

    // ---- 操作 ----
    const press = term => {
      if (locked || feedbackOpen) return;
      answer = { ...answer, notApplicable: false, [focus]: pressTerm(answer[focus], term) };
      renderBoxes();
    };
    const chip = (side, token) => {
      if (locked || feedbackOpen) return;
      focus = side;
      answer = { ...answer, [side]: tapChip(answer[side], token) };
      renderBoxes();
    };
    const setFocus = side => { if (locked || feedbackOpen) return; focus = side; renderBoxes(); };
    const backspace = () => {
      if (locked || feedbackOpen) return;
      const list = sortTerms(answer[focus]);
      if (!list.length) return;
      answer = { ...answer, [focus]: list.slice(0, -1) };
      renderBoxes();
    };

    const submit = ans => {
      if (locked || feedbackOpen || session.finished) return;
      const q = session.current;
      const ok = session.submit(ans, { retry: isRetry });
      flash(ok);
      ok ? sfx.correct() : sfx.wrong();
      live.textContent = ok ? '正解' : '不正解';

      if (isExam) {
        if (session.finished) { locked = true; later(finish, 250); return; }
        // テンポ優先：すぐ次の問題を出し、連打の持ち越しだけ短時間ロック
        loadQuestion();
        locked = true;
        later(() => { locked = false; }, 80);
        return;
      }
      // 練習モード
      if (ok) {
        locked = true;
        showFeedback(true, q, ans);
        later(() => { locked = false; hideFeedback(); nextPractice(); }, 650);
      } else {
        showFeedback(false, q, ans);
      }
    };

    const primary = () => {
      if (feedbackOpen) { if (!fb.querySelector('[data-next]').hidden) { hideFeedback(); nextPractice(); } return; }
      if (focus === 'start' && answer.end.length === 0) { setFocus('end'); return; }
      submit({ ...answer, notApplicable: false });
    };
    const notApplicable = () => submit({ start: [], end: [], notApplicable: true });

    // ---- 練習モードのフィードバック ----
    function showFeedback(ok, q, ans) {
      feedbackOpen = true;
      fb.hidden = false;
      el.querySelector('.answer').classList.add('is-fb');
      fb.classList.toggle('is-ok', ok);
      fb.classList.toggle('is-ng', !ok);
      fb.querySelector('.fb-head').innerHTML = ok ? '○ 正解！' : `× 正解は <b>${esc(formatEquation(q))}</b>`;
      fb.querySelector('.fb-your').textContent = ok ? '' : `あなたの答え：${formatAnswer(ans)}`;
      fb.querySelector('.fb-trap').textContent = ok ? '' : q.trap;
      fb.querySelector('.fb-actions').hidden = ok;
      fb.querySelector('[data-next]').hidden = ok;
      fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function hideFeedback() { feedbackOpen = false; fb.hidden = true; el.querySelector('.answer').classList.remove('is-fb'); }
    function retry() {
      if (!feedbackOpen) return;
      hideFeedback();
      answer = emptyAnswer();
      focus = 'start';
      isRetry = true;
      renderBoxes();
    }
    function nextPractice() {
      session.advance();
      if (session.finished) { finish(); return; }
      loadQuestion();
    }

    el.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.quit')) { quit(); return; }
      const c = t.closest('[data-chip]');
      if (c) { chip(c.closest('[data-box]').dataset.box, c.dataset.chip); return; }
      const b = t.closest('[data-box]');
      if (b) { setFocus(b.dataset.box); return; }
      const tile = t.closest('[data-term]');
      if (tile) { press(tile.dataset.term); return; }
      if (t.closest('[data-na]')) { notApplicable(); return; }
      if (t.closest('[data-go]')) { primary(); return; }
      if (t.closest('[data-retry]')) { retry(); return; }
      if (t.closest('[data-next]')) { hideFeedback(); nextPractice(); }
    });

    keyHandler = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let handled = true;
      if (KEY_TERM[k]) press(KEY_TERM[k]);
      else if (k === 'ArrowLeft') setFocus('start');
      else if (k === 'ArrowRight') setFocus('end');
      else if (k === 'Tab') setFocus(focus === 'start' ? 'end' : 'start');
      else if (k === 'Enter' || k === ' ') primary();
      else if (k === '0' || k === 'n') notApplicable();
      else if (k === 'Backspace' || k === 'Delete') backspace();
      else if (k === 'r') retry();
      else if (k === 'Escape') quit();
      else handled = false;
      if (handled) e.preventDefault();
    };

    session.start();
    loadQuestion();
    intervals.push(setInterval(() => {
      if (!alive) return;
      if (session.timeUp && !session.finished) { locked = true; finish(); return; }
      updateHud();
    }, 100));
  }

  // ---------------- 流れ ----------------
  if (mode === 'exam') {
    if (s.warmup) runWarmup(() => countdown(startPlay));
    else countdown(startPlay);
  } else {
    startPlay();
  }
  return cleanup;
}
