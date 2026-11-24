import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const OPERATOR_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const SALT = "sentinalsprime-operator-v2";
const STRETCH = { N: 16384, r: 8, p: 1 } as const;
let knownSecret: { secret: string; key: Buffer } | null = null;

export function passwordMatches(password: string, secret: string) {
  if (!password || !secret || password.length > 200 || secret.length > 200) return false;
  if (!knownSecret || knownSecret.secret !== secret) {
    knownSecret = { secret, key: scryptSync(secret, SALT, 32, STRETCH) };
  }
  const attempt = scryptSync(password, SALT, 32, STRETCH);
  return timingSafeEqual(attempt, knownSecret.key);
}

export function issueOperatorCookie(secret: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + OPERATOR_MAX_AGE_SEC;
  const mac = createHmac("sha256", secret).update(`sentinalsprime-operator.${exp}`).digest("hex");
  return `${exp}.${mac}`;
}

export function readOperatorCookie(raw: string | undefined, secret: string, now = Date.now()) {
  if (!raw || !secret || raw.length > 120) return false;
  const dot = raw.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(raw.slice(0, dot));
  const mac = raw.slice(dot + 1);
  const nowSec = Math.floor(now / 1000);
  if (!Number.isSafeInteger(exp) || exp < nowSec || exp > nowSec + OPERATOR_MAX_AGE_SEC + 60) return false;
  const expected = createHmac("sha256", secret).update(`sentinalsprime-operator.${exp}`).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookieName(secure: boolean) {
  return secure ? "__Host-sp_operator" : "sp_operator";
}

/** Prefer the address the platform sets. A client can prepend a fake X-Forwarded-For. */
export function clientAddress(header: (name: string) => string | null) {
  const vercel = header("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (vercel) return vercel.slice(0, 80);
  const real = header("x-real-ip")?.trim() ?? "";
  if (real) return real.slice(0, 80);
  const parts = (header("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return (parts[parts.length - 1] ?? "local").slice(0, 80);
}
