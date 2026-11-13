"use client";

import { useState } from "react";
import { Columns2, Download, Heart, Images, Redo2, RotateCcw, SplitSquareHorizontal, Undo2 } from "lucide-react";
import { BeforeAfter, type CompareMode } from "@/components/compare/BeforeAfter";
import { ProcessingOverlay } from "@/components/compare/ProcessingOverlay";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { composeSideBySide, downloadDataUrl, slugify } from "@/lib/image";
import { useStudio } from "@/store/studio";

export function Editor() {
  const { photo, versions, cursor, current, original, job, cancelEdit, undo, redo, restoreOriginal, history, toggleFavorite, toast } =
    useStudio();
  const [mode, setMode] = useState<CompareMode>("slider");
  const [against, setAgainst] = useState<"original" | "previous">("original");

  if (!photo || !current || !original) return null;

  const before = against === "previous" && cursor > 0 ? versions[cursor - 1].dataUrl : original.dataUrl;
  const beforeLabel = against === "previous" && cursor > 0 ? "ANTERIOR" : "ANTES";
  const aspect = photo.width / photo.height;
  const currentItem = current.historyId ? history.find((h) => h.id === current.historyId) : undefined;
  const edited = cursor > 0;

  const download = async (kind: "edit" | "compare") => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = slugify(current.label || "original");
    if (kind === "edit") downloadDataUrl(current.dataUrl, `looksmaxxing-ai-${name}-${stamp}.jpg`);
    else downloadDataUrl(await composeSideBySide(before, current.dataUrl), `looksmaxxing-ai-antes-depois-${name}-${stamp}.jpg`);
    toast("Imagem salva no seu dispositivo.", "success");
  };

  return (
    <div className="glass rounded-3xl p-3 sm:p-4" data-testid="editor">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          ariaLabel="Modo de comparação"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "slider", label: <span className="flex items-center gap-1.5"><SplitSquareHorizontal className="h-3.5 w-3.5" />Deslizante</span> },
            { value: "side", label: <span className="flex items-center gap-1.5" data-testid="mode-side"><Columns2 className="h-3.5 w-3.5" />Lado a lado</span> },
          ]}
        />
        {cursor > 1 && (
          <Segmented
            ariaLabel="Comparar com"
            size="sm"
            value={against}
            onChange={setAgainst}
            options={[
              { value: "original", label: "vs. original" },
              { value: "previous", label: "vs. anterior" },
            ]}
          />
        )}
      </div>

      <div className="relative mx-auto" style={{ maxWidth: mode === "side" ? undefined : `min(100%, calc((100dvh - 260px) * ${aspect}))` }}>
        <BeforeAfter
          key={mode}
          before={before}
          after={current.dataUrl}
          aspect={aspect}
          mode={mode}
          beforeLabel={beforeLabel}
        >
          {job && <ProcessingOverlay job={job} onCancel={cancelEdit} />}
        </BeforeAfter>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={undo} disabled={cursor === 0 || !!job} data-testid="undo" title="Desfazer">
            <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">Desfazer</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={redo} disabled={cursor >= versions.length - 1 || !!job} data-testid="redo" title="Refazer">
            <Redo2 className="h-4 w-4" /> <span className="hidden sm:inline">Refazer</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={restoreOriginal} disabled={cursor === 0 || !!job} data-testid="restore" title="Restaurar original">
            <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Restaurar original</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {currentItem && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void toggleFavorite(currentItem.id)}
              data-testid="favorite-current"
              aria-pressed={currentItem.favorite}
              title="Favoritar"
            >
              <Heart className={cn("h-4 w-4", currentItem.favorite && "fill-fuchsia-400 text-fuchsia-400")} />
            </Button>
          )}
          <Button size="sm" onClick={() => void download("compare")} disabled={!edited} title="Baixar antes e depois" data-testid="download-compare">
            <Images className="h-4 w-4" /> <span className="hidden sm:inline">Antes/depois</span>
          </Button>
          <Button size="sm" variant="primary" onClick={() => void download("edit")} disabled={!edited} data-testid="download">
            <Download className="h-4 w-4" /> Salvar imagem
          </Button>
        </div>
      </div>

      {versions.length > 1 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">Versões desta sessão</p>
          <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1" data-testid="version-strip">
            {versions.map((v, i) => (
              <div
                key={v.id}
                className={cn(
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                  i === cursor ? "border-brand-400 ring-glow" : "border-transparent opacity-60",
                )}
                title={v.label}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.dataUrl} alt={v.label} className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[9px] text-white">{i === 0 ? "Original" : v.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
