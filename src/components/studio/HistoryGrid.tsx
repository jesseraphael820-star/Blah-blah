"use client";

import { useState } from "react";
import { Download, Heart, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { downloadDataUrl, slugify } from "@/lib/image";
import { getCategory } from "@/lib/tools";
import type { HistoryItem } from "@/lib/types";
import { useStudio } from "@/store/studio";

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function HistoryGrid({ items, empty, onUse }: { items: HistoryItem[]; empty: React.ReactNode; onUse?: () => void }) {
  const { photo, useHistoryItem, toggleFavorite, deleteHistoryItem, job } = useStudio();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (items.length === 0) return <div className="glass rounded-3xl p-10 text-center text-sm text-zinc-400">{empty}</div>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" data-testid="history-grid">
      {items.map((item) => {
        const usable = photo?.id === item.photoId;
        return (
          <div key={item.id} className="glass group overflow-hidden rounded-2xl animate-fade-up" data-testid="history-item">
            <div className="relative aspect-square overflow-hidden bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbUrl} alt={item.label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <button
                onClick={() => void toggleFavorite(item.id)}
                className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70"
                aria-label={item.favorite ? "Remover dos favoritos" : "Favoritar"}
                aria-pressed={item.favorite}
                data-testid="history-favorite"
              >
                <Heart className={cn("h-4 w-4", item.favorite ? "fill-fuchsia-400 text-fuchsia-400" : "text-white")} />
              </button>
              <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-200 backdrop-blur">
                {getCategory(item.categoryId).label}
              </span>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium text-white" title={item.label}>
                {item.label}
              </p>
              <p className="text-[11px] text-zinc-500">{fmt.format(item.createdAt)}</p>
              <div className="mt-2 flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={!usable || !!job}
                  title={usable ? "Abrir no comparador" : "Esta edição é de outra foto"}
                  onClick={() => {
                    useHistoryItem(item.id);
                    onUse?.();
                  }}
                  data-testid="history-use"
                >
                  <Play className="h-3.5 w-3.5" /> Usar
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Baixar"
                  onClick={() => downloadDataUrl(item.dataUrl, `looksmaxxing-ai-${slugify(item.label)}.jpg`)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {confirmId === item.id ? (
                  <Button size="sm" variant="danger" className="h-8 px-2" onClick={() => void deleteHistoryItem(item.id)} data-testid="history-delete-confirm">
                    Excluir?
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Excluir" onClick={() => setConfirmId(item.id)} data-testid="history-delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
