"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditRequestError, fetchStatus, requestEdit } from "@/lib/api-client";
import { detectFaces, faceCropRect } from "@/lib/face-detection";
import { cropDataUrl, fitToSize, makeThumbnail, prepareImageFile, resizeDataUrl } from "@/lib/image";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, storage, uid } from "@/lib/storage";
import { describeEdit, getTool } from "@/lib/tools";
import type { ApiStatus, EditError, EditRequestMeta, HistoryItem, PhotoRecord, Settings, Version } from "@/lib/types";

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  text: string;
}

export interface Job {
  label: string;
  startedAt: number;
}

interface SessionMeta {
  photoId: string;
  historyIds: string[];
  cursor: number;
}

interface StudioState {
  hydrated: boolean;
  photo: PhotoRecord | null;
  photoBusy: boolean;
  versions: Version[];
  cursor: number;
  current: Version | null;
  original: Version | null;
  history: HistoryItem[];
  settings: Settings;
  apiStatus: ApiStatus | null;
  job: Job | null;
  error: EditError | null;
  consentPending: boolean;
  toasts: Toast[];
}

interface StudioActions {
  uploadPhoto: (file: File) => Promise<boolean>;
  removePhoto: () => Promise<void>;
  cropToFace: () => Promise<void>;
  applyEdit: (meta: EditRequestMeta) => Promise<void>;
  cancelEdit: () => void;
  undo: () => void;
  redo: () => void;
  restoreOriginal: () => void;
  useHistoryItem: (id: string) => void;
  toggleFavorite: (id: string) => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  wipeAll: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  giveConsent: (accept: boolean) => void;
  dismissError: () => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  refreshStatus: () => Promise<void>;
}

const StudioContext = createContext<(StudioState & StudioActions) | null>(null);

const ORIGINAL_ID = "original";

