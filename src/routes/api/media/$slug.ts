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
            if (full) {
              const board = await remote.remoteBoard();
              const capture = board.captures.find((item) => item.slug === slug);
              if (!capture || capture.visible === false) return new Response("Not found", { status: 404 });
              if (capture.imagePath) {
                const signed = await remote.remoteReadUrl(capture.imagePath);
                return Response.redirect(signed, 302);
              }
            }
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
        return new Response("Not found", { status: 404 });
      },
    },
  },
});
