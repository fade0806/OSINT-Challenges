import { createFileRoute } from "@tanstack/react-router";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const MAX_PANORAMA_BYTES = 48 * 1024 * 1024;

export const Route = createFileRoute("/api/blob")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.OPERATOR_PASSWORD) {
          return new Response("Direct upload is off.", { status: 404 });
        }
        const { operatorCookieOk } = await import("@/lib/operator-gate.server");
        if (!operatorCookieOk()) {
          return new Response("Operator sign-in required.", { status: 401 });
        }
        let body: HandleUploadBody;
        try {
          body = (await request.json()) as HandleUploadBody;
        } catch {
          return new Response("Upload request was empty.", { status: 400 });
        }
        try {
          const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
              if (!pathname.startsWith("captures/") || pathname.includes("..")) {
                throw new Error("That upload path is not allowed.");
              }
              return {
                allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
                maximumSizeInBytes: MAX_PANORAMA_BYTES,
                addRandomSuffix: true,
                allowOverwrite: false,
              };
            },
          });
          return Response.json(jsonResponse);
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Upload failed." },
            { status: 400 },
          );
        }
      },
    },
  },
});
