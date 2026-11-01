/* ============================================================
   宛枯缘梦 Studio — admin (static, GitHub Contents API)
   ============================================================ */
(() => {
  "use strict";

  const OWNER = "Lihongbo-Learn";
  const REPO = "lihongbo-learn.github.io";
  const PATH = "content/site.json";
  const API = "https://api.github.com";
  const TOKEN_KEY = "lh_admin_token";

  const state = {
    token: "",
    remember: true,
    branch: "main",
    content: null,
    sha: null,
    tab: "site",
    dirty: false,
    saving: false,
  };

  let uid = 0;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  const pad = (n) => String(n).padStart(2, "0");
  const str = (value, fallback = "") => (value == null ? fallback : String(value));
  const arr = (value) => (Array.isArray(value) ? value : []);
  const nextId = () => `f${++uid}`;

  const gate = $("#gate");
  const app = $("#app");
  const panel = $("#panel");
  const statusEl = $("#status");
  const saveBtn = $("#saveBtn");
  const messageEl = $("#message");
  const toastEl = $("#toast");

  /* ---------- encoding / api ---------- */
  function b64encode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function b64decode(text) {
    const binary = atob(String(text || "").replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }

  async function gh(path, options = {}) {
    const headers = {
      Authorization: `Bearer ${state.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(API + path, { ...options, headers });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const data = await response.json();
        if (data && data.message) message = `${response.status} · ${data.message}`;
      } catch (error) {
        /* ignore */
      }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  const contentsPath = () => `/repos/${OWNER}/${REPO}/contents/${PATH}`;

  function describeError(error) {
    const status = error && error.status;
    if (status === 401) return "Token 无效或已过期。请在「账户与仓库」中更换 Token。";
    if (status === 403) return "GitHub 拒绝写入：细粒度 Token 需要 Contents → Read and write 权限。";
    if (status === 404) return "找不到仓库或内容文件。请确认仓库名、分支，以及 Token 是否被授权访问该仓库。";
    if (status === 409) return "内容冲突：仓库里的文件刚被修改过，请重新载入后再保存。";
    if (status === 422) return "GitHub 校验失败（可能是文件过大或路径非法）。";
    if (status === 429) return "请求过于频繁，请稍后再试。";
    return (error && error.message) || "未知错误";
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  }

  function showMessage(text, options = {}) {
    const { error = false, link = "", timeout = 0 } = options;
    messageEl.hidden = false;
    messageEl.classList.toggle("is-error", !!error);
    messageEl.innerHTML = `
      <span>${esc(text)}${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">查看 commit ↗</a>` : ""}</span>
      <button type="button" id="messageClose">关闭</button>`;
    const close = $("#messageClose");
    close && close.addEventListener("click", () => (messageEl.hidden = true));
    clearTimeout(showMessage._timer);
    if (timeout) showMessage._timer = setTimeout(() => (messageEl.hidden = true), timeout);
  }

  function hideMessage() {
    messageEl.hidden = true;
  }

  /* ---------- paths ---------- */
  function setPath(target, path, value) {
    const keys = String(path).split(".");
    let cursor = target;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      const next = keys[i + 1];
      if (cursor[key] == null || typeof cursor[key] !== "object") {
        cursor[key] = /^\d+$/.test(next) ? [] : {};
      }
      cursor = cursor[key];
    }
    cursor[keys[keys.length - 1]] = value;
  }

  function assetUrl(value) {
    const raw = str(value).trim();
    if (!raw) return "";
    if (/^https?:/i.test(raw)) return raw;
    if (raw.startsWith("/")) return `..${raw}`;
    return `../${raw.replace(/^\.\//, "")}`;
  }

  function moveItem(list, index, dir) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(target, 0, item);
  }

  /* ---------- field builders ---------- */
  function field(label, path, value, options = {}) {
    const id = nextId();
    return `
      <div class="field ${options.full ? "field--full" : ""}">
        <label for="${id}">${esc(label)}</label>
        <input class="adm-input" id="${id}" data-bind="${esc(path)}" value="${esc(str(value))}"
          ${options.type ? `type="${esc(options.type)}"` : ""}
          ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ""}>
        ${options.hint ? `<span class="hint">${esc(options.hint)}</span>` : ""}
      </div>`;
  }

  function textarea(label, path, value, options = {}) {
    const id = nextId();
    return `
      <div class="field ${options.full === false ? "" : "field--full"}">
        <label for="${id}">${esc(label)}</label>
        <textarea class="adm-input" id="${id}" data-bind="${esc(path)}" rows="${options.rows || 4}"
          ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ""}>${esc(str(value))}</textarea>
        ${options.hint ? `<span class="hint">${esc(options.hint)}</span>` : ""}
      </div>`;
  }

  function linesField(label, path, value, options = {}) {
    const id = nextId();
    const text = arr(value).join("\n");
    return `
      <div class="field field--full">
        <label for="${id}">${esc(label)}</label>
        <textarea class="adm-input" id="${id}" data-bind="${esc(path)}" data-kind="lines" rows="${options.rows || 5}"
          ${options.placeholder ? `placeholder="${esc(options.placeholder)}"` : ""}>${esc(text)}</textarea>
        <span class="hint">${esc(options.hint || "一行一条。")}</span>
      </div>`;
  }

  function selectField(label, path, value, options) {
    const id = nextId();
    return `
      <div class="field">
        <label for="${id}">${esc(label)}</label>
        <select class="adm-input" id="${id}" data-bind="${esc(path)}">
          ${options
            .map(
              (opt) =>
                `<option value="${esc(opt.value)}" ${String(value) === String(opt.value) ? "selected" : ""}>${esc(opt.label)}</option>`
            )
            .join("")}
        </select>
      </div>`;
  }

  function previewThumb(value, accept) {
    if (!value) return `<span>NO FILE</span>`;
    if (String(accept).includes("pdf")) return `<span>PDF</span>`;
    return `<img src="${esc(assetUrl(value))}" alt="" loading="lazy">`;
  }

  function fileField(label, path, value, options = {}) {
    const accept = options.accept || "image/*";
    return `
      <div class="field field--full">
        <span class="field-label">${esc(label)}</span>
        <div class="file-field" data-file data-path="${esc(path)}">
          <div class="file-thumb" data-thumb>${previewThumb(value, accept)}</div>
          <div class="file-body">
            <input class="adm-input" data-bind="${esc(path)}" value="${esc(str(value))}" placeholder="${esc(options.placeholder || "assets/img/… 或直接上传")}">
            <div class="file-actions">
              <label class="upload-label">上传文件
                <input class="file-input" type="file" accept="${esc(accept)}">
              </label>
              <span class="file-status mono">${value ? "已设置" : "尚未设置"}</span>
            </div>
            <span class="hint">${esc(options.hint || "上传后会立即提交到仓库，点击右上角保存后页面生效。")}</span>
          </div>
        </div>
      </div>`;
  }

  function grid(inner, columns = 2) {
    return `<div class="grid ${columns === 3 ? "grid--3" : ""}">${inner}</div>`;
  }

  function group(title, inner, note = "") {
    return `
      <section class="group">
        <div class="group-head">
          <h3>${esc(title)}</h3>
          ${note ? `<span class="mono">${esc(note)}</span>` : ""}
        </div>
        ${inner}
      </section>`;
  }

  function tabHead(no, title, description) {
    return `
      <div class="tab-head">
        <span class="mono">${esc(no)} / EDIT</span>
        <h2>${esc(title)}</h2>
        <p>${esc(description)}</p>
      </div>`;
  }

  /* ---------- panels ---------- */
  function panelSite() {
    const c = state.content;
    return (
      tabHead("01", "站点", "站点标题、期号与描述。修改后按右上角「保存并发布」。") +
      group(
        "站点信息",
        grid(
          field("站点标题", "meta.title", c.meta && c.meta.title, { full: true, hint: "浏览器标签页与分享卡片标题。" }) +
            textarea("站点描述", "meta.description", c.meta && c.meta.description, { rows: 3 }) +
            field("期号 Issue", "meta.issue", c.meta && c.meta.issue, { placeholder: "01" }) +
            field("年份", "meta.year", c.meta && c.meta.year, { placeholder: "2026" })
        )
      )
    );
  }

  function panelHero() {
    const h = state.content.hero || {};
    const ctas = arr(h.cta);
    const cta1 = ctas[0] || {};
    const cta2 = ctas[1] || {};
    return (
      tabHead("02", "首屏", "中文名、拼音、打字机与头像。首屏背景会使用头像生成一层模糊光晕。") +
      group(
        "名字与标语",
        grid(
          field("首屏中文名字", "hero.name", h.name, { hint: "建议 2–6 个汉字，会逐字入场。" }) +
            field("拼音行", "hero.nameLatin", h.nameLatin, { hint: "全大写效果最佳；会响应鼠标做字宽变化。" }) +
            field("问候语", "hero.greeting", h.greeting) +
            field("题记 / Motto", "hero.motto", h.motto) +
            textarea("一句话主张", "hero.tagline", h.tagline, { rows: 2 }) +
            field("地点 / 年份", "hero.location", h.location)
        )
      ) +
      group(
        "身份标签",
        linesField("角色标签", "hero.roles", h.roles, {
          rows: 4,
          hint: "一行一条，显示为胶囊标签。",
        })
      ) +
      group(
        "打字机",
        grid(
          field("前缀", "hero.typingPrefix", h.typingPrefix, { placeholder: "正在" }) +
            linesField("循环短句", "hero.typing", h.typing, {
              rows: 4,
              hint: "一行一条，逐字打出。",
            })
        )
      ) +
      group(
        "按钮",
        grid(
          field("主按钮文字", "hero.cta.0.label", cta1.label) +
            field("主按钮链接", "hero.cta.0.href", cta1.href, { placeholder: "#works" }) +
            field("次按钮文字", "hero.cta.1.label", cta2.label) +
            field("次按钮链接", "hero.cta.1.href", cta2.href, { placeholder: "#about" })
        )
      ) +
      group(
        "头像与补充",
        grid(
          fileField("头像", "hero.avatar", h.avatar, {
            accept: "image/*",
            hint: "方形图片最佳。会同时用于首屏光晕与左侧资料卡。",
          }) + textarea("补充说明", "hero.note", h.note, { rows: 3 })
        )
      )
    );
  }

  function newProject() {
    return {
      id: `project-${Date.now()}`,
      title: "新项目",
      titleCn: "",
      category: "",
      year: String(new Date().getFullYear()),
      image: "",
      summary: "",
      links: [],
      credits: [],
    };
  }

  function panelProjects() {
    const projects = arr(state.content.projects);
    const cards = projects
      .map((project, pi) => {
        const links = arr(project.links);
        const credits = arr(project.credits);

        const linkRows = links
          .map(
            (link, i) => `
            <div class="row-item">
              <input class="adm-input" data-bind="projects.${pi}.links.${i}.label" value="${esc(link.label)}" placeholder="标签，如 官网 / GitHub">
              <input class="adm-input" data-bind="projects.${pi}.links.${i}.url" value="${esc(link.url)}" placeholder="https://">
              <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-link" data-pi="${pi}" data-i="${i}">删除</button>
            </div>`
          )
          .join("");

        const creditRows = credits
          .map(
            (credit, i) => `
            <div class="row-item row-item--credit">
              <input class="adm-input" data-bind="projects.${pi}.credits.${i}.label" value="${esc(credit.label)}" placeholder="如 设计 / 开发">
              <input class="adm-input" data-bind="projects.${pi}.credits.${i}.value" value="${esc(credit.value)}" placeholder="如 宛枯缘梦">
              <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-credit" data-pi="${pi}" data-i="${i}">删除</button>
            </div>`
          )
          .join("");

        return `
          <article class="card">
            <div class="card-head">
              <h4><span>PROJECT ${pad(pi + 1)}</span>${esc(project.title || "未命名")}</h4>
              <div class="card-actions">
                <button class="adm-btn adm-btn--sm" type="button" data-action="move-project" data-pi="${pi}" data-dir="-1">上移</button>
                <button class="adm-btn adm-btn--sm" type="button" data-action="move-project" data-pi="${pi}" data-dir="1">下移</button>
                <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-project" data-pi="${pi}">删除项目</button>
              </div>
            </div>
            ${grid(
              field("英文标题", `projects.${pi}.title`, project.title) +
                field("中文标题", `projects.${pi}.titleCn`, project.titleCn) +
                field("类别", `projects.${pi}.category`, project.category, { placeholder: "产品 · 标识 · 前端" }) +
                field("年份", `projects.${pi}.year`, project.year) +
                textarea("项目摘要", `projects.${pi}.summary`, project.summary, { rows: 3 }) +
                field("锚点 ID", `projects.${pi}.id`, project.id, { hint: "用于链接与统计，可留空。" }) +
                fileField("项目封面图", `projects.${pi}.image`, project.image, {
                  accept: "image/*",
                  hint: "图标 / 矢量导出图 / 作品实拍均可，不要使用界面截图。留空时显示中文首字。",
                })
            )}
            <div class="subcard">
              <div class="subcard-head">
                <span class="mono">LINKS / 外部链接</span>
                <button class="adm-btn adm-btn--sm" type="button" data-action="add-link" data-pi="${pi}">+ 添加链接</button>
              </div>
              <div class="row-list">${linkRows || `<p class="empty-note">还没有链接。</p>`}</div>
            </div>
            <div class="subcard">
              <div class="subcard-head">
                <span class="mono">CREDITS / 署名</span>
                <button class="adm-btn adm-btn--sm" type="button" data-action="add-credit" data-pi="${pi}">+ 添加署名</button>
              </div>
              <div class="row-list">${creditRows || `<p class="empty-note">还没有署名。</p>`}</div>
            </div>
          </article>`;
      })
      .join("");

    return (
      tabHead("03", "项目", "项目名称、摘要、封面、官网 / GitHub 链接与署名。作品图请勿使用界面截图；优先用品牌资产或实拍。") +
      (cards || `<p class="empty-note">还没有项目。</p>`) +
      `<button class="add-btn" type="button" data-action="add-project">+ 添加一个项目</button>`
    );
  }

  function panelSpecimen() {
    const s = state.content.specimen || {};
    return (
      tabHead("04", "字体样张", "首页的可拖拽样张卡片与 PDF 下载。PDF 文件可直接上传替换。") +
      group(
        "样张信息",
        grid(
          field("副标题", "specimen.subtitle", s.subtitle) +
            textarea("正文", "specimen.body", s.body, { rows: 4 }) +
            linesField("循环字样", "specimen.lines", s.lines, {
              rows: 5,
              hint: "一行一条，样张卡片右下角会循环切换。第一条通常留作 Aa。",
            })
        )
      ) +
      group(
        "PDF",
        grid(
          fileField("样张 PDF", "specimen.pdf", s.pdf, {
            accept: "application/pdf",
            hint: "A4 / 字体已嵌入。上传后保存，首页按钮会更新。",
          }) + field("PDF 说明", "specimen.note", s.note)
        )
      )
    );
  }

  function panelPalette() {
    const palette = arr(state.content.palette);
    const rows = palette
      .map(
        (color, i) => `
        <div class="color-row">
          <input type="color" value="${esc(color.hex || "#14120f")}" data-bind="palette.${i}.hex" aria-label="取色">
          <input class="adm-input" data-bind="palette.${i}.name" value="${esc(color.name)}" placeholder="Paper">
          <input class="adm-input" data-bind="palette.${i}.cn" value="${esc(color.cn)}" placeholder="纸白">
          <input class="adm-input color-chip" data-bind="palette.${i}.hex" data-color-text value="${esc(color.hex)}" placeholder="#F2EFE6">
          <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-palette" data-i="${i}">删除</button>
        </div>`
      )
      .join("");

    return (
      tabHead("05", "色板", "首页胶片色卡。点击色卡会复制色值；这里的顺序就是胶片顺序。") +
      group(
        "油墨",
        rows || `<p class="empty-note">还没有色卡。</p>`,
        `${palette.length} COLORS`
      ) +
      `<button class="add-btn" type="button" data-action="add-palette">+ 添加色卡</button>`
    );
  }

  function newTalk() {
    return {
      title: "新分享",
      event: "分享活动",
      date: String(new Date().getFullYear()),
      video: "",
      poster: "",
      note: "",
    };
  }

  function panelTalks() {
    const talks = arr(state.content.talks);
    const cards = talks
      .map(
        (talk, i) => `
        <article class="card">
          <div class="card-head">
            <h4><span>TALK ${pad(i + 1)}</span>${esc(talk.title || "未命名")}</h4>
            <div class="card-actions">
              <button class="adm-btn adm-btn--sm" type="button" data-action="move-talk" data-i="${i}" data-dir="-1">上移</button>
              <button class="adm-btn adm-btn--sm" type="button" data-action="move-talk" data-i="${i}" data-dir="1">下移</button>
              <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-talk" data-i="${i}">删除</button>
            </div>
          </div>
          ${grid(
            field("标题", `talks.${i}.title`, talk.title) +
              field("活动 / 场合", `talks.${i}.event`, talk.event) +
              field("日期", `talks.${i}.date`, talk.date) +
              field("视频链接", `talks.${i}.video`, talk.video, {
                full: true,
                placeholder: "https://... 支持 MP4 / YouTube / Bilibili",
                hint: "留空时显示「录音整理中」。B 站直接粘贴视频页链接即可。",
              }) +
              textarea("简介", `talks.${i}.note`, talk.note, { rows: 3 }) +
              fileField("海报图（可选）", `talks.${i}.poster`, talk.poster, {
                accept: "image/*",
                hint: "不要使用界面截图。留空会显示自动排版的讲座海报；16:9 最佳。",
              })
          )}
        </article>`
      )
      .join("");

    return (
      tabHead("04", "讲座", "内嵌视频：支持 MP4、YouTube 与 Bilibili 链接；没有视频时自动显示占位版式。") +
      (cards || `<p class="empty-note">还没有讲座记录。</p>`) +
      `<button class="add-btn" type="button" data-action="add-talk">+ 添加讲座</button>`
    );
  }

  function newDownload() {
    return {
      id: `download-${Date.now()}`,
      title: "新文件",
      version: "",
      platform: "Windows",
      date: new Date().toISOString().slice(0, 10),
      size: "",
      note: "",
      featured: false,
      files: [{ label: "主文件", kind: "primary", url: "", size: "", sha256: "" }],
    };
  }

  function panelDownloads() {
    const downloads = arr(state.content.downloads);
    const cards = downloads
      .map((item, di) => {
        const files = arr(item.files);
        const fileCards = files
          .map(
            (file, fi) => `
          <div class="subcard">
            <div class="subcard-head">
              <span class="mono">FILE ${pad(fi + 1)} / ${esc(file.kind || "primary")}</span>
              <div class="card-actions">
                <button class="adm-btn adm-btn--sm" type="button" data-action="move-download-file" data-di="${di}" data-fi="${fi}" data-dir="-1">上移</button>
                <button class="adm-btn adm-btn--sm" type="button" data-action="move-download-file" data-di="${di}" data-fi="${fi}" data-dir="1">下移</button>
                <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-download-file" data-di="${di}" data-fi="${fi}">删除</button>
              </div>
            </div>
            ${grid(
              field("文件标签", `downloads.${di}.files.${fi}.label`, file.label, {
                placeholder: "安装程序 / 分卷 1/3 / 镜像 · OneDrive",
              }) +
                selectField("类型", `downloads.${di}.files.${fi}.kind`, file.kind || "primary", [
                  { value: "primary", label: "主文件" },
                  { value: "part", label: "分卷" },
                  { value: "mirror", label: "镜像 / 其他" },
                ]) +
                field("显示大小", `downloads.${di}.files.${fi}.size`, file.size, { placeholder: "1.8 GB" }) +
                field("下载直链", `downloads.${di}.files.${fi}.url`, file.url, {
                  full: true,
                  placeholder: "https://github.com/.../releases/download/...",
                  hint: "GitHub 直链会自动生成 gh-proxy.org 镜像，无需另填。",
                }) +
                field("SHA-256（可选）", `downloads.${di}.files.${fi}.sha256`, file.sha256, { full: true })
            )}
          </div>`
          )
          .join("");

        return `
          <article class="card">
            <div class="card-head">
              <h4><span>DOWNLOAD ${pad(di + 1)}</span>${esc(item.title || "未命名")}</h4>
              <div class="card-actions">
                <button class="adm-btn adm-btn--sm" type="button" data-action="move-download" data-di="${di}" data-dir="-1">上移</button>
                <button class="adm-btn adm-btn--sm" type="button" data-action="move-download" data-di="${di}" data-dir="1">下移</button>
                <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="remove-download" data-di="${di}">删除条目</button>
              </div>
            </div>
            ${grid(
              field("标题", `downloads.${di}.title`, item.title) +
                field("版本", `downloads.${di}.version`, item.version) +
                field("平台", `downloads.${di}.platform`, item.platform, { placeholder: "Windows / Android / Linux" }) +
                field("日期", `downloads.${di}.date`, item.date, { placeholder: "2026-11-01" }) +
                field("总大小", `downloads.${di}.size`, item.size, { placeholder: "1.8 GB" }) +
                selectField(
                  "推荐",
                  `downloads.${di}.featured`,
                  item.featured === true || item.featured === "true" ? "true" : "false",
                  [
                    { value: "false", label: "否" },
                    { value: "true", label: "推荐" },
                  ]
                ) +
                field("锚点 ID", `downloads.${di}.id`, item.id, { hint: "用于链接与统计，可留空。" }) +
                textarea("说明", `downloads.${di}.note`, item.note, { rows: 3 })
            )}
            <div class="subcard">
              <div class="subcard-head">
                <span class="mono">FILES / 文件（${files.length}）</span>
                <button class="adm-btn adm-btn--sm" type="button" data-action="add-download-file" data-di="${di}">+ 添加文件</button>
              </div>
              ${fileCards || `<p class="empty-note">还没有文件。至少需要一个主文件。</p>`}
            </div>
          </article>`;
      })
      .join("");

    const guide = `
      <div class="note-box">
        <p><b>文件本身不经过后台。</b>请先在 GitHub Releases 上传附件，再把直链填到这里。后台只保存索引、大小与校验值。</p>
        <p><b>加速镜像：</b>下载页会自动为所有 github.com 文件追加 <code>gh-proxy.org</code> 镜像，当前和以后新增的文件都无需另填；原始 GitHub 链接仍保留。</p>
        <ol>
          <li>打开 <a href="https://github.com/Lihongbo-Learn/lihongbo-learn.github.io/releases/new" target="_blank" rel="noopener">Releases → Draft a new release</a>。</li>
          <li>Tag 例如 <code>v1.4.0</code>；单个附件必须小于 2 GiB（2,147,483,648 字节）。</li>
          <li>超过 2 GB 用 7-Zip 分卷（每卷小于 2 GiB），所有分卷上传到同一个 Release。</li>
          <li>发布后复制附件直链：<code>https://github.com/&lt;owner&gt;/&lt;repo&gt;/releases/download/&lt;tag&gt;/&lt;asset&gt;</code>。</li>
          <li>计算 SHA-256：Windows <code>certutil -hashfile 文件 SHA256</code>；macOS/Linux <code>sha256sum 文件</code>。</li>
          <li>回到这里填写文件条目，保存发布；下载页通常 1–2 分钟后更新。</li>
        </ol>
      </div>`;

    return (
      tabHead("04", "下载", "管理下载站的文件条目与直链。大文件请上传到 GitHub Releases，后台只保存索引与校验信息。") +
      (cards || `<p class="empty-note">还没有下载条目。</p>`) +
      `<button class="add-btn" type="button" data-action="add-download">+ 添加文件条目</button>` +
      group("发布流程 / RELEASES", guide)
    );
  }

  function panelContact() {
    const c = state.content.contact || {};
    return (
      tabHead("05", "联系", "邮箱、GitHub 与页脚版权说明。邮箱会同时出现在资料卡与页脚。") +
      group(
        "联系方式",
        grid(
          field("邮箱", "contact.email", c.email, { type: "email" }) +
            field("GitHub", "contact.github", c.github, { placeholder: "https://github.com/…" }) +
            textarea("招呼语", "contact.note", c.note, { rows: 3 }) +
            field("状态行", "contact.availability", c.availability, { placeholder: "OPEN FOR COLLABORATION — 2026" })
        )
      ) +
      group(
        "页脚 / COLOPHON",
        grid(textarea("页脚说明", "contact.footer", c.footer, { rows: 4 }))
      )
    );
  }

  function maskedToken(token) {
    if (!token) return "—";
    if (token.length < 18) return token;
    return `${token.slice(0, 10)}…${token.slice(-4)}`;
  }

  function panelAccount() {
    return (
      tabHead("06", "账户与仓库", "Token 只保存在本机浏览器；它等同于这个仓库的写权限，请不要分享。") +
      group(
        "仓库",
        `<dl class="kv">
          <dt>OWNER</dt><dd>${esc(OWNER)}</dd>
          <dt>REPOSITORY</dt><dd>${esc(REPO)}</dd>
          <dt>BRANCH</dt><dd>${esc(state.branch)}</dd>
          <dt>CONTENT</dt><dd>${esc(PATH)}</dd>
          <dt>LATEST SHA</dt><dd>${esc(state.sha ? state.sha.slice(0, 12) : "—")}</dd>
          <dt>SITE</dt><dd><a href="https://lihongbo-learn.github.io/" target="_blank" rel="noopener">lihongbo-learn.github.io ↗</a></dd>
        </dl>
        <div class="link-line">
          <a href="https://github.com/${OWNER}/${REPO}" target="_blank" rel="noopener">仓库 ↗</a>
          <a href="https://github.com/${OWNER}/${REPO}/commits/${encodeURIComponent(state.branch)}" target="_blank" rel="noopener">提交历史 ↗</a>
          <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">管理 Token ↗</a>
        </div>`
      ) +
      group(
        "当前 Token",
        `<div class="token-box">
          <code>${esc(maskedToken(state.token))}</code>
          <button class="adm-btn adm-btn--sm adm-btn--danger" type="button" data-action="clear-token">清除并退出</button>
        </div>
        <div class="note-box">
          Token 存在 ${localStorage.getItem(TOKEN_KEY) ? "localStorage（此设备长期记住）" : "sessionStorage（关闭浏览器后失效）"}。
          建议每 90 天更换一次。
        </div>`
      ) +
      group(
        "更换 Token",
        `<div class="grid">
          <div class="field field--full">
            <label for="newTokenInput">新的 Fine-grained Token</label>
            <input class="adm-input" id="newTokenInput" type="password" placeholder="github_pat_..." spellcheck="false">
            <span class="hint">权限：Contents → Read and write；Repository access 只选本仓库。</span>
          </div>
        </div>
        <div style="margin-top:14px">
          <button class="adm-btn" type="button" data-action="change-token">验证并更换</button>
        </div>
        <div class="note-box">
          如何创建：
          <ol>
            <li>进入 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens。</li>
            <li>Repository access 选择 Only select repositories，只勾选 ${esc(REPO)}。</li>
            <li>Permissions → Repository permissions → Contents 设为 Read and write。</li>
            <li>生成后粘贴到上方；Token 不会写入仓库。</li>
          </ol>
        </div>`
      )
    );
  }

  const panels = {
    site: panelSite,
    hero: panelHero,
    projects: panelProjects,
    downloads: panelDownloads,
    contact: panelContact,
    account: panelAccount,
  };

  function renderTab() {
    if (!state.content) return;
    $$("#nav button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === state.tab);
    });
    const render = panels[state.tab] || panels.site;
    panel.innerHTML = render();
  }

  function renderKeepingScroll() {
    const y = window.scrollY;
    renderTab();
    window.scrollTo(0, y);
  }

  /* ---------- state UI ---------- */
  function updateStatus() {
    if (!state.content) {
      statusEl.textContent = "未连接";
      statusEl.className = "adm-status";
      return;
    }
    if (state.dirty) {
      statusEl.textContent = "有未保存的修改";
      statusEl.className = "adm-status is-dirty";
    } else {
      statusEl.textContent = `已连接 · ${state.branch} · ${state.sha ? state.sha.slice(0, 7) : ""}`;
      statusEl.className = "adm-status is-live";
    }
  }

  function updateSaveButton() {
    saveBtn.disabled = !state.content || state.saving;
    saveBtn.textContent = state.saving ? "保存中…" : "保存并发布";
  }

  function markDirty() {
    if (!state.dirty) {
      state.dirty = true;
      updateStatus();
    }
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
    $("#sideBranch").textContent = `BRANCH ${state.branch}`;
    updateStatus();
    updateSaveButton();
    renderTab();
  }

  function showGate(errorText = "") {
    app.hidden = true;
    gate.hidden = false;
    saveBtn.disabled = true;
    statusEl.textContent = "未连接";
    statusEl.className = "adm-status";
    const errorEl = $("#gateError");
    if (errorText) {
      errorEl.hidden = false;
      errorEl.textContent = errorText;
    } else {
      errorEl.hidden = true;
    }
  }

  /* ---------- connect / load / save ---------- */
  async function connect(token, options = {}) {
    const { remember = true, silent = false } = options;
    if (!token) return;
    state.token = token.trim();
    state.remember = remember;
    if (silent) {
      statusEl.textContent = "正在连接…";
    }
    try {
      const repo = await gh(`/repos/${OWNER}/${REPO}`);
      state.branch = repo.default_branch || "main";
      const file = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(state.branch)}`);
      state.sha = file.sha;
      const parsed = JSON.parse(b64decode(file.content));
      if (!parsed || !parsed.meta) throw new Error("内容文件结构异常");
      state.content = parsed;
      state.dirty = false;

      if (remember) {
        localStorage.setItem(TOKEN_KEY, state.token);
        sessionStorage.removeItem(TOKEN_KEY);
      } else {
        sessionStorage.setItem(TOKEN_KEY, state.token);
        localStorage.removeItem(TOKEN_KEY);
      }
      hideMessage();
      showApp();
      if (!silent) toast("已连接仓库");
    } catch (error) {
      console.error(error);
      if (silent) {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      }
      const message = describeError(error);
      if (gate.hidden) {
        showMessage(`连接失败：${message}`, { error: true });
        showGate(message);
      } else {
        showGate(message);
      }
    }
  }

  async function reloadContent() {
    if (!state.token) return;
    if (state.dirty && !window.confirm("放弃未保存的修改，重新从 GitHub 载入？")) return;
    try {
      const file = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(state.branch)}`);
      state.content = JSON.parse(b64decode(file.content));
      state.sha = file.sha;
      state.dirty = false;
      hideMessage();
      renderTab();
      updateStatus();
      toast("已重新载入");
    } catch (error) {
      showMessage(`载入失败：${describeError(error)}`, { error: true });
    }
  }

  async function save() {
    if (!state.content || state.saving) return;
    state.saving = true;
    updateSaveButton();
    hideMessage();
    try {
      let sha = null;
      try {
        const latest = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(state.branch)}`);
        sha = latest.sha;
      } catch (error) {
        if (error.status !== 404) throw error;
      }

      const payload = {
        message: `content: update site (${new Date().toISOString()})`,
        content: b64encode(JSON.stringify(state.content, null, 2) + "\n"),
        branch: state.branch,
      };
      if (sha) payload.sha = sha;

      let result;
      try {
        result = await gh(contentsPath(), { method: "PUT", body: JSON.stringify(payload) });
      } catch (error) {
        if (error.status === 409 && sha) {
          const latest = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(state.branch)}`);
          payload.sha = latest.sha;
          result = await gh(contentsPath(), { method: "PUT", body: JSON.stringify(payload) });
        } else {
          throw error;
        }
      }

      state.sha = result.content.sha;
      state.dirty = false;
      updateStatus();

      const commit = result.commit && result.commit.sha ? result.commit.sha.slice(0, 7) : "";
      const url = result.commit && result.commit.html_url ? result.commit.html_url : "";
      showMessage(`已发布 ${commit} — GitHub Pages 正在重建，通常 1–2 分钟生效（CDN 可能再缓存约 10 分钟）。`, {
        link: url,
        timeout: 20000,
      });
      toast("已保存并发布");
    } catch (error) {
      console.error(error);
      showMessage(`保存失败：${describeError(error)}`, { error: true });
      toast("保存失败");
    } finally {
      state.saving = false;
      updateSaveButton();
    }
  }

  /* ---------- uploads ---------- */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
      reader.readAsDataURL(file);
    });
  }

  function safeFileName(name) {
    return (
      String(name)
        .toLowerCase()
        .replace(/[^\w.\-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "asset"
    );
  }

  async function uploadFile(file, statusNode) {
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("文件超过 25MB，请先压缩或裁剪。");
    }
    const name = safeFileName(file.name);
    const path = `uploads/${Date.now()}-${name}`;
    const content = await fileToBase64(file);
    if (statusNode) statusNode.textContent = "上传中…";
    await gh(`/repos/${OWNER}/${REPO}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `asset: add ${name}`,
        content,
        branch: state.branch,
      }),
    });
    return path;
  }

  /* ---------- delegated events ---------- */
  function onPanelInput(event) {
    const el = event.target.closest("[data-bind]");
    if (!el || !state.content) return;
    const path = el.dataset.bind;
    let value;
    if (el.dataset.kind === "lines") {
      value = el.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } else if (el.type === "checkbox") {
      value = el.checked;
    } else {
      value = el.value;
    }
    setPath(state.content, path, value);
    markDirty();

    if (el.type === "color") {
      $$(`[data-bind="${path}"][data-color-text]`).forEach((other) => {
        other.value = el.value;
      });
    } else if (el.hasAttribute("data-color-text")) {
      const hex = String(el.value).trim();
      if (/^#[0-9a-f]{6}$/i.test(hex)) {
        $$(`[data-bind="${path}"]`).forEach((other) => {
          if (other.type === "color") other.value = hex;
        });
      }
    }
  }

  async function onPanelChange(event) {
    const input = event.target.closest(".file-input");
    if (!input) return;
    const wrap = input.closest("[data-file]");
    if (!wrap) return;
    const file = input.files && input.files[0];
    if (!file) return;
    const path = wrap.dataset.path;
    const statusNode = wrap.querySelector(".file-status");
    const thumb = wrap.querySelector("[data-thumb]");
    try {
      const uploaded = await uploadFile(file, statusNode);
      setPath(state.content, path, uploaded);
      const textInput = wrap.querySelector("input[data-bind]");
      if (textInput) textInput.value = uploaded;
      if (thumb) {
        thumb.innerHTML = String(file.type).includes("pdf")
          ? "<span>PDF</span>"
          : `<img src="${esc(assetUrl(uploaded))}" alt="">`;
      }
      if (statusNode) {
        statusNode.classList.remove("is-error");
        statusNode.textContent = "已上传 · 保存后生效";
      }
      markDirty();
      toast("文件已上传，记得保存");
    } catch (error) {
      console.error(error);
      if (statusNode) {
        statusNode.classList.add("is-error");
        statusNode.textContent = error.message || "上传失败";
      }
      showMessage(`上传失败：${error.message || "未知错误"}`, { error: true });
    } finally {
      input.value = "";
    }
  }

  function onPanelClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const pi = Number(button.dataset.pi);
    const i = Number(button.dataset.i);
    const di = Number(button.dataset.di);
    const fi = Number(button.dataset.fi);
    const dir = Number(button.dataset.dir || 0);
    const content = state.content;
    if (!content) return;

    const projects = arr(content.projects);
    content.projects = projects;
    const downloads = arr(content.downloads);
    content.downloads = downloads;

    switch (action) {
      case "add-project":
        projects.push(newProject());
        break;
      case "remove-project":
        if (window.confirm("删除这个项目？")) projects.splice(pi, 1);
        else return;
        break;
      case "move-project":
        moveItem(projects, pi, dir);
        break;
      case "add-link":
        projects[pi].links = arr(projects[pi].links);
        projects[pi].links.push({ label: "新链接", url: "" });
        break;
      case "remove-link":
        if (projects[pi] && Array.isArray(projects[pi].links)) projects[pi].links.splice(i, 1);
        break;
      case "add-credit":
        projects[pi].credits = arr(projects[pi].credits);
        projects[pi].credits.push({ label: "新署名", value: "" });
        break;
      case "remove-credit":
        if (projects[pi] && Array.isArray(projects[pi].credits)) projects[pi].credits.splice(i, 1);
        break;
      case "add-download":
        downloads.push(newDownload());
        break;
      case "remove-download":
        if (!window.confirm("删除这个下载条目？")) return;
        downloads.splice(di, 1);
        break;
      case "move-download":
        moveItem(downloads, di, dir);
        break;
      case "add-download-file":
        downloads[di].files = arr(downloads[di].files);
        downloads[di].files.push({ label: "新文件", kind: "part", url: "", size: "", sha256: "" });
        break;
      case "remove-download-file":
        if (downloads[di] && Array.isArray(downloads[di].files)) downloads[di].files.splice(fi, 1);
        break;
      case "move-download-file":
        if (downloads[di]) moveItem(arr(downloads[di].files), fi, dir);
        break;
      case "clear-token": {
        if (!window.confirm("清除本机保存的 Token 并退出后台？")) return;
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        state.token = "";
        state.content = null;
        state.sha = null;
        state.dirty = false;
        showGate();
        return;
      }
      case "change-token": {
        const input = $("#newTokenInput");
        const token = input ? input.value.trim() : "";
        if (!token) {
          showMessage("请先填入新的 Token。", { error: true });
          return;
        }
        connect(token, { remember: state.remember, silent: false });
        return;
      }
      default:
        return;
    }

    markDirty();
    renderKeepingScroll();
  }

  /* ---------- wiring ---------- */
  function wire() {
    $("#gateForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const token = $("#tokenInput").value.trim();
      const remember = $("#rememberToken").checked;
      if (!token) return;
      connect(token, { remember, silent: false });
    });

    $("#nav").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-tab]");
      if (!button) return;
      state.tab = button.dataset.tab;
      renderTab();
      if (window.innerWidth <= 760) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    panel.addEventListener("input", onPanelInput);
    panel.addEventListener("change", onPanelChange);
    panel.addEventListener("click", onPanelClick);

    $("#saveBtn").addEventListener("click", save);
    $("#reloadBtn").addEventListener("click", reloadContent);
    $("#backupBtn").addEventListener("click", () => {
      if (!state.content) return;
      const blob = new Blob([JSON.stringify(state.content, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `site-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
      toast("已导出备份");
    });

    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === "s") {
        event.preventDefault();
        if (!saveBtn.disabled) save();
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (state.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
  }

  function start() {
    wire();
    const stored = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      connect(stored, { remember: !!localStorage.getItem(TOKEN_KEY), silent: true });
    } else {
      showGate();
    }
  }

  start();
})();
