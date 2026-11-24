import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, getRequest, setResponseHeader } from "@tanstack/react-start/server";

const COOKIE = "sp_operator";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

function expectedToken(secret: string) {
  return createHmac("sha256", secret).update("sentinalsprime-operator").digest("hex");
}

function clientKey() {
  try {
    const forwarded = getRequest()?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    return forwarded.slice(0, 80) || "local";
  } catch {
    return "local";
  }
}

function recentAttempts(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  attempts.set(key, recent);
  return recent;
}

export function operatorLocked() {
  return recentAttempts(clientKey()).length >= MAX_ATTEMPTS;
}

export function noteOperatorFailure() {
  const key = clientKey();
  const recent = recentAttempts(key);
  recent.push(Date.now());
  attempts.set(key, recent);
}

export function noteOperatorSuccess() {
  attempts.delete(clientKey());
}

export function resetOperatorAttempts() {
  attempts.clear();
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
  if (!secret || typeof password !== "string" || password.length > 200) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const secure = process.env.VERCEL ? "; Secure" : "";
  setResponseHeader(
    "set-cookie",
    `${COOKIE}=${expectedToken(secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`,
  );
  return true;
}