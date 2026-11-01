/* Downloads — 宛枯缘梦 */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, "0");
  const plainText = (value) => String(value == null ? "" : value).trim();

  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);

  const safeUrl = (url) => {
    const raw = plainText(url);
    return /^https?:\/\//i.test(raw) ? raw : "";
  };

  // gh-proxy docs: prefix https://gh-proxy.org/ to a GitHub URL
  const PROXY_ORIGIN = "https://gh-proxy.org/";
  const isGithubUrl = (url) => /^https:\/\/(github\.com|raw\.githubusercontent\.com|codeload\.github\.com)\//i.test(url);
  const mirrorUrl = (url) => (isGithubUrl(url) ? `${PROXY_ORIGIN}${url}` : "");

  const state = {
    entries: [],
    platform: "全部",
    query: "",
    toastTimer: 0,
    apiBase: "",
    session: null,
    uploadFile: null,
    unlockTarget: null,
  };

  const SESSION_KEY = "dl_upload_session_v1";

  const formatBytes = (bytes) => {
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
  };

  const safeApiBase = (value) => {
    const raw = plainText(value).replace(/\/+$/, "");
    return /^https?:\/\//i.test(raw) ? raw : "";
  };

  const loadSession = () => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session.token || !session.username || !session.expiresAt || session.expiresAt < Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  };

  const saveSession = (session) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
  };

  async function apiFetch(path, options = {}) {
    const { json, headers, ...rest } = options;
    const finalHeaders = { ...(headers || {}) };
    if (json) finalHeaders["Content-Type"] = "application/json";
    if (state.session && state.session.token) finalHeaders["X-Session"] = state.session.token;
    const response = await fetch(`${state.apiBase}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: json ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = new Error((data && data.error) || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  const isFeatured = (entry) => entry && (entry.featured === true || entry.featured === "true");

  const fileKind = (file) => {
    const kind = plainText(file && file.kind).toLowerCase();
    return ["primary", "part", "mirror"].includes(kind) ? kind : "primary";
  };

  const platformList = () => {
    const values = state.entries.map((entry) => plainText(entry.platform)).filter(Boolean);
    return ["全部", ...Array.from(new Set(values))];
  };

  const countFiles = (entries) =>
    entries.reduce((sum, entry) => {
      if (Array.isArray(entry.files) && entry.files.length) return sum + entry.files.length;
      return sum + (entry.r2 ? 1 : 0);
    }, 0);

  const toast = (message) => {
    const el = $("#dlToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("is-on"), 2200);
  };

  const copyText = (text) => {
    const value = plainText(text);
    if (!value) return;
    const done = () => toast("SHA-256 已复制");
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        done();
      } catch (error) {
        toast("复制失败");
      }
      area.remove();
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done).catch(fallback);
    } else {
      fallback();
    }
  };

  const shaRow = (file) => {
    const sha = plainText(file.sha256).replace(/^sha256:/i, "");
    if (!sha) return "";
    const short = sha.length > 20 ? `${sha.slice(0, 20)}…` : sha;
    return `<div class="dl-sha"><span>SHA-256</span><code>${esc(short)}</code><button class="dl-copy" type="button" data-copy="${esc(sha)}" aria-label="复制 SHA-256">复制</button></div>`;
  };

  const fileRow = (file) => {
    const label = plainText(file.label) || "文件";
    const size = plainText(file.size);
    const sha = plainText(file.sha256).replace(/^sha256:/i, "");
    const proxy = mirrorUrl(file.url);
    return `
      <div class="dl-file">
        <div>
          <span class="dl-file-label">${esc(label)}</span>
          ${size ? `<span class="dl-file-size mono">${esc(size)}</span>` : ""}
        </div>
        <div class="dl-file-actions">
          <a class="dl-mini" href="${esc(file.url)}" target="_blank" rel="noopener">下载 ↗</a>
          ${proxy ? `<a class="dl-mini dl-mini--proxy" href="${esc(proxy)}" target="_blank" rel="noopener" title="gh-proxy.org 第三方加速">镜像</a>` : ""}
          ${sha ? `<button class="dl-copy" type="button" data-copy="${esc(sha)}" aria-label="复制 ${esc(label)} 的 SHA-256">SHA-256</button>` : ""}
        </div>
      </div>`;
  };

  const releaseUrlFor = (files) => {
    for (const file of files) {
      const match = String(file.url).match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\//i);
      if (match) return `https://github.com/${match[1]}/${match[2]}/releases/tag/${match[3]}`;
    }
    return "";
  };

  const card = (entry) => {
    const files = (Array.isArray(entry.files) ? entry.files : [])
      .map((file) => ({ ...file, url: safeUrl(file.url), kind: fileKind(file) }))
      .filter((file) => file.url);
    const primary = files.find((file) => file.kind === "primary") || files[0] || null;
    const parts = files.filter((file) => file.kind === "part" && file !== primary);
    const mirrors = files.filter((file) => file.kind === "mirror");
    const releaseUrl = releaseUrlFor(files);
    const version = plainText(entry.version);
    const platform = plainText(entry.platform) || "文件";
    const no = entry._no || 1;
    const featured = isFeatured(entry);
    const isProtected = !!entry.protected;
    const uploader = plainText(entry.uploader);

    return `
      <article class="dl-card ${featured ? "is-featured" : ""}">
        <header class="dl-card-head">
          <span class="mono">DL ${pad(no)} / ${esc(platform)}</span>
          ${
            featured
              ? `<span class="dl-badge">推荐</span>`
              : isProtected
                ? `<span class="dl-badge dl-badge--lock">密码</span>`
                : `<span class="mono">${pad(files.length)} FILES</span>`
          }
        </header>
        <h2 class="dl-title">${esc(entry.title)}${version ? `<em>v${esc(version.replace(/^v/i, ""))}</em>` : ""}</h2>
        <div class="dl-meta mono">
          ${entry.size ? `<span>${esc(entry.size)}</span>` : ""}
          ${entry.date ? `<span>${esc(entry.date)}</span>` : ""}
          ${platform ? `<span>${esc(platform)}</span>` : ""}
          ${uploader ? `<span>BY ${esc(uploader)}</span>` : ""}
        </div>
        ${entry.note ? `<p class="dl-note">${esc(entry.note)}</p>` : ""}
        ${
          isProtected && entry.r2
            ? `<div class="dl-actions">
                <button class="dl-btn" type="button" data-unlock="${esc(entry.r2Id)}" data-title="${esc(entry.title)}">密码下载 <span aria-hidden="true">↑</span></button>
              </div>
              <p class="dl-hint">该文件需要上传者设置的文件密码；密码通过 Worker 校验，不暴露直链。</p>`
            : primary
              ? `<div class="dl-actions">
                  <a class="dl-btn" href="${esc(primary.url)}" target="_blank" rel="noopener">下载 ${esc(primary.label || "")} <span aria-hidden="true">↓</span></a>
                  ${mirrorUrl(primary.url) ? `<a class="dl-btn dl-btn--ghost dl-btn--proxy" href="${esc(mirrorUrl(primary.url))}" target="_blank" rel="noopener" title="gh-proxy.org 第三方加速">镜像下载 ↗</a>` : ""}
                  ${releaseUrl ? `<a class="dl-btn dl-btn--ghost" href="${esc(releaseUrl)}" target="_blank" rel="noopener">Release ↗</a>` : ""}
                </div>
                ${primary.sha256 ? shaRow(primary) : ""}`
              : `<p class="dl-hint">文件整理中，稍后开放。</p>`
        }
        ${
          parts.length
            ? `<div class="dl-files">
                <span class="dl-files-title mono">分卷 / PARTS</span>
                ${parts.map(fileRow).join("")}
                <p class="dl-hint">全部分卷下载到同一目录后，解压第 1 个分卷即可。</p>
              </div>`
            : ""
        }
        ${
          mirrors.length
            ? `<div class="dl-files">
                <span class="dl-files-title mono">其他文件 / MIRRORS</span>
                ${mirrors.map(fileRow).join("")}
              </div>`
            : ""
        }
      </article>`;
  };

  const emptyState = (title, message, withReset = false) => `
    <section class="dl-empty">
      <span class="mono">${withReset ? "NO MATCH / 无匹配" : "NO FILES / 暂无文件"}</span>
      <h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
      ${
        withReset
          ? `<button class="dl-btn dl-btn--ghost" type="button" data-reset>清空筛选</button>`
          : `<a class="dl-btn dl-btn--ghost" href="../">返回首页</a>`
      }
    </section>`;

  const update = () => {
    const list = $("#downloads-root");
    if (!list) return;
    const query = state.query.trim().toLowerCase();
    const ordered = state.entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => (isFeatured(b.entry) ? 1 : 0) - (isFeatured(a.entry) ? 1 : 0) || a.index - b.index)
      .filter(({ entry }) => state.platform === "全部" || plainText(entry.platform) === state.platform)
      .filter(({ entry }) => {
        if (!query) return true;
        return [entry.title, entry.version, entry.platform, entry.note, entry.uploader]
          .map((value) => plainText(value).toLowerCase())
          .some((value) => value.includes(query));
      })
      .map(({ entry, index }) => ({ ...entry, _no: index + 1 }));

    if (!state.entries.length) {
      list.innerHTML = emptyState("文件整理中", "大文件整理完成后会出现在这里。你也可以先回首页看看项目。");
      return;
    }
    if (!ordered.length) {
      list.innerHTML = emptyState("没有匹配的文件", "换一个关键词或平台试试。", true);
      return;
    }
    list.innerHTML = `<div class="dl-grid">${ordered.map(card).join("")}</div>`;
  };

  const refreshMeta = () => {
    const count = $("#dlCount");
    if (count) count.textContent = `${state.entries.length} 个条目 · ${countFiles(state.entries)} 个文件`;
    const chips = $("#dlChips");
    if (chips) {
      chips.innerHTML = platformList()
        .map(
          (platform) =>
            `<button class="dl-chip ${platform === state.platform ? "is-active" : ""}" type="button" data-platform="${esc(platform)}">${esc(platform)}</button>`
        )
        .join("");
    }
  };

  const renderShell = () => {
    const chips = $("#dlChips");
    if (chips) {
      chips.addEventListener("click", (event) => {
        const button = event.target.closest("[data-platform]");
        if (!button) return;
        state.platform = button.dataset.platform;
        $$(".dl-chip", chips).forEach((el) => el.classList.toggle("is-active", el.dataset.platform === state.platform));
        update();
      });
    }

    const search = $("#dlSearch");
    if (search) {
      search.addEventListener("input", () => {
        state.query = search.value;
        update();
      });
    }

    const list = $("#downloads-root");
    if (list) {
      list.addEventListener("click", (event) => {
        const copy = event.target.closest("[data-copy]");
        if (copy) {
          copyText(copy.dataset.copy);
          return;
        }
        const reset = event.target.closest("[data-reset]");
        if (reset) {
          state.platform = "全部";
          state.query = "";
          if (search) search.value = "";
          if (chips) $$(".dl-chip", chips).forEach((el) => el.classList.toggle("is-active", el.dataset.platform === "全部"));
          update();
          return;
        }
        const unlock = event.target.closest("[data-unlock]");
        if (unlock) {
          openUnlock(unlock.dataset.unlock, unlock.dataset.title || "文件");
        }
      });
    }

    refreshMeta();
    update();
  };

  const showError = (error) => {
    console.error(error);
    const list = $("#downloads-root");
    if (list) {
      list.innerHTML = `
        <section class="dl-empty">
          <span class="mono">LOAD ERROR</span>
          <h2>内容加载失败</h2>
          <p>${esc(error && error.message ? error.message : "未知错误")}</p>
          <a class="dl-btn dl-btn--ghost" href="./">重新加载</a>
        </section>`;
    }
    const count = $("#dlCount");
    if (count) count.textContent = "加载失败";
  };

  function setStatus(el, message, type = "") {
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", type === "error");
    el.classList.toggle("is-ok", type === "ok");
  }

  function lockScroll() {
    const upload = $("#uploadModal");
    const unlock = $("#unlockModal");
    const open = (upload && !upload.hidden) || (unlock && !unlock.hidden);
    document.documentElement.classList.toggle("is-locked", !!open);
  }

  function toUploadEntry(file) {
    const size = plainText(file.sizeLabel) || formatBytes(file.size);
    return {
      ...file,
      r2: true,
      r2Id: file.id,
      size,
      featured: false,
      files: file.protected
        ? []
        : [
            {
              label: "文件",
              kind: "primary",
              url: `${state.apiBase}/api/files/${encodeURIComponent(file.id)}/download`,
              size,
            },
          ],
    };
  }

  async function loadUploadedEntries() {
    if (!state.apiBase) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const data = await apiFetch("/api/files", { signal: controller.signal });
      return (Array.isArray(data.files) ? data.files : []).map(toUploadEntry);
    } finally {
      clearTimeout(timer);
    }
  }

  function closeUnlock() {
    const modal = $("#unlockModal");
    if (modal) modal.hidden = true;
    state.unlockTarget = null;
    lockScroll();
  }

  function openUnlock(id, title) {
    if (!id) return;
    state.unlockTarget = { id, title };
    const note = $("#unlockNote");
    if (note) note.textContent = `“${title}” 需要上传者设置的文件密码；密码通过服务端校验，不暴露文件直链。`;
    const password = $("#unlockPassword");
    if (password) password.value = "";
    setStatus($("#unlockStatus"), "");
    const modal = $("#unlockModal");
    if (modal) modal.hidden = false;
    lockScroll();
    password && password.focus();
  }

  function showUploadPane() {
    const loginPane = $("#loginPane");
    const uploadPane = $("#uploadPane");
    const signed = !!state.session;
    if (loginPane) loginPane.hidden = signed;
    if (uploadPane) uploadPane.hidden = !signed;
    if (signed) {
      const who = $("#whoami");
      if (who) who.textContent = state.session.username;
    }
  }

  function closeUpload() {
    const modal = $("#uploadModal");
    if (modal) modal.hidden = true;
    lockScroll();
  }

  function openUpload() {
    if (!state.apiBase) return;
    state.session = loadSession();
    const modal = $("#uploadModal");
    if (!modal) return;
    showUploadPane();
    setStatus($("#loginStatus"), "");
    modal.hidden = false;
    lockScroll();
    if (state.session) {
      const file = $("#upFile");
      file && file.focus();
    } else {
      const user = $("#loginUser");
      user && user.focus();
    }
  }

  function putToR2(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 上传失败（HTTP ${xhr.status}）`));
      };
      xhr.onerror = () => reject(new Error("R2 上传网络错误，请检查 CORS 与网络"));
      xhr.ontimeout = () => reject(new Error("R2 上传超时"));
      xhr.send(file);
    });
  }

  function initUploadUi() {
    const openButton = $("#uploadOpen");
    if (!openButton) return;
    openButton.hidden = !state.apiBase;
    if (!state.apiBase || openButton.dataset.bound === "1") return;
    openButton.dataset.bound = "1";
    state.session = loadSession();

    openButton.addEventListener("click", openUpload);
    $("#uploadClose")?.addEventListener("click", closeUpload);
    $("[data-close-upload]")?.addEventListener("click", closeUpload);
    $("#unlockClose")?.addEventListener("click", closeUnlock);
    $("[data-close-unlock]")?.addEventListener("click", closeUnlock);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const upload = $("#uploadModal");
      const unlock = $("#unlockModal");
      if (upload && !upload.hidden) closeUpload();
      if (unlock && !unlock.hidden) closeUnlock();
    });

    const loginForm = $("#loginForm");
    loginForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("#loginStatus");
      const button = loginForm.querySelector('button[type="submit"]');
      const username = plainText($("#loginUser").value);
      const code = plainText($("#loginCode").value);
      if (!username || !code) {
        setStatus(status, "请输入用户名和注册码", "error");
        return;
      }
      if (button) button.disabled = true;
      setStatus(status, "正在验证…");
      try {
        const data = await apiFetch("/api/login", {
          method: "POST",
          json: { username, code },
        });
        state.session = {
          token: data.token,
          username: data.username,
          expiresAt: data.expiresAt,
        };
        saveSession(state.session);
        const codeInput = $("#loginCode");
        if (codeInput) codeInput.value = "";
        setStatus(status, "登录成功", "ok");
        showUploadPane();
        const fileInput = $("#upFile");
        fileInput && fileInput.focus();
      } catch (error) {
        setStatus(status, error.message || "登录失败", "error");
      } finally {
        if (button) button.disabled = false;
      }
    });

    $("#logoutBtn")?.addEventListener("click", () => {
      clearSession();
      state.session = null;
      showUploadPane();
      setStatus($("#uploadStatus"), "");
      const user = $("#loginUser");
      user && user.focus();
    });

    const fileInput = $("#upFile");
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      state.uploadFile = file;
      const meta = $("#uploadFileMeta");
      if (meta) {
        meta.textContent = file
          ? `${file.name} · ${formatBytes(file.size)} · ${file.type || "未知类型"}`
          : "文件会直传 R2，不经过页面服务器。";
      }
      if (file) {
        const title = $("#upTitle");
        if (title && !title.value.trim()) {
          title.value = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
        }
      }
    });

    const uploadForm = $("#uploadForm");
    uploadForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("#uploadStatus");
      const submit = $("#uploadSubmit");
      const progress = $("#uploadProgress");
      const bar = progress ? progress.querySelector("i") : null;
      if (!state.apiBase) {
        setStatus(status, "上传服务未配置", "error");
        return;
      }
      state.session = loadSession();
      if (!state.session) {
        showUploadPane();
        setStatus(status, "登录已过期，请重新登录", "error");
        return;
      }
      const file = state.uploadFile || (fileInput && fileInput.files ? fileInput.files[0] : null);
      if (!file) {
        setStatus(status, "请选择文件", "error");
        return;
      }
      const max = 5 * 1024 * 1024 * 1024;
      if (file.size > max) {
        setStatus(status, `文件超过 ${formatBytes(max)}`, "error");
        return;
      }
      if (submit) submit.disabled = true;
      if (progress) progress.hidden = false;
      if (bar) bar.style.width = "0%";
      setStatus(status, "正在初始化上传…");
      try {
        const init = await apiFetch("/api/uploads/init", {
          method: "POST",
          json: {
            filename: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            title: plainText($("#upTitle").value) || file.name,
            version: plainText($("#upVersion").value),
            platform: $("#upPlatform").value,
            note: plainText($("#upNote").value),
            password: $("#upPassword").value,
          },
        });
        setStatus(status, "正在上传到 R2…");
        await putToR2(init.uploadUrl, file, (ratio) => {
          if (bar) bar.style.width = `${Math.round(ratio * 100)}%`;
          setStatus(status, `正在上传… ${Math.round(ratio * 100)}%`);
        });
        setStatus(status, "正在登记文件…");
        await apiFetch("/api/uploads/complete", { method: "POST", json: { id: init.id } });
        if (bar) bar.style.width = "100%";
        setStatus(status, "上传完成，正在刷新列表…", "ok");
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        if (error.status === 401) {
          clearSession();
          state.session = null;
          showUploadPane();
          setStatus(status, "登录已过期，请重新登录", "error");
        } else {
          setStatus(status, error.message || "上传失败", "error");
        }
      } finally {
        if (submit) submit.disabled = false;
        if (progress) progress.hidden = true;
      }
    });

    const unlockForm = $("#unlockForm");
    unlockForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const target = state.unlockTarget;
      const status = $("#unlockStatus");
      const password = $("#unlockPassword").value;
      if (!target || !state.apiBase) {
        setStatus(status, "下载服务未配置", "error");
        return;
      }
      const button = unlockForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      setStatus(status, "正在验证密码…");
      try {
        const data = await apiFetch(`/api/files/${encodeURIComponent(target.id)}/unlock`, {
          method: "POST",
          json: { password },
        });
        const token = data && data.token;
        const url = `${state.apiBase}/api/files/${encodeURIComponent(target.id)}/download${
          token ? `?token=${encodeURIComponent(token)}` : ""
        }`;
        closeUnlock();
        window.location.href = url;
      } catch (error) {
        setStatus(status, error.message || "密码不正确", "error");
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  const start = async () => {
    try {
      const response = await fetch(`../content/site.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.json();
      state.apiBase = safeApiBase(content.downloadsApi);
      state.session = loadSession();
      const staticEntries = (Array.isArray(content.downloads) ? content.downloads : []).filter(
        (entry) => entry && entry.title
      );
      state.entries = staticEntries;
      renderShell();
      initUploadUi();
      if (state.apiBase) {
        loadUploadedEntries()
          .then((uploaded) => {
            if (!uploaded.length) return;
            state.entries = [...staticEntries, ...uploaded];
            refreshMeta();
            update();
          })
          .catch((error) => console.warn("上传服务加载失败", error));
      }
    } catch (error) {
      showError(error);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
