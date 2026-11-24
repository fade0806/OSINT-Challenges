import { createFileRoute } from "@tanstack/react-router";
import { isBlobReadUrl, isOwnedPath } from "@/lib/blob-purge";
import { getSql } from "@/lib/db";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const PRIVATE_MEDIA = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

function missing() {
  return new Response("Not found", { status: 404, headers: PRIVATE_MEDIA });
}

export const Route = createFileRoute("/api/media/$slug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
        if (!/^[a-z0-9-]{1,80}$/.test(slug)) return missing();
        const full = url.searchParams.get("kind") === "full";
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          try {
            const remote = await import("@/lib/blob-board.server");
            const board = await remote.remoteBoard();
            const capture = board.captures.find((item) => item.slug === slug);
            if (!capture || capture.visible === false) return missing();
            const assetPath = full ? capture.imagePath : capture.thumbPath;
            if (assetPath && isOwnedPath(assetPath)) {
              const signed = await remote.remoteReadUrl(assetPath);
              if (!isBlobReadUrl(signed)) return missing();
              return new Response(null, {
                status: 302,
                headers: {
                  location: signed,
                  "cache-control": "private, max-age=300",
                  "referrer-policy": "no-referrer",
                  "x-content-type-options": "nosniff",
                },
              });
            }
            const media = await remote.remoteImage(slug, full);
            if (!media) return missing();
            const mime = IMAGE_TYPES.has(media.mime ?? "") ? media.mime! : "application/octet-stream";
            return new Response(media.body, {
              headers: {
                ...PRIVATE_MEDIA,
                "content-type": mime,
                "content-disposition": "inline",
              },
            });
          } catch (error) {
            console.error(error);
            return missing();
          }
        }
        try {
          const sql = await getSql();
          const rows = full
            ? await sql<{ data: string; mime: string }>`
                select image_b64 as data, mime from captures where slug = ${slug} and visible = true
              `
            : await sql<{ data: string; mime: string }>`
                select thumb_b64 as data, mime from captures where slug = ${slug} and visible = true
              `;
          const row = rows[0];
          if (!row?.data || !IMAGE_TYPES.has(row.mime)) return missing();
          const bytes = Uint8Array.from(Buffer.from(row.data, "base64"));
          return new Response(bytes, {
            headers: {
              ...PRIVATE_MEDIA,
              "content-type": row.mime || "image/jpeg",
            },
          });
        } catch (error) {
          console.error(error);
          return missing();
        }
      },
    },
  },
});
