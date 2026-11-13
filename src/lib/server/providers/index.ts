import "server-only";
import type { ProviderConfig } from "../config";
import { editWithOpenAI } from "./openai";
import { editWithReplicate } from "./replicate";
import type { EditInput, EditOutput } from "./types";

export { ProviderError } from "./types";

export function runEdit(cfg: ProviderConfig, input: EditInput): Promise<EditOutput> {
  return cfg.id === "openai" ? editWithOpenAI(cfg, input) : editWithReplicate(cfg, input);
}
