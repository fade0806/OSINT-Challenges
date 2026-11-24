import { createMiddleware } from "@tanstack/react-start";

export const operatorMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    if (process.env.OPERATOR_PASSWORD) {
      const { operatorCookieOk } = await import("./operator-gate.server");
      if (!operatorCookieOk()) throw new Error("Operator sign-in required.");
      return next({ context: { userId: "operator" } });
    }
    const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
    const { requireUserId } = await import("@/lib/auth/verify.server");
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    return next({ context: { userId } });
  });
