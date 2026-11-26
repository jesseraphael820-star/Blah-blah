// Registra as tabelas de texto dos 14 idiomas.
import { registerStrings } from '../core/i18n.js';
import pt from './pt.js'; import en from './en.js'; import es from './es.js'; import fr from './fr.js'; import de from './de.js'; import it from './it.js'; import ja from './ja.js';
import ko from './ko.js'; import zh from './zh.js'; import ru from './ru.js'; import pl from './pl.js'; import tr from './tr.js'; import ar from './ar.js'; import hi from './hi.js';
const ALL = { pt, en, es, fr, de, it, ja, ko, zh, ru, pl, tr, ar, hi };
for (const [k, v] of Object.entries(ALL)) registerStrings(k, v);
export default ALL;
