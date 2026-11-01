/**
 * 宛枯缘梦 · Downloads API (Cloudflare Worker + R2 + KV)
 *
 * Secrets:
 *   AUTH_CODE              共享注册码（用户上传前输入）
 *   AUTH_SECRET            HMAC 会话/下载 token 密钥（随机长字符串）
 *   R2_ACCOUNT_ID          Cloudflare Account ID
 *   R2_ACCESS_KEY_ID       R2 S3 API Access Key ID
 *   R2_SECRET_ACCESS_KEY   R2 S3 API Secret Access Key
 *
 * Vars:
 *   ALLOWED_ORIGIN         comma separated origins
 *   R2_BUCKET_NAME         bucket for presigned PUT
 *   MAX_UPLOAD_BYTES       e.g. 5368709120 (5 GiB)
 */
import { AwsClient } from "aws4fetch";

const SESSION_TTL = 12 * 60 * 60 * 1000;
const DOWNLOAD_TTL = 5 * 60 * 1000;
const PBKDF2_ITERATIONS = 100000;
const enc = new TextEncoder();
const dec = new TextDecoder();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });

function corsHeaders(env, request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Disposition",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function bytesToB64url(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const b64urlText = (value) => bytesToB64url(enc.encode(value));
const b64urlDecodeText = (value) => dec.decode(b64urlToBytes(value));

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacB64(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bytesToB64url(new Uint8Array(signature));
}

async function signSession(username, env) {
  const payload = b64urlText(JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL }));
  return `${payload}.${await hmacB64(env.AUTH_SECRET, payload)}`;
}

async function verifySession(token, env) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) throw new HttpError(401, "登录已失效，请重新登录");
  const expected = await hmacB64(env.AUTH_SECRET, payload);
  if (!timingSafeEqual(signature, expected)) throw new HttpError(401, "登录已失效，请重新登录");
  const data = JSON.parse(b64urlDecodeText(payload));
  if (!data || !data.u || !data.exp || data.exp < Date.now()) {
    throw new HttpError(401, "登录已过期，请重新登录");
  }
  return data;
}

async function signFileToken(id, env) {
  const payload = b64urlText(JSON.stringify({ f: id, exp: Date.now() + DOWNLOAD_TTL }));
  return `${payload}.${await hmacB64(env.AUTH_SECRET, payload)}`;
}

async function verifyFileToken(token, id, env) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) throw new HttpError(401, "需要密码");
  const expected = await hmacB64(env.AUTH_SECRET, payload);
  if (!timingSafeEqual(signature, expected)) throw new HttpError(401, "下载凭证无效");
  const data = JSON.parse(b64urlDecodeText(payload));
  if (!data || data.f !== id || !data.exp || data.exp < Date.now()) {
    throw new HttpError(401, "下载凭证已过期，请重新输入密码");
  }
  return data;
}

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? b64urlToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    256
  );
  return { salt: bytesToB64url(salt), hash: bytesToB64url(new Uint8Array(bits)) };
}

async function verifyPassword(password, salt, hash) {
  const derived = await hashPassword(password, salt);
  return timingSafeEqual(derived.hash, hash);
}

const clip = (value, max) => String(value == null ? "" : value).slice(0, max);
const trim = (value) => String(value == null ? "" : value).trim();

