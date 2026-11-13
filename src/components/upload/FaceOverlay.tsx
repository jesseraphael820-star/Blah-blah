import type { FaceBox } from "@/lib/types";

/** Desenha a caixa do rosto detectado e os pontos-chave sobre a foto. */
export function FaceOverlay({ faces }: { faces: FaceBox[] }) {
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="face-overlay">
      {faces.map((f, i) => (
        <div
          key={i}
          className="absolute rounded-2xl border-2 border-brand-400/90 shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_0_30px_rgba(139,92,246,0.55)] animate-fade-up"
          style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` }}
        >
          <span className="absolute -top-7 left-0 rounded-md bg-brand-600/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-white">
            ROSTO {faces.length > 1 ? i + 1 : ""} · {Math.round(f.score * 100)}%
          </span>
          {[
            "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
            "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
            "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
            "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
          ].map((c) => (
            <span key={c} className={`absolute h-4 w-4 border-white ${c}`} />
          ))}
        </div>
      ))}
      {faces.flatMap((f, i) =>
        f.keypoints.map((k, j) => (
          <span
            key={`${i}-${j}`}
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300 shadow-[0_0_8px_rgba(232,121,249,0.9)]"
            style={{ left: `${k.x * 100}%`, top: `${k.y * 100}%` }}
          />
        )),
      )}
    </div>
  );
}
