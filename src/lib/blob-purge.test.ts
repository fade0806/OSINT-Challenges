import assert from "node:assert/strict";
import test from "node:test";
import { isBlobReadUrl, isOwnedPath, orphanPathnames, pathsForCapture, stalePaths } from "./blob-purge.ts";

test("panorama links can only point at the private blob store", () => {
  assert.equal(isBlobReadUrl("https://store.private.blob.vercel-storage.com/captures/a?x=1"), true);
  assert.equal(isBlobReadUrl("https://evil.example/store.private.blob.vercel-storage.com"), false);
  assert.equal(isBlobReadUrl("http://store.private.blob.vercel-storage.com/a"), false);
  assert.equal(isBlobReadUrl("https://user:pass@store.private.blob.vercel-storage.com/a"), false);
  assert.equal(isBlobReadUrl("https://blob.vercel-storage.com.evil.com/a"), false);
});
test("only capture paths can be deleted", () => {
  assert.equal(isOwnedPath("captures/abc/full.jpg"), true);
  assert.equal(isOwnedPath("board/state.json"), false);
  assert.equal(isOwnedPath("captures/../board/state.json"), false);
  assert.equal(isOwnedPath("captures//secret"), false);
  assert.equal(isOwnedPath("https://blob.vercel-storage.com/captures/a.jpg"), false);
});

test("removing a challenge targets its stored files and the legacy copies", () => {
  assert.deepEqual(
    pathsForCapture({
      slug: "testing",
      imagePath: "captures/uuid/full.jpg-abc",
      thumbPath: "captures/uuid/thumb.jpg-def",
    }),
    [
      "captures/uuid/full.jpg-abc",
      "captures/uuid/thumb.jpg-def",
      "captures/testing/full",
      "captures/testing/thumb",
    ],
  );
});

test("replacing a panorama keeps the new files and drops the old ones", () => {
  assert.deepEqual(
    stalePaths(
      ["captures/old/full.jpg", "captures/old/thumb.jpg", "captures/testing/full"],
      ["captures/new/full.jpg", "captures/new/thumb.jpg"],
    ),
    ["captures/old/full.jpg", "captures/old/thumb.jpg", "captures/testing/full"],
  );
});

test("files still on the board, and fresh uploads, are not treated as garbage", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const stale = orphanPathnames(
    [
      { pathname: "captures/keep/full.jpg", uploadedAt: now - 60 * 60 * 1000 },
      { pathname: "captures/old/full.jpg", uploadedAt: now - 60 * 60 * 1000 },
      { pathname: "captures/fresh/full.jpg", uploadedAt: now - 60 * 1000 },
      { pathname: "board/state.json", uploadedAt: now - 60 * 60 * 1000 },
    ],
    ["captures/keep/full.jpg"],
    now,
  );
  assert.deepEqual(stale, ["captures/old/full.jpg"]);
});
