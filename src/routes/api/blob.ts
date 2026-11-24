import { createFileRoute } from "@tanstack/react-router";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const SAFE_UPLOAD = /^captures\/[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$/;

export const Route = createFileRoute("/api/blob")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.OPERATOR_PASSWORD) {
          return new Response("Direct upload is off.", { status: 404 });
        }
        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        const { operatorCookieOk } = await import("@/lib/operator-gate.server");
        try {
          assertSameSiteRequest();
        } catch {
          return new Response("Forbidden", { status: 403 });
        }
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
              if (!SAFE_UPLOAD.test(pathname) || pathname.includes("..")) {
                throw new Error("That upload path is not allowed.");
              }
              return {
                allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
                maximumSizeInBytes: 100 * 1024 * 1024,
                addRandomSuffix: true,
                allowOverwrite: false,
                validUntil: Date.now() + 15 * 60 * 1000,
              };
            },
          });
          return Response.json(jsonResponse);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed.";
          const safe = /token|secret|password|blob_read/i.test(message) ? "Upload failed." : message;
          return Response.json({ error: safe }, { status: 400 });
        }
      },
    },
  },
});
