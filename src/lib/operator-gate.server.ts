import { getCookie, getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clientAddress, cookieName, issueOperatorCookie, passwordMatches, readOperatorCookie } from "@/lib/operator-gate";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

function requestHeaders() {
  try {
    return getRequest()?.headers ?? null;
  } catch {
    return null;
  }
}

function clientKey() {
  const headers = requestHeaders();
  if (!headers) return "local";
  return clientAddress((name) => headers.get(name));
}

function recentAttempts(key: string) {
  const now = Date.now();
  if (attempts.size > 2000) attempts.clear();
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

function secret() {
  return process.env.OPERATOR_PASSWORD ?? "";
}

function secureCookie() {
  return Boolean(process.env.VERCEL);
}

export function operatorCookieOk() {
  const headers = requestHeaders();
  const raw = headers?.get("cookie") ?? "";
  const name = cookieName(secureCookie());
  const fromHeader = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  const value = fromHeader || getCookie(name);
  return readOperatorCookie(value, secret());
}

export function unlockOperator(password: string) {
  const passphrase = secret();
  if (!passwordMatches(password, passphrase)) return false;
  const secure = secureCookie();
  const name = cookieName(secure);
  const secureFlag = secure ? "; Secure" : "";
  setResponseHeader(
    "set-cookie",
    `${name}=${issueOperatorCookie(passphrase)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${secureFlag}`,
  );
  return true;
}
