"use client";

import { useRef, useState } from "react";
import { Camera, Crop, ImagePlus, LoaderCircle, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { useStudio } from "@/store/studio";
import { FaceOverlay } from "./FaceOverlay";
import { FaceStatusBadge } from "./FaceStatusBadge";

interface Props {
  className?: string;
  /** Renderizado abaixo da prévia quando há foto (ex.: botão "Abrir estúdio"). */
  footer?: React.ReactNode;
  compact?: boolean;
}

export function PhotoUploader({ className, footer, compact }: Props) {
  const { photo, photoBusy, uploadPhoto, removePhoto, cropToFace, hydrated } = useStudio();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (file) await uploadPhoto(file);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const inputs = (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        data-testid="file-input"
        aria-label="Escolher foto da galeria"
        onChange={(e) => onFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-label="Tirar foto com a câmera"
        onChange={(e) => onFiles(e.target.files)}
      />
    </>
  );

  if (!hydrated) {
    return (
      <div className={cn("glass grid min-h-[360px] place-items-center rounded-3xl", className)}>
        <LoaderCircle className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!photo) {
    return (
      <div
        className={cn(
          "glass group relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 text-center transition-all",
          compact ? "min-h-[320px] py-10" : "min-h-[420px] py-14 sm:min-h-[460px]",
          over ? "border-brand-400 bg-brand-500/10 ring-glow" : "border-white/12 hover:border-brand-400/50",
          className,
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void onFiles(e.dataTransfer.files);
        }}
        data-testid="dropzone"
      >
        {inputs}
        <div className="pointer-events-none absolute inset-0 grid-overlay opacity-50" />
        <div className="relative mb-6 grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 animate-spin-slow rounded-[2rem] border border-dashed border-brand-400/40" />
          <span className="brand-gradient grid h-16 w-16 place-items-center rounded-2xl shadow-[0_12px_40px_-8px_rgba(139,92,246,0.9)] transition-transform group-hover:scale-105">
            {photoBusy ? <LoaderCircle className="h-7 w-7 animate-spin text-white" /> : <Upload className="h-7 w-7 text-white" />}
          </span>
        </div>
        <h3 className="relative font-display text-xl font-semibold text-white sm:text-2xl">
          {photoBusy ? "Processando sua foto…" : "Envie uma foto do seu rosto"}
        </h3>
        <p className="relative mt-2 max-w-md text-sm text-zinc-400">
          Arraste e solte aqui ou escolha da galeria. Use uma foto frontal, bem iluminada, sem óculos escuros. JPG, PNG ou WEBP até 15 MB.
        </p>
        <div className="relative mt-7 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={() => galleryRef.current?.click()} loading={photoBusy} data-testid="upload-button">
            {!photoBusy && <ImagePlus className="h-5 w-5" />} Enviar minha foto
          </Button>
          <Button variant="secondary" size="lg" onClick={() => cameraRef.current?.click()} disabled={photoBusy} className="sm:hidden">
            <Camera className="h-5 w-5" /> Câmera
          </Button>
        </div>
        <p className="relative mt-6 flex items-center gap-1.5 text-xs text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> A foto fica no seu dispositivo. Metadados (como GPS) são removidos.
        </p>
      </div>
    );
  }

  const hasFace = photo.face.faces.length > 0;
  return (
    <div className={cn("glass rounded-3xl p-3 sm:p-4", className)} data-testid="photo-preview">
      {inputs}
      <div className="relative mx-auto overflow-hidden rounded-2xl bg-ink-900" style={{ aspectRatio: photo.width / photo.height, maxHeight: compact ? 520 : 560 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.dataUrl} alt="Sua foto" className="absolute inset-0 h-full w-full object-cover" />
        {hasFace && <FaceOverlay faces={photo.face.faces} />}
        {photoBusy && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-sm">
            <LoaderCircle className="h-8 w-8 animate-spin text-brand-300" />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <FaceStatusBadge face={photo.face} />
        <span className="text-xs text-zinc-500">
          {photo.width}×{photo.height}px
        </span>
      </div>
      {photo.face.status === "none" && (
        <p className="mt-2 px-1 text-xs text-amber-300/90">
          Não encontramos um rosto. Para melhores resultados, envie uma foto frontal com o rosto visível. Você ainda pode continuar.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => galleryRef.current?.click()} disabled={photoBusy} data-testid="change-photo">
          <RefreshCw className="h-3.5 w-3.5" /> Trocar foto
        </Button>
        {hasFace && (
          <Button size="sm" onClick={() => void cropToFace()} disabled={photoBusy} title="Recorta a foto ao redor do rosto">
            <Crop className="h-3.5 w-3.5" /> Enquadrar rosto
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => setConfirmRemove(true)} disabled={photoBusy} data-testid="remove-photo">
          <Trash2 className="h-3.5 w-3.5" /> Remover
        </Button>
      </div>
      {footer && <div className="mt-4">{footer}</div>}

      <Modal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remover foto?"
        icon={<Trash2 className="h-5 w-5 text-red-400" />}
        footer={
          <>
            <Button onClick={() => setConfirmRemove(false)}>Cancelar</Button>
            <Button
              variant="danger"
              data-testid="confirm-remove"
              onClick={() => {
                setConfirmRemove(false);
                void removePhoto();
              }}
            >
              Remover foto
            </Button>
          </>
        }
      >
        A foto será apagada deste dispositivo. As edições já geradas continuam no seu histórico até você excluí-las em Configurações.
      </Modal>
    </div>
  );
}
