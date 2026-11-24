import assert from "node:assert/strict";
import test from "node:test";
import {
  clearedOperatorCookies,
  clientAddress,
  issueOperatorCookie,
  newSessionId,
  passwordMatches,
  readOperatorCookie,
  rememberSession,
  revokeSession,
} from "./operator-gate.ts";

const secret = "test-secret-not-the-live-one";

test("a wrong or partial passphrase does not match", () => {
  assert.equal(passwordMatches("correct horse battery", secret), false);
  assert.equal(passwordMatches(secret.slice(0, secret.length - 1), secret), false);
  assert.equal(passwordMatches(secret, secret), true);
});

test("an operator cookie expires and fails if it is edited", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const sessionId = newSessionId();
  const raw = issueOperatorCookie(secret, sessionId, now);
  assert.equal(readOperatorCookie(raw, secret, now + 1000), sessionId);
  assert.equal(readOperatorCookie(raw, secret, now + 31 * 24 * 60 * 60 * 1000), null);
  assert.equal(readOperatorCookie(raw, "other-secret", now + 1000), null);
  const parts = raw.split(".");
  const mac = parts[2];
  const flipped = mac.endsWith("0") ? `${mac.slice(0, -1)}1` : `${mac.slice(0, -1)}0`;
  parts[2] = flipped;
  assert.equal(readOperatorCookie(parts.join("."), secret, now + 1000), null);
  parts[1] = newSessionId();
  parts[2] = mac;
  assert.equal(readOperatorCookie(parts.join("."), secret, now + 1000), null);
  assert.equal(readOperatorCookie("not-a-cookie", secret, now), null);
});

test("logout revokes that session id and leaves a different login", () => {
  const first = newSessionId();
  const second = newSessionId();
  const ids = revokeSession(rememberSession(rememberSession([], first), second), first);
  assert.deepEqual(ids, [second]);
});

test("logout clears every operator cookie name", () => {
  const headers = clearedOperatorCookies();
  assert.equal(headers.length, 3);
  for (const header of headers) {
    assert.match(header, /Max-Age=0/);
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Strict/);
  }
  assert.match(headers[0], /^sp_operator=;/);
  assert.match(headers[2], /^__Host-sp_operator=;/);
  assert.match(headers[2], /Secure/);
  assert.equal(readOperatorCookie("", secret), null);
});

test("the attempt limit uses the platform address, not a spoofed first hop", () => {
  const headers = new Map([
    ["x-forwarded-for", "1.1.1.1, 203.0.113.8"],
    ["x-vercel-forwarded-for", "203.0.113.8"],
  ]);
  assert.equal(
    clientAddress((name) => headers.get(name) ?? null),
    "203.0.113.8",
  );
  const bare = new Map([["x-forwarded-for", "1.1.1.1, 203.0.113.9"]]);
  assert.equal(clientAddress((name) => bare.get(name) ?? null), "203.0.113.9");
});
