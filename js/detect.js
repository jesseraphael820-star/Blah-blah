// Identificação de dispositivo, sistema e navegador a partir das APIs do navegador.
// Usa User-Agent Client Hints quando disponível (Chromium) e o User-Agent como alternativa.

const VENDORS = [
  [/^(SM-|GT-|SCH-|SGH-|Galaxy)/i, 'Samsung'],
  [/^Pixel/i, 'Google'],
  [/^(moto|XT\d{4})/i, 'Motorola'],
  [/^(Redmi|POCO|Mi |MI |M\d{4}|2\d{3}[A-Z0-9]{3,})/, 'Xiaomi'],
  [/^(CPH|OPPO)/i, 'OPPO'],
  [/^RMX/i, 'realme'],
  [/^(vivo|V\d{4}[A-Z]?$)/i, 'vivo'],
  [/^(ONEPLUS|OnePlus|KB2|LE2|NE2|PJ)/, 'OnePlus'],
  [/^(LM-|LG)/i, 'LG'],
  [/^(Nokia|TA-\d)/i, 'Nokia'],
  [/^(HUAWEI|[A-Z]{3}-(L|AL|TL|LX)\d)/, 'Huawei'],
  [/^(ASUS|ASUS_)/i, 'ASUS'],
  [/^Infinix/i, 'Infinix'],
  [/^TECNO/i, 'TECNO'],
  [/^(Lenovo|TB-)/i, 'Lenovo'],
  [/^(SO-|XQ-|Xperia)/i, 'Sony'],
];

function vendorFor(model) {
  if (!model) return null;
  for (const [re, name] of VENDORS) if (re.test(model)) return name;
  return null;
}

function parseIOSVersion(ua) {
  const os = (ua.match(/OS (\d+(?:_\d+){0,2})/) || [])[1];
  const osVer = os ? os.replace(/_/g, '.') : '';
  // A partir do iOS 26 o Safari congela a versão do sistema no UA; a versão do Safari acompanha o iOS.
  const saf = (ua.match(/Version\/(\d+(?:\.\d+)?)/) || [])[1];
  if (saf && (!osVer || parseFloat(saf) > parseFloat(osVer))) return saf;
  return osVer;
}

export async function collectEnv() {
  const ua = navigator.userAgent || '';
  let hints = null;
  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      hints = await navigator.userAgentData.getHighEntropyValues([
        'model', 'platform', 'platformVersion', 'architecture', 'bitness', 'fullVersionList', 'mobile',
      ]);
    } catch { hints = null; }
  }
  const touchPoints = navigator.maxTouchPoints || 0;
  const isIPadOS = /Macintosh/.test(ua) && touchPoints > 1;

  // ---------- Sistema operacional ----------
  const os = { name: '', version: '', note: '' };
  const plat = hints?.platform || '';
  if (/Android/i.test(ua) || plat === 'Android') {
    os.name = 'Android';
    os.version = hints?.platformVersion || (ua.match(/Android\s([\d.]+)/) || [])[1] || '';
  } else if (/iPhone|iPod/.test(ua)) {
    os.name = 'iOS';
    os.version = parseIOSVersion(ua);
  } else if (/iPad/.test(ua) || isIPadOS) {
    os.name = 'iPadOS';
    os.version = parseIOSVersion(ua);
  } else if (/CrOS/.test(ua) || plat === 'Chrome OS') {
    os.name = 'ChromeOS';
    os.version = hints?.platformVersion || '';
  } else if (/Windows/.test(ua) || plat === 'Windows') {
    os.name = 'Windows';
    if (hints?.platformVersion) {
      const major = parseInt(hints.platformVersion, 10);
      os.version = major >= 13 ? '11' : major > 0 ? '10' : '8.1 ou anterior';
    } else {
      const nt = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
      os.version = { '10.0': '10 ou 11', '6.3': '8.1', '6.2': '8', '6.1': '7' }[nt] || '';
      if (nt === '10.0') os.note = 'O navegador não diferencia Windows 10 e 11.';
    }
  } else if (/Mac OS X|Macintosh/.test(ua) || plat === 'macOS') {
    os.name = 'macOS';
    if (hints?.platformVersion) os.version = hints.platformVersion;
    else {
      const v = ((ua.match(/Mac OS X (\d+[_.\d]*)/) || [])[1] || '').replace(/_/g, '.');
      os.version = v === '10.15.7' ? '10.15 ou superior' : v;
      if (v === '10.15.7') os.note = 'O navegador informa uma versão congelada do macOS.';
    }
  } else if (/HarmonyOS/i.test(ua)) {
    os.name = 'HarmonyOS';
  } else if (/Linux/.test(ua) || plat === 'Linux') {
    os.name = 'Linux';
  }

  // ---------- Navegador ----------
  const browser = { name: '', version: '', engine: '' };
  const rules = [
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Microsoft Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Opera', /(?:OPR|OPiOS|OPT)\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Google Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of rules) {
    const m = ua.match(re);
    if (m) { browser.name = name; browser.version = m[1]; break; }
  }
  if (hints?.fullVersionList?.length && browser.name) {
    const brand = hints.fullVersionList.find((b) => b.brand === browser.name || b.brand.includes(browser.name.split(' ').pop()));
    if (brand) browser.version = brand.version;
  }
  if (os.name === 'iOS' || os.name === 'iPadOS') browser.engine = 'WebKit';
  else if (browser.name === 'Firefox') browser.engine = 'Gecko';
  else if (browser.name === 'Safari') browser.engine = 'WebKit';
  else if (browser.name) browser.engine = 'Blink';

  // ---------- Dispositivo ----------
  let type = 'desktop';
  if (/iPad/.test(ua) || isIPadOS || (/Android/.test(ua) && !/Mobile/.test(ua)) || /Tablet/i.test(ua)) type = 'tablet';
  else if (hints?.mobile || /Mobi|iPhone|iPod|Android/.test(ua)) type = 'phone';

  let model = hints?.model || '';
  if (!model && os.name === 'Android') {
    const m = ua.match(/Android[^;)]*;\s*(?:wv;\s*)?([^;)]+?)(?:\s+Build\/[^;)]*)?[;)]/);
    if (m) model = m[1].trim();
  }
  if (/^(K|Mobile|wv|Linux)$/i.test(model)) model = ''; // UA reduzido não expõe o modelo
  let vendor = vendorFor(model);
  let generic = '';
  if (os.name === 'iOS') { vendor = 'Apple'; generic = /iPod/.test(ua) ? 'iPod touch' : 'iPhone'; }
  if (os.name === 'iPadOS') { vendor = 'Apple'; generic = 'iPad'; }
  if (os.name === 'macOS' && !isIPadOS) { vendor = 'Apple'; generic = 'Mac'; }

  return {
    ua,
    hints,
    touchPoints,
    os,
    browser,
    device: {
      type,
      typeLabel: { phone: 'Smartphone', tablet: 'Tablet', desktop: 'Computador' }[type],
      model,
      vendor,
      generic,
      arch: hints?.architecture ? `${hints.architecture}${hints.bitness ? ` ${hints.bitness} bits` : ''}` : '',
    },
    secure: window.isSecureContext,
  };
}

export function deviceLabel(env) {
  const d = env.device;
  if (d.model) return [d.vendor, d.model].filter(Boolean).join(' ');
  if (d.generic) return d.generic;
  return d.typeLabel;
}
