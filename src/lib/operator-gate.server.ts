import { getCookie, getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { clientAddress, issueOperatorCookie, operatorCookieHeader, passwordMatches, readOperatorCookie } from "@/lib/operator-gate";

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

function readNamedCookie(name: string) {
  const headers = requestHeaders();
  const raw = headers?.get("cookie") ?? "";
  const fromHeader = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return fromHeader || getCookie(name);
}

export function operatorCookieOk() {
  const secure = secureCookie();
  const host = readNamedCookie("__Host-sp_operator");
  const plain = readNamedCookie("sp_operator");
  const value = secure ? host || plain : plain || host;
  return readOperatorCookie(value, secret());
}

export function lockOperator() {
  const secure = secureCookie();
  setResponseHeader("set-cookie", operatorCookieHeader("", secure, 0));
}

export function unlockOperator(password: string) {
  const passphrase = secret();
  if (!passwordMatches(password, passphrase)) return false;
  const secure = secureCookie();
  setResponseHeader(
    "set-cookie",
    operatorCookieHeader(issueOperatorCookie(passphrase), secure, 60 * 60 * 24 * 30),
  );
  return true;
}
