import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

export const Route = createFileRoute("/api/media/$slug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
        if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
          return new Response("Not found", { status: 404 });
        }
        const full = url.searchParams.get("kind") === "full";
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          try {
            const remote = await import("@/lib/blob-board.server");
            const media = await remote.remoteImage(slug, full);
            if (media) {
              return new Response(media.body, {
                headers: {
                  "content-type": media.mime || "image/jpeg",
                  "cache-control": "public, max-age=86400",
                },
              });
            }
          } catch (error) {
            console.error(error);
          }
        }
        try {
          const sql = await getSql();
          const rows = full
            ? await sql<{ data: string; mime: string }>`
                select image_b64 as data, mime from captures where slug = ${slug}
              `
            : await sql<{ data: string; mime: string }>`
                select thumb_b64 as data, mime from captures where slug = ${slug}
              `;
          const row = rows[0];
          if (row) {
            const bytes = Uint8Array.from(Buffer.from(row.data, "base64"));
            return new Response(bytes, {
              headers: {
                "content-type": row.mime || "image/jpeg",
                "cache-control": "public, max-age=86400",
              },
            });
          }
        } catch (error) {
          console.error(error);
        }
        if (slug === "basalt-reach") {
          try {
            const { readFile } = await import("node:fs/promises");
            const { join } = await import("node:path");
            const name = full ? "basalt-reach.jpg" : "basalt-reach-thumb.jpg";
            const file = await readFile(join(process.cwd(), "public/panoramas", name));
            return new Response(file, {
              headers: {
                "content-type": "image/jpeg",
                "cache-control": "public, max-age=86400",
              },
            });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        }
        return new Response("Not found", { status: 404 });
      },
    },
  },
});
