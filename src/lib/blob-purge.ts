export const ORPHAN_GRACE_MS = 15 * 60 * 1000;

const OWNED = /^captures\/[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/;

export function isOwnedPath(path: string | undefined | null): path is string {
  return typeof path === "string" && OWNED.test(path) && !path.includes("..") && !path.includes("//");
}

export function pathsForCapture(capture: {
  slug: string;
  imagePath?: string | null;
  thumbPath?: string | null;
}): string[] {
  return [
    ...new Set(
      [capture.imagePath, capture.thumbPath, `captures/${capture.slug}/full`, `captures/${capture.slug}/thumb`].filter(
        isOwnedPath,
      ),
    ),
  ];
}

export function stalePaths(previous: Array<string | undefined | null>, next: Array<string | undefined | null>): string[] {
  const keep = new Set(next.filter(isOwnedPath));
  return [...new Set(previous.filter(isOwnedPath).filter((path) => !keep.has(path)))];
}

export type ListedBlob = { pathname: string; uploadedAt: Date | string | number };

export function orphanPathnames(blobs: ListedBlob[], keep: Iterable<string>, now: number, graceMs = ORPHAN_GRACE_MS): string[] {
  const held = new Set([...keep].filter(isOwnedPath));
  const stale: string[] = [];
  for (const blob of blobs) {
    if (!isOwnedPath(blob.pathname) || held.has(blob.pathname)) continue;
    const uploaded =
      blob.uploadedAt instanceof Date ? blob.uploadedAt.getTime() : new Date(blob.uploadedAt).getTime();
    if (!Number.isFinite(uploaded) || now - uploaded < graceMs) continue;
    stale.push(blob.pathname);
  }
  return stale;
}
