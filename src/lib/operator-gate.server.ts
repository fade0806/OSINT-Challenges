import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE = "sp_operator";

function expectedToken(secret: string) {
  return createHmac("sha256", secret).update("sentinalsprime-operator").digest("hex");
}

export function operatorCookieOk() {
  const secret = process.env.OPERATOR_PASSWORD;
  if (!secret) return false;
  const raw = getCookie(COOKIE);
  if (!raw) return false;
  const a = Buffer.from(raw);
  const b = Buffer.from(expectedToken(secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unlockOperator(password: string) {
  const secret = process.env.OPERATOR_PASSWORD;
  if (!secret) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const secure = process.env.VERCEL ? "; Secure" : "";
  setResponseHeader(
    "set-cookie",
    `${COOKIE}=${expectedToken(secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
  );
  return true;
}