export function StudioProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [photo, setPhoto] = useState<PhotoRecord | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<EditError | null>(null);
  const [consentPending, setConsentPending] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const pendingEditRef = useRef<EditRequestMeta | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const versionsRef = useRef(versions);
  versionsRef.current = versions;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  /** Atualiza pilha de versões + cursor juntos (refs evitam estado obsoleto). */
  const commitStack = useCallback((next: Version[], nextCursor: number) => {
    versionsRef.current = next;
    cursorRef.current = nextCursor;
    setVersions(next);
    setCursor(nextCursor);
  }, []);
  const pushVersion = useCallback(
    (v: Version) => {
      const next = [...versionsRef.current.slice(0, cursorRef.current + 1), v];
      commitStack(next, next.length - 1);
    },
    [commitStack],
  );

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refreshStatus = useCallback(async () => {
    try {
      setApiStatus(await fetchStatus());
    } catch {
      setApiStatus(null);
    }
  }, []);

  // ---- Hidratação a partir do IndexedDB ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = loadSettings();
      setSettings(s);
      void refreshStatus();
      try {
        const [p, h, session] = await Promise.all([
          storage.getPhoto(),
          storage.getHistory(),
          storage.getMeta<SessionMeta>("session"),
        ]);
        if (cancelled) return;
        setHistory(h);
        if (p) {
          setPhoto(p);
          const base: Version = { id: ORIGINAL_ID, historyId: null, dataUrl: p.dataUrl, label: "Original" };
          const restored: Version[] = [base];
          if (session?.photoId === p.id) {
            for (const hid of session.historyIds) {
              const item = h.find((x) => x.id === hid);
              if (item) restored.push({ id: uid(), historyId: item.id, dataUrl: item.dataUrl, label: item.label });
            }
          }
          setVersions(restored);
          setCursor(Math.min(session?.photoId === p.id ? session.cursor : 0, restored.length - 1));
        }
      } catch (err) {
        console.warn("Falha ao carregar dados locais", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  // ---- Persistência da sessão (pilha de versões) ----
  useEffect(() => {
    if (!hydrated || !photo || !settings.saveHistory) return;
    const meta: SessionMeta = {
      photoId: photo.id,
      historyIds: versions.filter((v) => v.historyId).map((v) => v.historyId!),
      cursor,
    };
    storage.setMeta("session", meta).catch(() => {});
  }, [hydrated, photo, versions, cursor, settings.saveHistory]);

  const resetStack = useCallback(
    (p: PhotoRecord | null) => {
      commitStack(p ? [{ id: ORIGINAL_ID, historyId: null, dataUrl: p.dataUrl, label: "Original" }] : [], 0);
    },
    [commitStack],
  );

  const uploadPhoto = useCallback(
    async (file: File) => {
      setPhotoBusy(true);
      try {
        const prepared = await prepareImageFile(file);
        const face = await detectFaces(prepared.dataUrl);
        const record: PhotoRecord = {
          id: uid(),
          dataUrl: prepared.dataUrl,
          width: prepared.width,
          height: prepared.height,
          createdAt: Date.now(),
          face,
          fileName: file.name,
        };
        setPhoto(record);
        resetStack(record);
        if (settingsRef.current.saveHistory) await storage.savePhoto(record).catch(() => {});
        if (face.status === "found") toast("Rosto detectado com sucesso.", "success");
        else if (face.status === "multiple") toast("Mais de um rosto detectado. A IA usará a foto inteira.", "info");
        else if (face.status === "none") toast("Nenhum rosto detectado. Use uma foto frontal e bem iluminada.", "error");
        return true;
      } catch (err) {
        toast((err as Error).message || "Não foi possível carregar a foto.", "error");
        return false;
      } finally {
        setPhotoBusy(false);
      }
    },
    [resetStack, toast],
  );

  const removePhoto = useCallback(async () => {
    abortRef.current?.abort();
    setPhoto(null);
    resetStack(null);
    await storage.deletePhoto().catch(() => {});
    await storage.setMeta("session", null).catch(() => {});
    toast("Foto removida deste dispositivo.", "success");
  }, [resetStack, toast]);

  const cropToFace = useCallback(async () => {
    if (!photo || photo.face.faces.length === 0) return;
    setPhotoBusy(true);
    try {
      const rect = faceCropRect(photo.face.faces[0], photo.width, photo.height);
      const cropped = await cropDataUrl(photo.dataUrl, rect);
      const face = await detectFaces(cropped.dataUrl);
      const record: PhotoRecord = { ...photo, id: uid(), ...cropped, face, createdAt: Date.now() };
      setPhoto(record);
      resetStack(record);
      if (settingsRef.current.saveHistory) await storage.savePhoto(record).catch(() => {});
      toast("Foto enquadrada no rosto.", "success");
    } finally {
      setPhotoBusy(false);
    }
  }, [photo, resetStack, toast]);

  const runEdit = useCallback(
    async (meta: EditRequestMeta) => {
      const vs = versionsRef.current;
      if (!photo || vs.length === 0) return;
      const tool = getTool(meta.toolId);
      if (!tool) return;
      const source = settingsRef.current.applyOn === "original" ? vs[0] : vs[cursorRef.current];
      const label = describeEdit(meta.toolId, meta.variantId, meta.intensity);
      const controller = new AbortController();
      abortRef.current = controller;
      setJob({ label, startedAt: Date.now() });
      try {
        const input = await resizeDataUrl(source.dataUrl, 1024, 0.9);
        const result = await requestEdit({ ...meta, image: input.dataUrl, width: input.width, height: input.height }, controller.signal);
        const fitted = await fitToSize(result.image, photo.width, photo.height);
        const item: HistoryItem = {
          ...meta,
          id: uid(),
          photoId: photo.id,
          label,
          categoryId: tool.categoryId,
          dataUrl: fitted,
          thumbUrl: await makeThumbnail(fitted),
          sourceId: source.historyId,
          provider: result.provider,
          createdAt: Date.now(),
          favorite: false,
        };
        setHistory((h) => [item, ...h]);
        if (settingsRef.current.saveHistory) await storage.putHistory(item).catch(() => {});
        pushVersion({ id: uid(), historyId: item.id, dataUrl: fitted, label });
        toast(`Edição concluída: ${label}`, "success");
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          toast("Edição cancelada.", "info");
        } else if (err instanceof EditRequestError) {
          setError(err.info);
          if (err.info.code === "NOT_CONFIGURED") void refreshStatus();
        } else {
          setError({ code: "PROVIDER_ERROR", message: (err as Error).message || "Erro inesperado." });
        }
      } finally {
        abortRef.current = null;
        setJob(null);
      }
    },
    [photo, pushVersion, toast, refreshStatus],
  );

  const applyEdit = useCallback(
    async (meta: EditRequestMeta) => {
      if (job) return;
      if (apiStatus && !apiStatus.configured) {
        // Nada é enviado: a IA não está configurada.
        setError({
          code: "NOT_CONFIGURED",
          message:
            "A integração de IA ainda não foi configurada. Defina OPENAI_API_KEY ou REPLICATE_API_TOKEN nas variáveis de ambiente do servidor.",
        });
        return;
      }
      if (!settingsRef.current.aiConsent) {
        pendingEditRef.current = meta;
        setConsentPending(true);
        return;
      }
      await runEdit(meta);
    },
    [job, apiStatus, runEdit],
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const prev = settingsRef.current;
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      setSettings(next);
      saveSettings(next);
      if (patch.saveHistory === false && prev.saveHistory) {
        // Usuário desativou o armazenamento local: apaga o que estava salvo.
        void storage.deletePhoto().catch(() => {});
        void storage.clearHistory().catch(() => {});
        void storage.setMeta("session", null).catch(() => {});
      }
      if (patch.saveHistory === true && !prev.saveHistory) {
        if (photo) void storage.savePhoto(photo).catch(() => {});
        history.forEach((h) => void storage.putHistory(h).catch(() => {}));
      }
    },
    [photo, history],
  );

  const giveConsent = useCallback(
    (accept: boolean) => {
      setConsentPending(false);
      const pending = pendingEditRef.current;
      pendingEditRef.current = null;
      if (!accept) return;
      const next = { ...settingsRef.current, aiConsent: true };
      settingsRef.current = next;
      setSettings(next);
      saveSettings(next);
      if (pending) void runEdit(pending);
    },
    [runEdit],
  );

  const cancelEdit = useCallback(() => abortRef.current?.abort(), []);

  const undo = useCallback(() => commitStack(versionsRef.current, Math.max(0, cursorRef.current - 1)), [commitStack]);
  const redo = useCallback(
    () => commitStack(versionsRef.current, Math.min(versionsRef.current.length - 1, cursorRef.current + 1)),
    [commitStack],
  );
  const restoreOriginal = useCallback(() => commitStack(versionsRef.current, 0), [commitStack]);

  const useHistoryItem = useCallback(
    (id: string) => {
      const item = history.find((h) => h.id === id);
      if (!item || !photo || item.photoId !== photo.id) return;
      pushVersion({ id: uid(), historyId: item.id, dataUrl: item.dataUrl, label: item.label });
    },
    [history, photo, pushVersion],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const item = history.find((x) => x.id === id);
      if (!item) return;
      const updated = { ...item, favorite: !item.favorite };
      setHistory((h) => h.map((x) => (x.id === id ? updated : x)));
      if (settingsRef.current.saveHistory) await storage.putHistory(updated).catch(() => {});
      toast(updated.favorite ? "Adicionado aos favoritos." : "Removido dos favoritos.", "success");
    },
    [history, toast],
  );

  const deleteHistoryItem = useCallback(
    async (id: string) => {
      setHistory((h) => h.filter((x) => x.id !== id));
      const vs = versionsRef.current;
      if (vs.some((v) => v.historyId === id)) {
        const next = vs.filter((v) => v.historyId !== id);
        // Mantém o cursor na mesma versão quando possível.
        const currentId = vs[cursorRef.current]?.id;
        const keep = next.findIndex((v) => v.id === currentId);
        commitStack(next, keep >= 0 ? keep : Math.max(0, Math.min(cursorRef.current - 1, next.length - 1)));
      }
      await storage.deleteHistory(id).catch(() => {});
      toast("Edição excluída.", "success");
    },
    [toast, commitStack],
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    commitStack(versionsRef.current.slice(0, 1), 0);
    await storage.clearHistory().catch(() => {});
    toast("Histórico apagado.", "success");
  }, [toast, commitStack]);

  const wipeAll = useCallback(async () => {
    abortRef.current?.abort();
    await storage.wipeAll().catch(() => {});
    setPhoto(null);
    setHistory([]);
    resetStack(null);
    setSettings(DEFAULT_SETTINGS);
    settingsRef.current = DEFAULT_SETTINGS;
    toast("Todos os seus dados foram apagados deste dispositivo.", "success");
  }, [resetStack, toast]);

  const value = useMemo(
    () => ({
      hydrated,
      photo,
      photoBusy,
      versions,
      cursor,
      current: versions[cursor] ?? null,
      original: versions[0] ?? null,
      history,
      settings,
      apiStatus,
      job,
      error,
      consentPending,
      toasts,
      uploadPhoto,
      removePhoto,
      cropToFace,
      applyEdit,
      cancelEdit,
      undo,
      redo,
      restoreOriginal,
      useHistoryItem,
      toggleFavorite,
      deleteHistoryItem,
      clearHistory,
      wipeAll,
      updateSettings,
      giveConsent,
      dismissError: () => setError(null),
      toast,
      dismissToast,
      refreshStatus,
    }),
    [
      hydrated,
      photo,
      photoBusy,
      versions,
      cursor,
      history,
      settings,
      apiStatus,
      job,
      error,
      consentPending,
      toasts,
      uploadPhoto,
      removePhoto,
      cropToFace,
      applyEdit,
      cancelEdit,
      undo,
      redo,
      restoreOriginal,
      useHistoryItem,
      toggleFavorite,
      deleteHistoryItem,
      clearHistory,
      wipeAll,
      updateSettings,
      giveConsent,
      toast,
      dismissToast,
      refreshStatus,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio deve ser usado dentro de <StudioProvider>");
  return ctx;
}
