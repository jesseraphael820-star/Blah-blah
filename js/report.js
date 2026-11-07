// Geração de PDF (jsPDF carregado sob demanda) e compartilhamento.
import { fmtDateTime } from './utils.js';
import { STATUS, scoreLabel, scoreTone } from './score.js';

// Cópia local (js/vendor) com o CDN como alternativa.
const JSPDF_URLS = ['js/vendor/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
let loading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error(`Falha ao carregar ${src}`)); };
    document.head.appendChild(s);
  });
}

function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!loading) {
    loading = (async () => {
      for (const url of JSPDF_URLS) {
        try { await loadScript(url); if (window.jspdf?.jsPDF) return window.jspdf.jsPDF; } catch { /* tenta o próximo */ }
      }
      loading = null;
      throw new Error('jsPDF indisponível');
    })();
  }
  return loading;
}

// As fontes padrão do PDF usam Latin-1: troca símbolos fora dessa faixa.
const latin = (s) => String(s ?? '')
  .replace(/≈/g, '~').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  .replace(/…/g, '...').replace(/[βγα]/g, '').replace(/[^\x00-\xFF]/g, '');

const COLORS = {
  pass: [22, 190, 104], warn: [230, 168, 0], fail: [229, 57, 75], unavailable: [140, 148, 160], skipped: [140, 148, 160],
};

export async function exportPDF(report) {
  const JsPDF = await loadJsPDF();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  const { date, time } = fmtDateTime(report.createdAt);
  let y = 0;

  const header = () => {
    doc.setFillColor(9, 12, 16); doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(57, 255, 136); doc.rect(0, 30, W, 1.2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.setTextColor(255, 255, 255); doc.text('Phone', M, 18);
    doc.setTextColor(57, 255, 136); doc.text('Check', M + doc.getTextWidth('Phone'), 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(170, 180, 190);
    doc.text(latin('Relatório de diagnóstico do dispositivo'), M, 24);
    doc.text(latin(`${date} às ${time}`), W - M, 18, { align: 'right' });
    doc.text(latin(report.deviceLabel), W - M, 24, { align: 'right' });
    y = 42;
  };
  const ensure = (h) => { if (y + h > 280) { doc.addPage(); header(); } };

  header();

  // Resumo
  const s = report.summary;
  doc.setDrawColor(225, 230, 235); doc.setFillColor(246, 248, 250);
  doc.roundedRect(M, y, W - 2 * M, 38, 3, 3, 'FD');
  const col = COLORS[scoreTone(s.pct)];
  doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  doc.text(`${s.pct}%`, M + 8, y + 19);
  doc.setFontSize(11); doc.text(latin(scoreLabel(s.pct)), M + 8, y + 28);
  const stats = [['Realizados', s.executed], ['Aprovados', s.pass], ['Atenção', s.attention], ['N/D ou pulados', s.na]];
  stats.forEach(([k, v], i) => {
    const x = M + 62 + i * 28;
    doc.setTextColor(20, 24, 30); doc.setFontSize(16); doc.text(String(v), x, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 118, 128); doc.text(latin(k), x, y + 23);
    doc.setFont('helvetica', 'bold');
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(110, 118, 128);
  doc.text(latin('O percentual representa somente os testes aprovados entre os executados, não a saúde física real do aparelho.'), M + 62, y + 32, { maxWidth: W - 2 * M - 66 });
  y += 48;

  // Testes
  doc.setTextColor(20, 24, 30); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(latin('Relatório completo'), M, y); y += 6;

  for (const t of report.results) {
    const det = (t.details || []).map(([k, v]) => `${k}: ${v}`).join('   ·   ');
    doc.setFontSize(8);
    const detLines = det ? doc.splitTextToSize(latin(det), W - 2 * M - 12) : [];
    const noteLines = t.note ? doc.splitTextToSize(latin(t.note), W - 2 * M - 12) : [];
    const h = 13 + detLines.length * 3.6 + noteLines.length * 3.6;
    ensure(h + 2);
    doc.setDrawColor(232, 236, 240); doc.line(M, y, W - M, y);
    const c = COLORS[t.status] || COLORS.unavailable;
    doc.setFillColor(...c); doc.circle(M + 3, y + 6, 1.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20, 24, 30);
    doc.text(latin(t.name), M + 8, y + 7);
    doc.setTextColor(...c); doc.setFontSize(8.5);
    doc.text(latin(STATUS[t.status].label.toUpperCase()), W - M, y + 7, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 66, 74); doc.setFontSize(9);
    doc.text(latin(t.summary), M + 8, y + 11.5, { maxWidth: W - 2 * M - 12 });
    let yy = y + 15.5;
    doc.setFontSize(8); doc.setTextColor(120, 128, 138);
    detLines.forEach((l) => { doc.text(l, M + 8, yy); yy += 3.6; });
    doc.setTextColor(150, 120, 40);
    noteLines.forEach((l) => { doc.text(l, M + 8, yy); yy += 3.6; });
    y += h + 2;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(150, 156, 164);
    doc.text(latin('Gerado pelo PhoneCheck — diagnóstico executado localmente no navegador. Nenhum dado foi transmitido.'), M, 290);
    doc.text(`${i}/${pages}`, W - M, 290, { align: 'right' });
  }
  const stamp = new Date(report.createdAt).toISOString().slice(0, 16).replace(/[:T]/g, '-');
  doc.save(`phonecheck-relatorio-${stamp}.pdf`);
}

export function shareText(report) {
  const { date, time } = fmtDateTime(report.createdAt);
  const s = report.summary;
  const lines = [
    `PhoneCheck — Relatório de ${date} ${time}`,
    `${report.deviceLabel} · ${report.osLabel}`,
    `${s.pass} de ${s.executed} testes aprovados (${s.pct}% — ${scoreLabel(s.pct)})`,
    s.attention ? `Precisam de atenção: ${report.results.filter((r) => r.status === 'warn' || r.status === 'fail').map((r) => r.name).join(', ')}` : 'Nenhum item precisa de atenção.',
  ];
  return lines.join('\n');
}

export async function shareReport(report) {
  const text = shareText(report);
  const url = /^https?:/.test(location.href) ? location.origin + location.pathname : undefined;
  if (navigator.share) {
    try { await navigator.share({ title: 'Resultado PhoneCheck', text, url }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(url ? `${text}\n${url}` : text); return 'copied'; } catch { return 'failed'; }
}
