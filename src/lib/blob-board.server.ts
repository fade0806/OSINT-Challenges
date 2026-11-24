import { get, put } from "@vercel/blob";

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
};

export type RemoteBoard = {
  briefing: unknown;
  showSample?: boolean;
  captures: RemoteCapture[];
};

const STATE = "board/state.json";

async function readBoard(): Promise<RemoteBoard> {
  let result;
  try {
    result = await get(STATE, { access: "private", useCache: false });
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Could not read the board. Nothing was changed.",
    );
  }
  if (!result) return { briefing: null, showSample: true, captures: [] };
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not read the board. Nothing was changed.");
  }
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as RemoteBoard;
  return {
    briefing: parsed.briefing ?? null,
    showSample: parsed.showSample !== false,
    captures: Array.isArray(parsed.captures) ? parsed.captures : [],
  };
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
  await externalize(board);
  await put(STATE, JSON.stringify(board), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

export async function remoteBoard() {
  return readBoard();
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
  board.captures[index] = replaceImage
    ? {
        ...current,
        ...capture,
        visible: current.visible !== false,
        imagePath: undefined,
        thumbPath: undefined,
      }
    : {
        ...current,
        name: capture.name,
        category: capture.category,
        brief: capture.brief,
        updatedAt: capture.updatedAt,
      };
  await writeBoard(board);
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
  board.captures = board.captures.filter((item) => item.slug !== slug);
  await writeBoard(board);
}

export async function remoteImage(slug: string, full: boolean) {
  const board = await readBoard();
  const capture = board.captures.find((item) => item.slug === slug);
  if (!capture) return null;
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