function safeFilename(name) {
  const base = String(name || "file").split(/[\\/]/).pop();
  const cleaned = base
    .replace(/[^\w.\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "file";
}

function contentDisposition(name) {
  const safe = safeFilename(name).replace(/'/g, "%27");
  return `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 64 * 1024) throw new HttpError(413, "请求内容过大");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new HttpError(400, "请求格式错误");
  }
}

function sessionToken(request) {
  return trim(request.headers.get("X-Session")).replace(/^Bearer\s+/i, "");
}

async function requireUser(request, env) {
  const token = sessionToken(request);
  if (!token) throw new HttpError(401, "请先登录");
  const data = await verifySession(token, env);
  return data.u;
}

function publicMeta(meta) {
  return {
    id: meta.id,
    title: meta.title,
    version: meta.version,
    platform: meta.platform,
    date: meta.date,
    size: meta.size,
    sizeLabel: formatBytes(meta.size),
    note: meta.note,
    uploader: meta.uploader,
    protected: !!meta.protected,
    createdAt: meta.createdAt,
  };
}

async function presignPut(env, key) {
  const missing = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"].filter(
    (name) => !env[name]
  );
  if (missing.length) throw new HttpError(500, `R2 未配置：${missing.join(", ")}`);
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const path = key.split("/").map(encodeURIComponent).join("/");
  const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${path}`;
  const signed = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

async function login(request, env, cors) {
  const body = await readJson(request);
  const username = trim(clip(body.username, 40));
  const code = trim(clip(body.code, 64));
  if (!username) throw new HttpError(400, "请输入用户名");
  if (!env.AUTH_CODE) throw new HttpError(500, "服务端未设置注册码");
  if (!timingSafeEqual(code, String(env.AUTH_CODE))) throw new HttpError(401, "注册码不正确");
  return json(
    {
      token: await signSession(username, env),
      username,
      expiresAt: Date.now() + SESSION_TTL,
    },
    200,
    cors
  );
}

async function listFiles(env, cors) {
  const files = [];
  let cursor;
  do {
    const page = await env.META.list({ prefix: "file:", cursor });
    const records = await Promise.all(page.keys.map((key) => env.META.get(key.name, "json")));
    records.forEach((meta) => meta && files.push(publicMeta(meta)));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  files.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return json({ files }, 200, cors);
}

async function initUpload(request, env, cors) {
  const username = await requireUser(request, env);
  const body = await readJson(request);
  const filename = trim(clip(body.filename, 200));
  const size = Number(body.size);
  const maxSize = Number(env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024 * 1024);
  if (!filename) throw new HttpError(400, "缺少文件名");
  if (!Number.isFinite(size) || size <= 0 || size > maxSize) {
    throw new HttpError(400, `文件大小需在 1 字节到 ${formatBytes(maxSize)} 之间`);
  }
  const password = clip(body.password, 200);
  const title = trim(clip(body.title, 120)) || filename;
  const version = trim(clip(body.version, 40));
  const platform = trim(clip(body.platform, 40)) || "其他";
  const note = trim(clip(body.note, 1000));
  const id = crypto.randomUUID();
  const key = `uploads/${id}/${safeFilename(filename)}`;
  const uploadUrl = await presignPut(env, key);
  const protectedFile = password.length > 0;
  const hashed = protectedFile ? await hashPassword(password) : null;
  const pending = {
    id,
    key,
    filename,
    size,
    title,
    version,
    platform,
    note,
    username,
    mime: clip(body.type, 100) || "application/octet-stream",
    protected: protectedFile,
    passwordHash: hashed?.hash || "",
    passwordSalt: hashed?.salt || "",
    createdAt: new Date().toISOString(),
  };
  await env.META.put(`pending:${id}`, JSON.stringify(pending), { expirationTtl: 3600 });
  return json({ id, uploadUrl }, 200, cors);
}

async function completeUpload(request, env, cors) {
  const username = await requireUser(request, env);
  const body = await readJson(request);
  const id = trim(clip(body.id, 64));
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new HttpError(400, "上传 ID 无效");
  const pending = await env.META.get(`pending:${id}`, "json");
  if (!pending) throw new HttpError(404, "上传会话已过期，请重新上传");
  if (pending.username !== username) throw new HttpError(403, "上传会话不属于当前用户");
  const object = await env.FILES.head(pending.key);
  if (!object || !object.size) throw new HttpError(400, "没有找到已上传的文件");
  const maxSize = Number(env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024 * 1024);
  if (object.size > maxSize) {
    await env.FILES.delete(pending.key);
    throw new HttpError(413, "文件超过大小限制");
  }
  const meta = {
    ...pending,
    size: object.size,
    mime: object.httpMetadata?.contentType || pending.mime,
    date: new Date().toISOString().slice(0, 10),
  };
  await env.META.put(`file:${id}`, JSON.stringify(meta));
  await env.META.delete(`pending:${id}`);
  return json({ file: publicMeta(meta) }, 200, cors);
}

async function unlock(request, env, cors, id) {
  const meta = await env.META.get(`file:${id}`, "json");
  if (!meta) throw new HttpError(404, "文件不存在");
  if (!meta.protected) return json({ token: null }, 200, cors);
  const body = await readJson(request);
  const password = clip(body.password, 200);
  if (!password) throw new HttpError(400, "请输入文件密码");
  if (!(await verifyPassword(password, meta.passwordSalt, meta.passwordHash))) {
    throw new HttpError(401, "文件密码不正确");
  }
  return json({ token: await signFileToken(id, env) }, 200, cors);
}

async function download(request, env, url, id) {
  const meta = await env.META.get(`file:${id}`, "json");
  if (!meta) throw new HttpError(404, "文件不存在");
  if (meta.protected) {
    const token = url.searchParams.get("token") || "";
    if (!token) throw new HttpError(401, "需要文件密码");
    await verifyFileToken(token, id, env);
  }

  const cors = corsHeaders(env, request);
  const rangeHeader = request.headers.get("Range");
  let object = null;
  let status = 200;
  let contentLength = meta.size;
  let contentRange = "";

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : meta.size - 1;
      if (start >= meta.size || end < start) {
        return new Response(null, {
          status: 416,
          headers: { ...cors, "Content-Range": `bytes */${meta.size}` },
        });
      }
      const last = Math.min(end, meta.size - 1);
      contentLength = last - start + 1;
      object = await env.FILES.get(meta.key, {
        range: { offset: start, length: contentLength },
      });
      status = 206;
      contentRange = `bytes ${start}-${last}/${meta.size}`;
    }
  }
  if (!object) object = await env.FILES.get(meta.key);
  if (!object) throw new HttpError(404, "文件不存在");

  const headers = {
    ...cors,
    "Content-Type": meta.mime || "application/octet-stream",
    "Content-Length": String(contentLength),
    "Accept-Ranges": "bytes",
    "Content-Disposition": contentDisposition(meta.filename),
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
  if (status === 206) headers["Content-Range"] = contentRange;
  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}

async function handle(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const cors = corsHeaders(env, request);

  try {
    if (path === "/api/health" && request.method === "GET") {
      return json({ ok: true }, 200, cors);
    }
    if (path === "/api/login" && request.method === "POST") {
      return await login(request, env, cors);
    }
    if (path === "/api/files" && request.method === "GET") {
      return await listFiles(env, cors);
    }
    if (path === "/api/uploads/init" && request.method === "POST") {
      return await initUpload(request, env, cors);
    }
    if (path === "/api/uploads/complete" && request.method === "POST") {
      return await completeUpload(request, env, cors);
    }
    const match = path.match(/^\/api\/files\/([a-zA-Z0-9-]{8,64})\/(unlock|download)$/);
    if (match) {
      if (match[2] === "unlock" && request.method === "POST") {
        return await unlock(request, env, cors, match[1]);
      }
      if (match[2] === "download" && (request.method === "GET" || request.method === "HEAD")) {
        return await download(request, env, url, match[1]);
      }
    }
    return json({ error: "Not found" }, 404, cors);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status, cors);
    }
    console.error(error);
    return json({ error: "服务器错误" }, 500, cors);
  }
}

export default { fetch: handle };
export { signSession, verifySession, hashPassword, verifyPassword, presignPut };
