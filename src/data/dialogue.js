// Carrega os roteiros bilíngues (PT/EN) e monta a estrutura de diálogos + tabelas de idioma.
// Outros idiomas podem fornecer arquivos src/i18n/dlg_<lang>.js com o mesmo formato { id: [texto|[opções]] }.
import { registerDialogue } from '../core/i18n.js';
import main1 from './dlg_main1.js';
import main2 from './dlg_main2.js';
import side from './dlg_side.js';

export const DLG = {};
const pt = {}, en = {};
for (const src of [main1, main2, side]) {
  for (const [id, lines] of Object.entries(src)) {
    DLG[id] = []; pt[id] = []; en[id] = [];
    for (const L of lines) {
      if (L[0] === '>') {
        DLG[id].push(['>', L[1].map(([p, , next, act]) => [p, next || null, act || null])]);
        pt[id].push(L[1].map((c) => c[0])); en[id].push(L[1].map((c) => c[1]));
      } else {
        const [sp, ex, p, e, act] = L;
        DLG[id].push([sp, ex, p, act || null]);
        pt[id].push(p); en[id].push(e);
      }
    }
  }
}
registerDialogue('pt', pt);
registerDialogue('en', en);
