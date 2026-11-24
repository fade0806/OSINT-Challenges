import { del, get, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
import { isOwnedPath, orphanPathnames, pathsForCapture, stalePaths } from "@/lib/blob-purge";

export type RemoteCapture = {
  slug: string;
  name: string;
  category: string;
  brief: string;
  updatedAt: string;
  mime?: string;
  visible?: boolean;
  image?: string;
  thumb?: string;
  imagePath?: string;
  thumbPath?: string;
  bytes?: number;
  width?: number;
  height?: number;
};

export type RemoteBoard = {
  briefing: unknown;
  showSample?: boolean;
  captures: RemoteCapture[];
};

const STATE = "board/state.json";
let boardCache: { at: number; board: RemoteBoard } | null = null;

function remember(board: RemoteBoard) {
  boardCache = { at: Date.now(), board: structuredClone(board) };
}

async function readBoard(): Promise<RemoteBoard> {
  if (boardCache && Date.now() - boardCache.at < 8000) return structuredClone(boardCache.board);
  let result;
  try {
    result = await get(STATE, { access: "private", useCache: false });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Could not read the board. Nothing was changed.",
    );
  }
  if (!result) {
    const empty = { briefing: null, showSample: true, captures: [] };
    remember(empty);
    return structuredClone(empty);
  }
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not read the board. Nothing was changed.");
  }
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as RemoteBoard;
  const board = {
    briefing: parsed.briefing ?? null,
    showSample: parsed.showSample !== false,
    captures: Array.isArray(parsed.captures) ? parsed.captures : [],
  };
  remember(board);
  return structuredClone(board);
}

async function putBytes(path: string, base64: string, contentType: string) {
  const bytes = Buffer.from(base64, "base64");
  await put(path, bytes, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 31536000,
  });
  return path;
}

async function externalize(board: RemoteBoard) {
  for (const capture of board.captures) {
    if (capture.image && !capture.imagePath) {
      capture.imagePath = await putBytes(
        `captures/${capture.slug}/full`,
        capture.image,
        capture.mime || "image/jpeg",
      );
      delete capture.image;
    }
    if (capture.thumb && !capture.thumbPath && capture.thumb.length > 180_000) {
      capture.thumbPath = await putBytes(`captures/${capture.slug}/thumb`, capture.thumb, "image/jpeg");
      delete capture.thumb;
    }
  }
}

async function writeBoard(board: RemoteBoard) {
  boardCache = null;
  await externalize(board);
  await put(STATE, JSON.stringify(board), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
  remember(board);
}

async function forget(paths: Array<string | undefined | null>, keptChange: boolean) {
  const unique = [...new Set(paths.filter(isOwnedPath))];
  const failed: string[] = [];
  for (const path of unique) {
    try {
      await del(path);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("not found") || message.includes("does not exist") || message.includes("404")) continue;
      console.error(error);
      failed.push(path);
    }
  }
  if (failed.length) {
    throw new Error(
      keptChange
        ? "The new panorama is saved, but the previous file is still in storage. Remove the challenge if it must be wiped."
        : "The panorama is still in storage, so the challenge was kept. Try removing it again.",
    );
  }
}

async function sweep(board: RemoteBoard) {
  const keep = board.captures.flatMap((capture) => [capture.imagePath, capture.thumbPath]);
  const blobs: Array<{ pathname: string; uploadedAt: Date }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "captures/", cursor, limit: 1000 });
    blobs.push(...page.blobs.map((blob) => ({ pathname: blob.pathname, uploadedAt: blob.uploadedAt })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const stale = orphanPathnames(blobs, keep.filter(isOwnedPath), Date.now());
  if (stale.length) await forget(stale, true);
}

export async function remoteBoard() {
  return readBoard();
}

export async function remoteReadUrl(pathname: string) {
  const validUntil = Date.now() + 15 * 60 * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const signed = await presignUrl(token, {
    access: "private",
    operation: "get",
    pathname,
    validUntil,
  });
  return signed.presignedUrl;
}

export async function remoteSaveBriefing(briefing: unknown) {
  const board = await readBoard();
  board.briefing = briefing;
  await writeBoard(board);
}

export async function remotePublish(capture: RemoteCapture) {
  const board = await readBoard();
  const index = board.captures.findIndex((item) => item.slug === capture.slug);
  if (index >= 0) board.captures[index] = { ...board.captures[index], ...capture, visible: true };
  else board.captures.push({ ...capture, visible: capture.visible !== false });
  await writeBoard(board);
}

export async function remoteUpdate(capture: RemoteCapture, replaceImage: boolean) {
  const board = await readBoard();
  const index = board.captures.findIndex((item) => item.slug === capture.slug);
  if (index < 0) throw new Error("That capture is gone.");
  const current = board.captures[index];
  if (!replaceImage) {
    board.captures[index] = {
      ...current,
      name: capture.name,
      category: capture.category,
      brief: capture.brief,
      updatedAt: capture.updatedAt,
    };
    await writeBoard(board);
    return;
  }
  const next: RemoteCapture = {
    ...current,
    ...capture,
    visible: current.visible !== false,
  };
  if (capture.imagePath) {
    delete next.image;
    delete next.thumb;
  } else {
    next.imagePath = undefined;
    next.thumbPath = undefined;
  }
  board.captures[index] = next;
  await writeBoard(board);
  const nextPaths = capture.imagePath
    ? [capture.imagePath, capture.thumbPath]
    : [`captures/${capture.slug}/full`, `captures/${capture.slug}/thumb`];
  await forget(stalePaths(pathsForCapture(current), nextPaths), true);
  try {
    await sweep(board);
  } catch (error) {
    console.error(error);
  }
}

export async function remoteSetVisible(slug: string, visible: boolean) {
  const board = await readBoard();
  const capture = board.captures.find((item) => item.slug === slug);
  if (!capture) throw new Error("That capture is gone.");
  capture.visible = visible;
  capture.updatedAt = new Date().toISOString();
  await writeBoard(board);
}

export async function remoteSetSample(showSample: boolean) {
  const board = await readBoard();
  board.showSample = showSample;
  await writeBoard(board);
  return showSample;
}

export async function remoteRemove(slug: string) {
  const board = await readBoard();
  const gone = board.captures.find((item) => item.slug === slug);
  if (!gone) return;
  await forget(pathsForCapture(gone), false);
  board.captures = board.captures.filter((item) => item.slug !== slug);
  await writeBoard(board);
  try {
    await sweep(board);
  } catch (error) {
    console.error(error);
  }
}

export async function remoteImage(slug: string, full: boolean) {
  const board = await readBoard();
  const capture = board.captures.find((item) => item.slug === slug);
  if (!capture || capture.visible === false) return null;
  const path = full ? capture.imagePath : capture.thumbPath;
  const inline = full ? capture.image : capture.thumb;
  const mime = full ? capture.mime || "image/jpeg" : "image/jpeg";
  if (path) {
    const result = await get(path, { access: "private", useCache: true });
    if (result && result.statusCode === 200 && result.stream) {
      return { body: result.stream, mime: result.blob.contentType || mime };
    }
  }
  if (!inline) return null;
  return { body: Uint8Array.from(Buffer.from(inline, "base64")), mime };
}
