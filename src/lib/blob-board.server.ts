import { get, put } from "@vercel/blob";

export type RemoteCapture = {
  slug: string;
  name: string;
  category: string;
  brief: string;
  updatedAt: string;
  image: string;
  thumb: string;
};

export type RemoteBoard = {
  briefing: unknown;
  captures: RemoteCapture[];
};

const STATE = "board/state.json";

export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readBoard(): Promise<RemoteBoard> {
  const result = await get(STATE, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return { briefing: null, captures: [] };
  }
  const text = await new Response(result.stream).text();
  const parsed = JSON.parse(text) as RemoteBoard;
  return {
    briefing: parsed.briefing ?? null,
    captures: Array.isArray(parsed.captures) ? parsed.captures : [],
  };
}

async function writeBoard(board: RemoteBoard) {
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
  board.captures.push(capture);
  await writeBoard(board);
}

export async function remoteUpdate(capture: RemoteCapture, replaceImage: boolean) {
  const board = await readBoard();
  const index = board.captures.findIndex((item) => item.slug === capture.slug);
  if (index < 0) throw new Error("That capture is gone.");
  const current = board.captures[index];
  board.captures[index] = replaceImage
    ? capture
    : { ...capture, image: current.image, thumb: current.thumb };
  await writeBoard(board);
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
  return full ? capture.image : capture.thumb;
}
