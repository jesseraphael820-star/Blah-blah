/** Ilustração vetorial de uma Gua Sha de aço inoxidável (formato "coração"/asa). */
export function GuaShaTool({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 200" className={className} role="img" aria-label="Ilustração de uma Gua Sha de aço inoxidável">
      <defs>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f4f8" />
          <stop offset="0.25" stopColor="#9a9aa8" />
          <stop offset="0.45" stopColor="#e8e8f0" />
          <stop offset="0.7" stopColor="#6e6e7c" />
          <stop offset="1" stopColor="#d6d6e0" />
        </linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <ellipse cx="130" cy="110" rx="100" ry="60" fill="#8b5cf6" opacity="0.35" filter="url(#glow)" />
      <path
        d="M40 70 C40 30, 95 25, 115 55 C122 66, 138 66, 145 55 C165 25, 220 30, 220 70 C220 120, 170 165, 130 170 C90 165, 40 120, 40 70 Z"
        fill="url(#steel)"
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <path d="M58 72 C60 48, 92 44, 106 62" fill="none" stroke="url(#shine)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="130" cy="120" r="7" fill="#1f1d2b" opacity="0.18" />
      <rect x="0" y="0" width="60" height="200" fill="url(#shine)" opacity="0.25" transform="skewX(-20)">
        <animate attributeName="x" from="-80" to="320" dur="3.5s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}
