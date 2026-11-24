import { upload } from "@vercel/blob/client";
import { uploadMode } from "@/lib/captures.functions";
import { inspectCapture, readOriginal } from "@/lib/prepare-capture";

export type StoredPanorama = {
  mime: string;
  width: number;
  height: number;
  bytes: number;
  wide: boolean;
  thumb: string;
  image?: string;
  imagePath?: string;
  thumbPath?: string;
};

function extension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function storePanorama(file: File, onProgress?: (percent: number) => void): Promise<StoredPanorama> {
  const inspected = await inspectCapture(file);
  const mode = await uploadMode();
  if (!mode.direct) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("Unlock the console so this original can upload at full size. The limit is 100 MB.");
    }
    const image = await readOriginal(file);
    return { ...inspected, image };
  }

  const id = crypto.randomUUID();
  const full = await upload(`captures/${id}/full.${extension(file)}`, file, {
    access: "private",
    handleUploadUrl: "/api/blob",
    contentType: file.type || "image/jpeg",
    multipart: file.size > 4 * 1024 * 1024,
    onUploadProgress: (event) => onProgress?.(Math.round(event.percentage)),
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("token")) {
      throw new Error("The original file did not upload. Unlock the console and try again. It was not resized.");
    }
    throw error instanceof Error ? error : new Error("The original file did not upload.");
  });

  const thumbBytes = Uint8Array.from(atob(inspected.thumb), (char) => char.charCodeAt(0));
  const thumb = await upload(`captures/${id}/thumb.jpg`, new Blob([thumbBytes], { type: "image/jpeg" }), {
    access: "private",
    handleUploadUrl: "/api/blob",
    contentType: "image/jpeg",
  });

  return {
    ...inspected,
    imagePath: full.pathname,
    thumbPath: thumb.pathname,
  };
}
