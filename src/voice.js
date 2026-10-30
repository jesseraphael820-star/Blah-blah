import { SPEAKERS } from './i18n.js';

// dublagem via Web Speech (pt-BR / en-US) + legendas
export class Voice {
  constructor(settings, hud) {
    this.s = settings;
    this.hud = hud;
    this.voices = [];
    this.ok = 'speechSynthesis' in window;
    this.cur = null;
    if (this.ok) {
      const load = () => (this.voices = speechSynthesis.getVoices());
      load();
      speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  pick(lang, g, seed) {
    const code = lang === 'pt' ? 'pt' : 'en';
    let list = this.voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(code));
    if (lang === 'pt') {
      const br = list.filter((v) => /br/i.test(v.lang));
      if (br.length) list = br;
    } else {
      const us = list.filter((v) => /us/i.test(v.lang));
      if (us.length) list = us;
    }
    if (!list.length) return null;
    const fem = /female|mulher|luciana|francisca|maria|vit[oó]ria|zira|samantha|susan|karen|helena|joana|fernanda|aria|jenny|ana/i;
    let gl = list.filter((v) => (g === 'f' ? fem.test(v.name) : !fem.test(v.name)));
    if (!gl.length) gl = list;
    return gl[seed % gl.length];
  }

  say(spk, line, opts = {}) {
    const sp = SPEAKERS[spk] || SPEAKERS.pedM;
    const sub = line[this.s.get('lang')] || line.pt;
    const spoken = line[this.s.get('dub')] || line.pt;
    const est = (1.0 + spoken.length * 0.062) / sp.rate;
    if (opts.ambient && this.cur) return Promise.resolve();
    if (this.s.get('subs') && !opts.noSub) this.hud.subtitle(sp.name, sub, est + 0.4);
    if (opts.char) opts.char.talk = est;
    const vol = this.s.get('volume') * this.s.get('voiceVol') * (opts.vol ?? 1);
    return new Promise((resolve) => {
      let done = false;
      const fin = () => { if (done) return; done = true; if (this.cur === token) this.cur = null; clearTimeout(tm); resolve(); };
      const token = { fin };
      if (!opts.ambient) this.cur = token;
      const tm = setTimeout(fin, (this.ok && vol > 0 ? est * 1.9 + 1.5 : est) * 1000);
      if (!this.ok || vol <= 0) return;
      try {
        if (!opts.ambient) speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(spoken);
        const lang = this.s.get('dub');
        u.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
        const v = this.pick(lang, sp.g, sp.seed + (opts.seed || 0));
        if (v) u.voice = v;
        u.pitch = (opts.pitch ?? sp.pitch);
        u.rate = sp.rate;
        u.volume = Math.min(1, vol);
        u.onend = u.onerror = () => setTimeout(fin, 120);
        speechSynthesis.speak(u);
      } catch (e) { /* sem voz: só legenda */ }
    });
  }

  skip() {
    if (this.ok) speechSynthesis.cancel();
    if (this.cur) this.cur.fin();
    this.hud.subtitle('', '', 0);
  }
}
