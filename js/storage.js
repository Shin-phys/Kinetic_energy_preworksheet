// 記録・設定の保存（段階1：localStorage のみ）と書き出し（段階2：CSV／結果コード）
import { STORAGE_PREFIX, DEFAULT_SETTINGS, GRADUATION } from './config.js';

const K = {
  settings: STORAGE_PREFIX + 'settings',
  records: STORAGE_PREFIX + 'records',
  nextVersion: STORAGE_PREFIX + 'nextVersion',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ---- 設定 ----
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...load(K.settings, {}) };
}
export function saveSettings(s) { save(K.settings, s); }

// ---- バージョン順送り ----
export function getNextVersion(count) {
  const v = load(K.nextVersion, 1);
  return v >= 1 && v <= count ? v : 1;
}
export function advanceVersion(current, count) {
  save(K.nextVersion, (current % count) + 1);
}

// ---- 記録 ----
export function loadRecords() { return load(K.records, []); }
export function addRecord(rec) {
  const list = loadRecords();
  list.push(rec);
  save(K.records, list);
  return list;
}
export function updateRecord(id, patch) {
  const list = loadRecords().map(r => (r.id === id ? { ...r, ...patch } : r));
  save(K.records, list);
  return list;
}
export function clearRecords() { save(K.records, []); }

/** 本番1回分の記録オブジェクト（仕様書 8.2） */
export function makeRecord({ summary, settings, version, warmup }) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return {
    id: now.getTime().toString(36),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    rule: settings.rule,
    limitSec: settings.rule === 'time' ? settings.limitSec : null,
    version,
    total: summary.total,
    answered: summary.answered,
    correct: summary.correct,
    timeSec: Math.round(summary.timeSec * 10) / 10,
    misses: summary.misses,
    wrong: summary.wrongTypes,
    warmup: warmup ? `${warmup.correct}/3` : '',
    student: settings.student || '',
    sent: false,
  };
}

// ---- 卒業判定（仕様書 8.4） ----
export function graduationStatus(records) {
  const { minCorrect, streak, limitSec } = GRADUATION;
  let run = 0, graduatedAt = null;
  for (const r of records) {
    if (r.rule !== 'time' || r.limitSec !== limitSec) continue;
    run = r.correct >= minCorrect ? run + 1 : 0;
    if (run >= streak && !graduatedAt) graduatedAt = r.date;
  }
  return { graduated: !!graduatedAt, graduatedAt, currentStreak: run, need: Math.max(0, streak - run) };
}

// ---- 書き出し ----
export const RULE_LABEL = { time: '時間内正答数', complete: '全問正答タイム' };

export function resultCode(r) {
  const who = r.student ? `${r.student} ` : '';
  const body = r.rule === 'time'
    ? `正答${r.correct}/${r.total}（解答${r.answered}・${r.limitSec}秒）`
    : `全問正答${r.timeSec}秒（誤答${r.misses}回）`;
  return `${who}${r.date} ${r.time} V${r.version} ${body} 誤答:${r.wrong.length ? r.wrong.join(',') : 'なし'}`;
}

export function toCSV(records) {
  const head = ['実施日', '時刻', '出席番号', 'ルール', '制限時間(秒)', 'バージョン', '正答数', '解答数', '問題数', '所要時間(秒)', '誤答回数', '誤答パターン', 'ウォームアップ'];
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = records.map(r => [r.date, r.time, r.student, RULE_LABEL[r.rule], r.limitSec ?? '', r.version, r.correct, r.answered, r.total, r.timeSec, r.misses, r.wrong.join(' '), r.warmup]);
  return '﻿' + [head, ...rows].map(row => row.map(esc).join(',')).join('\r\n');
}

export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* noop */ }
    ta.remove(); return ok;
  }
}
