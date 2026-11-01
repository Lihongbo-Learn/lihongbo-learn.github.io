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

  const state = {
    entries: [],
    platform: "全部",
    query: "",
    toastTimer: 0,
  };

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
    entries.reduce((sum, entry) => sum + (Array.isArray(entry.files) ? entry.files.length : 0), 0);

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
    return `
      <div class="dl-file">
        <div>
          <span class="dl-file-label">${esc(label)}</span>
          ${size ? `<span class="dl-file-size mono">${esc(size)}</span>` : ""}
        </div>
        <div class="dl-file-actions">
          <a class="dl-mini" href="${esc(file.url)}" target="_blank" rel="noopener">下载 ↗</a>
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

    return `
      <article class="dl-card ${featured ? "is-featured" : ""}">
        <header class="dl-card-head">
          <span class="mono">DL ${pad(no)} / ${esc(platform)}</span>
          ${featured ? `<span class="dl-badge">推荐</span>` : `<span class="mono">${pad(files.length)} FILES</span>`}
        </header>
        <h2 class="dl-title">${esc(entry.title)}${version ? `<em>v${esc(version.replace(/^v/i, ""))}</em>` : ""}</h2>
        <div class="dl-meta mono">
          ${entry.size ? `<span>${esc(entry.size)}</span>` : ""}
          ${entry.date ? `<span>${esc(entry.date)}</span>` : ""}
          ${platform ? `<span>${esc(platform)}</span>` : ""}
        </div>
        ${entry.note ? `<p class="dl-note">${esc(entry.note)}</p>` : ""}
        ${
          primary
            ? `<div class="dl-actions">
                <a class="dl-btn" href="${esc(primary.url)}" target="_blank" rel="noopener">下载 ${esc(primary.label || "")} <span aria-hidden="true">↓</span></a>
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
        return [entry.title, entry.version, entry.platform, entry.note]
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

  const renderShell = () => {
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
        }
      });
    }

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

  const start = async () => {
    try {
      const response = await fetch(`../content/site.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.json();
      state.entries = (Array.isArray(content.downloads) ? content.downloads : []).filter((entry) => entry && entry.title);
      renderShell();
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
