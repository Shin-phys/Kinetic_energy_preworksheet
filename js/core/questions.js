// 問題データの結合・コース生成・検証。DOMに依存しない（Node の検証スクリプトからも使う）。

const VALID_TOKENS = new Set(['K', 'U', '-U', 'E']);

export const COURSES = {
  first: { label: '前半', detail: 'No.1〜10', n: 10 },
  second: { label: '後半', detail: 'No.11〜20', n: 10 },
  full: { label: '通し', detail: 'No.1〜20', n: 20 },
  basic: { label: '腕試し・基礎', detail: 'ランダム10問', n: 10 },
  advanced: { label: '腕試し・難関', detail: 'ランダム10問', n: 10 },
};

/** patterns.json の定義を継承させ、問題オブジェクトを作る */
export function mergeQuestion(q, patterns, set) {
  const p = patterns[q.type];
  if (!p) throw new Error(`未定義のパターン: ${q.type}（${q.id}）`);
  const applicable = (q.applicable ?? p.applicable) !== false;
  return {
    id: q.id,
    set,
    no: q.no ?? null,
    half: q.half ?? null,
    type: q.type,
    group: q.type[0],
    diagram: q.diagram ?? p.diagram ?? q.type,
    label: q.label ?? '',
    text: q.text,
    applicable,
    start: applicable ? [...(q.start ?? p.start)] : null,
    end: applicable ? [...(q.end ?? p.end)] : null,
    hint: { ...(p.hint ?? {}), ...(q.hint ?? {}) },
    trap: q.trap ?? p.trap,
    patternName: p.name,
  };
}

export function buildBank(patternsJson, questionsJson) {
  const patterns = patternsJson.patterns;
  const m = set => (questionsJson[set] ?? []).map(q => mergeQuestion(q, patterns, set));
  const main = m('main').sort((a, b) => a.no - b.no);
  return {
    patterns,
    groups: patternsJson.groups,
    commonHints: patternsJson.commonHints ?? {},
    main,
    basic: m('basic'),
    advanced: m('advanced'),
  };
}

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 腕試し：群ごとの比率（groups.perHalf）を保ってランダムに抽出 */
export function pickStratified(bank, pool, rng = Math.random) {
  const out = [];
  for (const [g, def] of Object.entries(bank.groups)) {
    out.push(...shuffle(pool.filter(q => q.group === g), rng).slice(0, def.perHalf));
  }
  return out;
}

/** コースの問題（出題順） */
export function buildCourse(bank, course, { shuffled = true, rng = Math.random } = {}) {
  let list;
  if (course === 'first') list = bank.main.filter(q => q.half === 1);
  else if (course === 'second') list = bank.main.filter(q => q.half === 2);
  else if (course === 'full') list = [...bank.main];
  else if (course === 'basic' || course === 'advanced') list = pickStratified(bank, bank[course], rng);
  else throw new Error(`未知のコース: ${course}`);
  return shuffled ? shuffle(list, rng) : list;
}

/** データの構成チェック。問題点の配列を返す（空なら OK） */
export function validateBank(bank, { diagramExists } = {}) {
  const errors = [];
  const ids = new Set();
  const all = [...bank.main, ...bank.basic, ...bank.advanced];
  for (const q of all) {
    if (ids.has(q.id)) errors.push(`id 重複 ${q.id}`);
    ids.add(q.id);
    if (!q.text) errors.push(`${q.id}: text が空`);
    if (q.applicable) {
      for (const side of ['start', 'end']) {
        const s = q[side];
        if (!Array.isArray(s) || s.length === 0) errors.push(`${q.id}: ${side} が空`);
        else {
          s.forEach(t => { if (!VALID_TOKENS.has(t)) errors.push(`${q.id}: 不正な項 ${t}`); });
          if (s.includes('U') && s.includes('-U')) errors.push(`${q.id}: ${side} に U と −U が同居`);
          if (new Set(s).size !== s.length) errors.push(`${q.id}: ${side} に重複`);
        }
        if (!q.hint?.[side]) errors.push(`${q.id}: hint.${side} がない`);
      }
    } else if (!q.hint?.equation) errors.push(`${q.id}: hint.equation がない`);
    if (diagramExists && !diagramExists(q.diagram)) errors.push(`${q.id}: 図 ${q.diagram}.svg がない`);
  }

  // 本番20問：No.1〜20、前半・後半の構成
  const nos = bank.main.map(q => q.no).sort((a, b) => a - b);
  if (bank.main.length !== 20 || nos.some((n, i) => n !== i + 1)) errors.push('本番: No.1〜20 がそろっていない');
  for (const half of [1, 2]) {
    const qs = bank.main.filter(q => q.half === half);
    const tag = half === 1 ? '前半' : '後半';
    if (qs.some(q => (half === 1 ? q.no > 10 : q.no <= 10))) errors.push(`${tag}: No. と half が合っていない`);
    for (const [g, def] of Object.entries(bank.groups)) {
      const n = qs.filter(q => q.group === g).length;
      if (n !== def.perHalf) errors.push(`${tag}: ${g}群が ${n}問（${def.perHalf}問にする）`);
    }
    for (const t of ['A5', 'A8', 'C1']) if (!qs.some(q => q.type === t)) errors.push(`${tag}: ${t} がない`);
  }
  // 腕試し：比率どおり抽出できるだけの数があるか
  for (const set of ['basic', 'advanced']) {
    if (!bank[set].length) continue;
    for (const [g, def] of Object.entries(bank.groups)) {
      const n = bank[set].filter(q => q.group === g).length;
      if (n < def.perHalf) errors.push(`${set}: ${g}群が ${n}問しかない（${def.perHalf}問以上必要）`);
    }
  }
  return errors;
}
