// 問題データの結合・セット生成・検証。DOMに依存しない（Node の検証スクリプトからも使う）。

const VALID_TOKENS = new Set(['K', 'U', '-U', 'E']);

/** patterns.json の定義を各問題に継承させ、仕様書7章の形の問題オブジェクトを作る */
export function mergeQuestion(q, patterns, version) {
  const p = patterns[q.type];
  if (!p) throw new Error(`未定義のパターン: ${q.type}（${q.id}）`);
  const applicable = (q.applicable ?? p.applicable) !== false;
  return {
    id: q.id,
    version,
    type: q.type,
    group: q.type[0],
    diagram: q.diagram ?? p.diagram ?? q.type,
    label: q.label ?? '',
    text: q.text,
    applicable,
    start: applicable ? [...(q.start ?? p.start)] : null,
    end: applicable ? [...(q.end ?? p.end)] : null,
    trap: q.trap ?? p.trap,
    patternName: p.name,
  };
}

/** データ全体を { versions: [{version, theme, questions:[merged]}] } に */
export function buildBank(patternsJson, questionsJson) {
  const patterns = patternsJson.patterns;
  return {
    patterns,
    groups: patternsJson.groups,
    versions: questionsJson.versions.map(v => ({
      version: v.version,
      theme: v.theme,
      questions: v.questions.map(q => mergeQuestion(q, patterns, v.version)),
    })),
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

/** 指定バージョンの20問セット */
export function buildSet(bank, versionNo, { shuffled = true, rng = Math.random } = {}) {
  const v = bank.versions.find(x => x.version === versionNo) ?? bank.versions[0];
  return shuffled ? shuffle(v.questions, rng) : [...v.questions];
}

/** データの構成チェック。問題点の配列を返す（空なら OK） */
export function validateBank(bank, { diagramExists } = {}) {
  const errors = [];
  const ids = new Set();
  const required = ['A5', 'A8', 'C1', 'A6', 'A7'];
  for (const v of bank.versions) {
    const tag = `バージョン${v.version}`;
    if (v.questions.length !== 20) errors.push(`${tag}: 問題数が ${v.questions.length}（20問にする）`);
    const byGroup = {};
    for (const q of v.questions) {
      byGroup[q.group] = (byGroup[q.group] ?? 0) + 1;
      if (ids.has(q.id)) errors.push(`${tag}: id 重複 ${q.id}`);
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
        }
      }
      if (diagramExists && !diagramExists(q.diagram)) errors.push(`${q.id}: 図 ${q.diagram}.svg がない`);
    }
    for (const [g, def] of Object.entries(bank.groups)) {
      if ((byGroup[g] ?? 0) !== def.count) errors.push(`${tag}: ${g}群が ${byGroup[g] ?? 0}問（${def.count}問にする）`);
    }
    for (const r of required) {
      if (!v.questions.some(q => q.type === r)) errors.push(`${tag}: ${r} が含まれていない`);
    }
  }
  return errors;
}
