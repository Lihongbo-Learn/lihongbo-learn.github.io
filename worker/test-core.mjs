import assert from "node:assert/strict";
import { signSession, verifySession, hashPassword, verifyPassword, presignPut } from "./src/index.js";

const env = {
  AUTH_SECRET: "test-secret-please-change",
  R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  R2_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
  R2_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  R2_BUCKET_NAME: "wankuyuanmeng-files",
};

const token = await signSession("alice", env);
const session = await verifySession(token, env);
assert.equal(session.u, "alice");
await assert.rejects(() => verifySession(`${token}x`, env), /登录已失效/);

const { salt, hash } = await hashPassword("correct horse battery staple");
assert.equal(await verifyPassword("correct horse battery staple", salt, hash), true);
assert.equal(await verifyPassword("wrong", salt, hash), false);

const uploadUrl = await presignPut(env, "uploads/test-id/示例 file.zip");
const parsed = new URL(uploadUrl);
assert.equal(parsed.hostname, "0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
assert.ok(parsed.pathname.includes("/wankuyuanmeng-files/uploads/test-id/"));
assert.ok(parsed.searchParams.get("X-Amz-Signature"));
assert.ok(parsed.searchParams.get("X-Amz-Expires"));

console.log("worker core tests passed");
console.log("presigned URL host:", parsed.hostname);
