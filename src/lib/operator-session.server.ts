import { get, put } from "@vercel/blob";
import { newSessionId, rememberSession, revokeSession } from "@/lib/operator-gate";

const PATH = "board/operator-session.json";
let memory: string[] = [];

function clean(ids: unknown) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{32}$/.test(id)).slice(-8);
}

async function readIds() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memory;
  try {
    const result = await get(PATH, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return [];
    const parsed = JSON.parse(await new Response(result.stream).text()) as { ids?: unknown };
    return clean(parsed.ids);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("not found") || message.includes("does not exist") || message.includes("404")) return [];
    throw error;
  }
}

async function writeIds(ids: string[]) {
  const next = clean(ids);
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    memory = next;
    return;
  }
  await put(PATH, JSON.stringify({ ids: next }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

export async function openOperatorSession() {
  const id = newSessionId();
  await writeIds(rememberSession(await readIds(), id));
  return id;
}

export async function closeOperatorSession(id: string | null) {
  if (!id) return;
  await writeIds(revokeSession(await readIds(), id));
}

export async function operatorSessionLive(id: string) {
  return (await readIds()).includes(id);
}
