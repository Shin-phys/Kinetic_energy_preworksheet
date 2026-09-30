// 記録・設定の保存（localStorage）と書き出し（結果コード／CSV）
import { STORAGE_PREFIX, DEFAULT_SETTINGS, TITLE_TIMES, CHALLENGE_TIME_FACTOR, ADVANCED_TIME_FACTOR, CHALLENGE_UNLOCK_LEVEL, ADVANCED_UNLOCK_LEVEL } from './config.js';
import { COURSES } from './core/questions.js';
import { levelFor, TITLES } from './core/titles.js';

const K = {
  settings: STORAGE_PREFIX + 'settings',
  records: STORAGE_PREFIX + 'records',
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
export function loadSettings() { return { ...DEFAULT_SETTINGS, ...load(K.settings, {}) }; }
export function saveSettings(s) { save(K.settings, s); }

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

export const isChallenge = course => course === 'basic' || course === 'advanced';
export const timeFactor = course => (course === 'advanced' ? ADVANCED_TIME_FACTOR : course === 'basic' ? CHALLENGE_TIME_FACTOR : 1);

/** 1回分の記録（仕様書 v2 8.1） */
export function makeRecord({ summary, course, settings, warmup }) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const level = levelFor(summary.timeSec, summary.n, TITLE_TIMES, timeFactor(course));
  return {
    id: now.getTime().toString(36),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    mode: isChallenge(course) ? 'challenge' : 'main',
    course,
    n: summary.n,
    timeSec: summary.timeSec,
    misses: summary.misses,
    missedNos: summary.missed.map(m => m.q.no).filter(n => n != null),
    missedTypes: [...new Set(summary.missed.map(m => m.q.type))],
    level,
    star: summary.noMiss,
    warmup: warmup ? `${warmup.correct}/3` : '',
    student: settings.student || '',
    sent: false,
  };
}

/** コースの記録（古い順） */
export const recordsOf = (records, course) => records.filter(r => r.course === course);

/** 自己ベスト（最短タイム） */
export function bestOf(records, course) {
  const list = recordsOf(records, course);
  return list.length ? list.reduce((a, b) => (b.timeSec < a.timeSec ? b : a)) : null;
}

/** 図鑑：級ごと（★の有無ごと）に、獲得したコースの集合 */
export function collection(records) {
  const cells = TITLES.map(() => ({ plain: new Set(), star: new Set() }));
  for (const r of records) {
    // 速い級を取れば、それより遅い級も獲得扱い
    for (let k = 0; k <= r.level; k++) {
      cells[k].plain.add(r.course);
      if (r.star) cells[k].star.add(r.course);
    }
  }
  return cells;
}

/** 腕試しが解放されているか */
export function challengeUnlocked(records, forced = false) {
  return forced || records.some(r => r.mode === 'main' && r.level >= CHALLENGE_UNLOCK_LEVEL);
}

/** 腕試し・難関が解放されているか（腕試し・基礎で一定の級） */
export function advancedUnlocked(records, forced = false) {
  return forced || records.some(r => r.course === 'basic' && r.level >= ADVANCED_UNLOCK_LEVEL);
}

// ---- 書き出し ----
export function resultCode(r) {
  const who = r.student ? `${r.student} ` : '';
  const title = `${TITLES[r.level].name}${r.star ? '★' : ''}`;
  const missed = r.missedNos.length ? `No.${r.missedNos.join(',')}` : (r.missedTypes.length ? r.missedTypes.join(',') : 'なし');
  return `${who}${r.date} ${r.time} ${COURSES[r.course].label} ${r.timeSec}秒 ミス${r.misses} ${title} 間違えた問題:${missed}`;
}

export function toCSV(records) {
  const head = ['実施日', '時刻', '出席番号', 'コース', '問題数', 'タイム(秒)', 'ミス回数', '称号', 'ノーミス', '間違えた問題No.', '間違えたパターン', 'ウォームアップ'];
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = records.map(r => [r.date, r.time, r.student, COURSES[r.course].label, r.n, r.timeSec, r.misses,
    TITLES[r.level].name, r.star ? '★' : '', r.missedNos.join(' '), r.missedTypes.join(' '), r.warmup]);
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
