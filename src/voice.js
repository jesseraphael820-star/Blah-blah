// Speech (Web Speech API, built into the browser) + viseme-based lip sync.
// The mouth follows the text being spoken: each character maps to a mouth shape and the
// timeline is re-synced on every word boundary event the speech engine emits.

const VISEME = (ch) => {
  switch (ch) {
    case 'a': case 'á': case 'à': case 'ã': case 'â': return [1.0, 0.6];
    case 'e': case 'é': case 'ê': return [0.6, 0.95];
    case 'i': case 'í': return [0.32, 1.0];
    case 'o': case 'ó': case 'ô': case 'õ': return [0.8, 0.15];
    case 'u': case 'ú': return [0.42, 0.0];
    case 'm': case 'b': case 'p': return [0.0, 0.45];
    case 'f': case 'v': return [0.14, 0.6];
    case ' ': case ',': case '.': case '!': case '?': case '—': return [0.05, 0.5];
    default: return [0.35, 0.55];
  }
};

export class Voice {
  constructor() {
    this.synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voices = [];
    this.enabled = true;
    const load = () => { this.voices = this.synth ? this.synth.getVoices() : []; };
    if (this.synth) { load(); this.synth.onvoiceschanged = load; }
    this.active = null;
  }
  pickVoice(gender) {
    const pt = this.voices.filter((v) => /^pt/i.test(v.lang));
    const pool = pt.length ? pt : this.voices;
    if (!pool.length) return null;
    const female = /female|mulher|luciana|francisca|maria|joana|vitória|helena|fernanda|google português/i;
    const male = /male|daniel|antônio|antonio|ricardo|felipe|duarte|thiago|paulo/i;
    const pref = pool.find((v) => (gender === 'f' ? female : male).test(v.name));
    return pref || pool[0];
  }
  // speak text with a talking human; returns a promise resolved when finished
  say(text, human, { pitch = 1, rate = 1, gender = 'm' } = {}) {
    this.stop();
    const lower = text.toLowerCase();
    const cps = 13.5 * rate; // fallback characters per second
    const st = { text: lower, human, t: 0, idx: 0, done: false, speaking: false, cps, ended: false, openS: 0, wideS: 0.5 };
    this.active = st;
    const estimated = text.length / cps + 0.6;
    return new Promise((resolve) => {
      const finish = () => { if (st.ended) return; st.ended = true; st.done = true; if (human) human.setMouth(0, 0.5); resolve(); };
      st.finish = finish;
      const useTTS = this.enabled && this.synth && this.voices.length > 0;
      if (useTTS) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR'; u.pitch = pitch; u.rate = rate; u.volume = 1;
        const v = this.pickVoice(gender); if (v) u.voice = v;
        u.onstart = () => { st.speaking = true; st.t = 0; };
        u.onboundary = (e) => { if (typeof e.charIndex === 'number') { st.idx = e.charIndex; st.t = e.charIndex / cps; } };
        u.onend = finish; u.onerror = finish;
        this.synth.speak(u);
        // safety net if engine never fires events
        st.timeout = setTimeout(() => { if (!st.speaking) { st.speaking = true; st.fallback = true; } }, 900);
        st.hardStop = setTimeout(finish, (estimated + 6) * 1000);
      } else {
        st.speaking = true; st.fallback = true;
        st.hardStop = setTimeout(finish, estimated * 1000);
      }
    });
  }
  stop() {
    if (this.active) { clearTimeout(this.active.timeout); clearTimeout(this.active.hardStop); this.active.finish && this.active.finish(); }
    if (this.synth) this.synth.cancel();
    this.active = null;
  }
  update(dt) {
    const st = this.active;
    if (!st || st.done || !st.speaking || !st.human) return;
    st.t += dt;
    const pos = Math.min(st.text.length - 1, Math.floor(st.t * st.cps));
    if (st.fallback && pos >= st.text.length - 1 && !st.ttsRunning) { /* finish by timer */ }
    const ch = st.text[Math.max(0, pos)] || ' ';
    let [o, w] = VISEME(ch);
    // natural jitter + syllable rhythm
    o *= 0.75 + 0.25 * Math.sin(st.t * 23) ;
    const k = 1 - Math.exp(-dt * 28);
    st.openS += (o - st.openS) * k; st.wideS += (w - st.wideS) * k;
    st.human.setMouth(Math.max(0, st.openS), st.wideS);
  }
}
