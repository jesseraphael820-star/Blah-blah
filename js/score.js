// Status dos testes e cálculo do resumo.
export const STATUS = {
  pass: { label: 'Aprovado', icon: 'check', tone: 'pass' },
  warn: { label: 'Atenção', icon: 'alert', tone: 'warn' },
  fail: { label: 'Falha', icon: 'x', tone: 'fail' },
  unavailable: { label: 'Não disponível', icon: 'minus', tone: 'na' },
  skipped: { label: 'Pulado', icon: 'skip', tone: 'na' },
};

export const CATEGORIES = ['Sistema', 'Tela', 'Conectividade', 'Hardware', 'Multimídia', 'Sensores'];

/** Percentual = aprovados / testes executados (aprovados + atenção + falha). */
export function summarize(results) {
  const pass = results.filter((r) => r.status === 'pass').length;
  const warn = results.filter((r) => r.status === 'warn').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const na = results.length - pass - warn - fail;
  const executed = pass + warn + fail;
  const pct = executed ? Math.round((pass / executed) * 100) : 0;
  return { total: results.length, executed, pass, warn, fail, attention: warn + fail, na, pct };
}

export function scoreLabel(pct) {
  if (pct >= 95) return 'Excelente';
  if (pct >= 85) return 'Muito bom';
  if (pct >= 70) return 'Bom';
  if (pct >= 50) return 'Regular';
  return 'Precisa de atenção';
}

export function scoreTone(pct) {
  if (pct >= 85) return 'pass';
  if (pct >= 60) return 'warn';
  return 'fail';
}
