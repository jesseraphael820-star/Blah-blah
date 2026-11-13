import type { EditErrorCode } from "@/lib/types";
import type { DecodedImage } from "../image-validation";

export interface EditInput {
  image: DecodedImage;
  prompt: string;
  width: number;
  height: number;
  signal: AbortSignal;
}

export interface EditOutput {
  /** Imagem resultante (bytes). */
  buffer: Buffer;
}

export class ProviderError extends Error {
  constructor(
    public code: EditErrorCode,
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
