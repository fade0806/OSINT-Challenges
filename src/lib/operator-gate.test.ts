import assert from "node:assert/strict";
import test from "node:test";
import {
  clientAddress,
  issueOperatorCookie,
  passwordMatches,
  readOperatorCookie,
} from "./operator-gate.ts";

const secret = "test-secret-not-the-live-one";

test("a wrong or partial passphrase does not match", () => {
  assert.equal(passwordMatches("correct horse battery", secret), false);
  assert.equal(passwordMatches(secret.slice(0, secret.length - 1), secret), false);
  assert.equal(passwordMatches(secret, secret), true);
});

test("an operator cookie expires and fails if it is edited", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const raw = issueOperatorCookie(secret, now);
  assert.equal(readOperatorCookie(raw, secret, now + 1000), true);
  assert.equal(readOperatorCookie(raw, secret, now + 31 * 24 * 60 * 60 * 1000), false);
  assert.equal(readOperatorCookie(raw, "other-secret", now + 1000), false);
  const [exp, mac] = raw.split(".");
  const flipped = mac.endsWith("0") ? `${mac.slice(0, -1)}1` : `${mac.slice(0, -1)}0`;
  assert.equal(readOperatorCookie(`${exp}.${flipped}`, secret, now + 1000), false);
  assert.equal(readOperatorCookie("not-a-cookie", secret, now), false);
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
