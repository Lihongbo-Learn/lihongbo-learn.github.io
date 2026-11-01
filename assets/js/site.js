/* ============================================================
   宛枯缘梦 — personal homepage
   Rendering + interactions. No dependencies.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  const pad = (n) => String(n).padStart(2, "0");

  const state = {
    content: null,
    flatSpreads: [],
    caseIndex: 0,
    caseOpen: false,
    videoOpen: false,
    lastFocus: null,
    toastTimer: 0,
    stageRaf: 0,
  };

  /* ---------- helpers ---------- */
  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);

  const safeUrl = (url) => {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (/^(https?:|mailto:|#|\/|\.\/|assets\/|uploads\/)/i.test(raw)) return raw;
    return "";
  };

  const plainText = (value) => String(value == null ? "" : value).trim();

  const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
    if (!m) return { r: 20, g: 18, b: 15 };
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  };
  const contrastInk = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.62 ? "#14120F" : "#F4F2EC";
  };

  const toast = (message) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-on");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove("is-on"), 2200);
  };

  const setLocked = (locked) => document.documentElement.classList.toggle("is-locked", locked);

  /* ---------- vector plates (no screenshots) ---------- */
  function visualDiagram() {
    return `<div class="visual visual--diagram" aria-hidden="true">
      <svg class="viz" viewBox="0 0 600 760" role="presentation" preserveAspectRatio="xMidYMid meet">
        <text x="32" y="34" class="strong">LAN / SYSTEM</text>
        <text x="568" y="34" text-anchor="end">01 — 03</text>
        <line x1="32" y1="48" x2="568" y2="48" class="stroke"/>

        <rect x="170" y="80" width="260" height="104" rx="6" class="stroke"/>
        <text x="190" y="110" class="strong">TEACHER / 教师端</text>
        <rect x="190" y="124" width="180" height="16" class="fill-ink"/>
        <text x="202" y="136" class="on-ink tiny">NOTICE · 通知</text>
        <circle cx="410" cy="108" r="7" class="fill-amber"/>
        <text x="440" y="108">SEND ↗</text>

        <line x1="300" y1="184" x2="300" y2="232" class="stroke"/>
        <path d="M300 242 L294 230 L306 230 Z" class="fill-ink"/>
        <text x="312" y="214">SEND / 发送</text>

        <circle cx="300" cy="330" r="94" class="stroke dashed"/>
        <circle cx="300" cy="330" r="64" class="stroke dashed"/>
        <rect x="244" y="274" width="112" height="112" rx="16" class="fill-moss"/>
        <text x="300" y="324" text-anchor="middle" class="hub-title">HUB</text>
        <text x="300" y="346" text-anchor="middle" class="on-moss">LAN</text>
        <circle cx="344" cy="286" r="6" class="fill-amber"/>
        <text x="188" y="330" text-anchor="end">NO INTERNET</text>
        <text x="188" y="346" text-anchor="end">无需公网</text>

        <rect x="458" y="286" width="86" height="150" rx="12" class="stroke"/>
        <rect x="470" y="304" width="62" height="10" rx="2" class="fill-ink"/>
        <text x="501" y="340" text-anchor="middle" class="strong tiny">PHONE</text>
        <text x="501" y="358" text-anchor="middle">回复</text>
        <line x1="392" y1="352" x2="450" y2="352" class="stroke dashed"/>
        <path d="M458 352 L446 347 L446 357 Z" class="fill-ink"/>
        <text x="398" y="340">REPLY</text>
        <text x="501" y="462" text-anchor="middle">TEACHER</text>

        <line x1="300" y1="446" x2="300" y2="484" class="stroke"/>
        <path d="M300 494 L294 482 L306 482 Z" class="fill-ink"/>
        <text x="312" y="470">FAN-OUT / 分发</text>

        <rect x="100" y="500" width="400" height="168" rx="6" class="stroke"/>
        <line x1="100" y1="528" x2="500" y2="528" class="stroke"/>
        <circle cx="120" cy="514" r="3" class="fill-amber"/>
        <text x="132" y="518" class="tiny">CLASSROOM DISPLAY</text>
        <rect x="124" y="544" width="352" height="86" rx="4" class="fill-ink"/>
        <circle cx="146" cy="572" r="5" class="fill-amber"/>
        <text x="162" y="576" class="on-ink strong">全屏通知 / FULL SCREEN</text>
        <rect x="146" y="592" width="240" height="4" class="fill-paper-dim"/>
        <rect x="146" y="604" width="170" height="4" class="fill-paper-dim"/>
        <text x="456" y="618" text-anchor="end" class="on-ink tiny">已确认</text>
        <text x="100" y="692" class="strong">DISPLAY / 教室大屏</text>

        <line x1="32" y1="716" x2="568" y2="716" class="stroke"/>
        <text x="32" y="738">OFFLINE FIRST — 直连 / HUB / 断网补齐</text>
        <text x="568" y="738" text-anchor="end">SCHOOLLINK 2026</text>
      </svg>
    </div>`;
  }

  function visualSignal() {
    return `<div class="visual visual--signal" aria-hidden="true">
      <div class="signal-head"><span>03 / INTERFACE</span><span>OFFLINE / 2026</span></div>
      <div class="signal-word"><span>NO</span><span>WI-FI</span><i class="signal-slash"></i></div>
      <div class="signal-card">
        <span class="signal-dot"></span>
        <span class="signal-meta">FULL SCREEN NOTICE</span>
        <strong>通知已送达</strong>
        <span class="signal-meta">局域网 · 已确认 · 无需公网</span>
      </div>
      <div class="signal-foot"><span>STILL DELIVERED</span><span>校联 SCHOOLLINK</span></div>
    </div>`;
  }

  function renderVisual(kind) {
    if (kind === "diagram") return visualDiagram();
    if (kind === "signal") return visualSignal();
    return "";
  }

  /* ---------- media / plates ---------- */
  function plateHtml(entry) {
    const { project, spread } = entry;
    const plate = ["green", "paper", "ink"].includes(spread.plate) ? spread.plate : "paper";
    const img = safeUrl(spread.image);
    const visual = ["mark", "diagram", "signal"].includes(spread.visual) ? spread.visual : "";
    const media = img
      ? `<img src="${esc(img)}" alt="${esc(spread.imageAlt)}" loading="lazy" decoding="async">`
      : renderVisual(visual);
    const plateClass = `plate plate--${plate}${img ? " plate--has-image" : ""}${!img && visual ? " plate--has-visual" : ""}`;
    return `<figure class="${plateClass}">
      <span class="plate-orbit" aria-hidden="true"></span>
      ${media}
      <span class="plate-stamp">${esc(project.title)} / ${pad(entry.globalIndex + 1)}</span>
      <figcaption>${esc(spread.caption)}</figcaption>
    </figure>`;
  }

  /* ---------- render: hero ---------- */
  function renderHero(c) {
    const h = c.hero || {};
    const name = plainText(h.name) || "宛枯缘梦";
    const chars = Array.from(name)
      .map((ch, i) => `<span class="char" style="--i:${i}">${esc(ch)}</span>`)
      .join("");
    const latin = plainText(h.nameLatin) || "WANKUYUANMENG";
    const latinChars = Array.from(latin)
      .map((ch) => `<span>${esc(ch)}</span>`)
      .join("");
    const avatar = safeUrl(h.avatar);
    const ctas = (Array.isArray(h.cta) ? h.cta : [])
      .map((cta, i) => {
        const url = safeUrl(cta.href);
        if (!url) return "";
        const kind = i === 0 || cta.kind === "primary" ? "pill-btn pill-btn--accent" : "pill-btn";
        return `<a class="${kind}" href="${esc(url)}">${esc(cta.label)} <span aria-hidden="true">${i === 0 ? "→" : "↗"}</span></a>`;
      })
      .join("");
    const roles = (Array.isArray(h.roles) ? h.roles : [])
      .map((role) => `<span class="role-chip">${esc(role)}</span>`)
      .join("");

    $("#hero-root").innerHTML = `
      <section class="hero" id="top">
        ${avatar ? `<div class="hero-glow" aria-hidden="true"><img src="${esc(avatar)}" alt=""></div>` : ""}
        <div class="hero-inner">
          <span class="hero-greeting mono">${esc(h.greeting)}</span>
          <h1 class="hero-name" aria-label="${esc(name)}">${chars}</h1>
          <p class="hero-latin" aria-label="${esc(latin)}">${latinChars}</p>
          <p class="hero-motto">${esc(h.motto)}</p>
          <p class="hero-tagline">${esc(h.tagline)}</p>
          <div class="role-row">${roles}</div>
          <div class="typing-line"><span class="typing-prefix">${esc(h.typingPrefix)}</span><span class="typed" id="typed"></span><i class="caret" aria-hidden="true"></i></div>
          <div class="hero-cta">${ctas}</div>
        </div>
        <div class="hero-foot mono">
          <span>ISSUE ${esc(c.meta && c.meta.issue)} / ${esc(c.meta && c.meta.year)}</span>
          <a class="scroll-cue" href="#about"><i aria-hidden="true"></i> SCROLL</a>
          <span>${esc(h.location)}</span>
        </div>
      </section>`;
  }

  /* ---------- render: profile / stats ---------- */
  function renderProfile(c) {
    const h = c.hero || {};
    const contact = c.contact || {};
    const avatar = safeUrl(h.avatar);
    const email = plainText(contact.email);
    const github = safeUrl(contact.github);
    const projects = (Array.isArray(c.projects) ? c.projects : []).map((p) => p.title).join(" / ");
    const specimen = c.specimen && c.specimen.title ? c.specimen.title : "Type Specimen";
    const now = projects ? `正在做 ${projects}，以及 ${specimen}。` : `正在做 ${specimen}。`;

    $("#profile-root").innerHTML = `
      <div class="card profile-card reveal">
        <div class="avatar-wrap">
          <span class="avatar-glow" aria-hidden="true"></span>
          ${avatar ? `<img src="${esc(avatar)}" alt="${esc(h.name)} 的头像">` : ""}
          <span class="avatar-ring" aria-hidden="true"></span>
          <span class="avatar-live"><i aria-hidden="true"></i>ONLINE</span>
        </div>
        <div class="profile-body">
          <h2 class="profile-name">${esc(h.name)}</h2>
          <p class="profile-latin mono">${esc(h.nameLatin)}</p>
          <p class="profile-motto">${esc(h.motto)}</p>
          <span class="profile-status"><i aria-hidden="true"></i>${esc(contact.availability || "OPEN FOR COLLABORATION")}</span>
          <div class="profile-socials">
            ${github ? `<a class="fill" href="${esc(github)}" target="_blank" rel="noopener" aria-label="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.88 1.55 2.32 1.1 2.88.84.09-.66.35-1.1.63-1.36-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.9-1.33 2.74-1.05 2.74-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/></svg></a>` : ""}
            ${email ? `<a href="mailto:${esc(email)}" aria-label="发送邮件"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.8 6.5 8.2 6 8.2-6"/></svg></a>` : ""}
            <a href="#contact" aria-label="联系信息"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>
        <div class="profile-now">
          <span class="mono">NOW / 正在</span>
          <p>${esc(now)}</p>
        </div>
      </div>`;
  }

  function renderStats(c) {
    const projects = Array.isArray(c.projects) ? c.projects : [];
    const spreads = state.flatSpreads.length;
    const palette = Array.isArray(c.palette) ? c.palette.length : 0;
    const talks = Array.isArray(c.talks) ? c.talks.length : 0;
    const now = new Date();
    const updated = `${c.meta && c.meta.year ? c.meta.year : now.getFullYear()}.${pad(now.getMonth() + 1)}`;

    $("#stats-root").innerHTML = `
      <div class="card side-card stats-card reveal">
        <span class="card-kicker mono">STATS / 统计</span>
        <div class="stats-list">
          <div><span>项目</span><b>${pad(projects.length)}</b></div>
          <div><span>跨页</span><b>${pad(spreads)}</b></div>
          <div><span>字样</span><b>04 P</b></div>
          <div><span>色板</span><b>${pad(palette)}</b></div>
          <div><span>讲座</span><b>${pad(talks)}</b></div>
          <div><span>更新</span><b>${esc(updated)}</b></div>
        </div>
      </div>
      <div class="card side-card index-card reveal" style="--d:80ms">
        <span class="card-kicker mono">INDEX / 索引</span>
        <div class="index-list">
          <a href="#about"><span>01</span>关于<em>About</em></a>
          <a href="#works"><span>02</span>项目<em>Works</em></a>
          <a href="#specimen"><span>03</span>字样<em>Specimen</em></a>
          <a href="#palette"><span>04</span>色板<em>Palette</em></a>
          <a href="#talks"><span>05</span>讲座<em>Talks</em></a>
          <a href="#contact"><span>06</span>联系<em>Contact</em></a>
        </div>
      </div>
      <div class="card side-card side-note reveal" style="--d:160ms">
        <span class="mono">NOTE / 备注</span>
        <p>本站无追踪、无 Cookie。所有项目图形由代码绘制，不使用界面截图。内容可在 <a href="admin/">后台</a> 直接更新。</p>
      </div>`;
  }

  /* ---------- render: about ---------- */
  function renderAbout(c) {
    const a = c.about || {};
    const focus = (Array.isArray(a.focus) ? a.focus : [])
      .map((item) => `<span class="tag">${esc(item)}</span>`)
      .join("");
    $("#about-root").innerHTML = `
      <section class="card reveal" id="about">
        <header class="card-head">
          <span class="card-kicker mono">01 / ABOUT</span>
          <span class="mono">关于</span>
        </header>
        <div class="about-body">
          <div>
            <h2 class="card-title">${esc(a.title).replace(/\n/g, "<br>")}<em>Design · Type · Code</em></h2>
            <p class="about-text">${esc(a.text)}</p>
            <p class="about-note">${esc(a.note)}</p>
            <div class="tag-row">${focus}</div>
          </div>
          <div class="about-quote">
            <span class="mono">MOTTO</span>
            <span>“${esc((c.hero && c.hero.motto) || "宛转枯荣，缘起梦生。")}”</span>
          </div>
        </div>
      </section>`;
  }

  /* ---------- render: works ---------- */
  function renderWorks(c) {
    const projects = (Array.isArray(c.projects) ? c.projects : []).filter((p) => p && p.title);
    state.flatSpreads = [];
    projects.forEach((project, pi) => {
      const list = Array.isArray(project.spreads) ? project.spreads : [];
      list.forEach((spread, si) => {
        state.flatSpreads.push({ project, spread, pi, si, globalIndex: state.flatSpreads.length });
      });
    });

    if (!projects.length) {
      $("#works-root").innerHTML = `
        <section class="card reveal" id="works">
          <header class="card-head"><span class="card-kicker mono">02 / SELECTED WORK</span><span class="mono">项目</span></header>
          <h2 class="card-title">作品整理中。</h2>
        </section>`;
      return;
    }

    const blocks = projects
      .map((project, pi) => {
        const icon = safeUrl(project.image);
        const tags = [project.category, project.year].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
        const links = (Array.isArray(project.links) ? project.links : [])
          .map((link) => {
            const url = safeUrl(link.url);
            return url ? `<a class="ghost-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(link.label)} ↗</a>` : "";
          })
          .join("");
        const credits = (Array.isArray(project.credits) ? project.credits : [])
          .map((item) => `<div><span>${esc(item.label)}</span><span>${esc(item.value)}</span></div>`)
          .join("");
        const spreadCount = (Array.isArray(project.spreads) ? project.spreads.length : 0);
        return `
          <article class="project-feature" data-project="${pi}">
            <div class="project-copy">
              <span class="mono" style="color:var(--accent)">PROJECT ${pad(pi + 1)}</span>
              <h2 class="card-title" style="margin-top:10px">${esc(project.title)}<em>${esc(project.titleCn)}</em></h2>
              <p class="project-summary">${esc(project.summary)}</p>
              <div class="tag-row">${tags}</div>
              <div class="project-meta">
                <div><span>类别</span><span>${esc(project.category)}</span></div>
                <div><span>年份</span><span>${esc(project.year)}</span></div>
                <div><span>跨页</span><span>${pad(spreadCount)} spreads</span></div>
              </div>
              <div class="project-actions">
                <button class="pill-btn pill-btn--accent" type="button" data-open-case="${pi}" ${spreadCount ? "" : "disabled"}>查看跨页 <span aria-hidden="true">↗</span></button>
                ${links}
              </div>
            </div>
            <div class="project-cover" aria-hidden="true">
              <span class="cover-orbit"></span>
              ${icon ? `<img src="${esc(icon)}" alt="">` : `<span class="cover-fallback">${esc((project.titleCn || project.title || "P").slice(0, 1))}</span>`}
              <span class="cover-cn">${esc(project.titleCn || project.title)}</span>
              <span class="cover-en mono">${esc(project.title).toUpperCase()} / ${esc(project.year)}</span>
            </div>
          </article>
          <div class="project-foot">
            <div class="credits">${credits}</div>
            <span class="mono">CASE ${pad(pi + 1)} — ${pad(spreadCount)} SPREADS</span>
          </div>`;
      })
      .join(`<div style="height:1px;background:var(--line-soft);margin:28px 0"></div>`);

    $("#works-root").innerHTML = `
      <section class="card reveal" id="works">
        <header class="card-head">
          <span class="card-kicker mono">02 / SELECTED WORK</span>
          <span class="mono">项目</span>
        </header>
        ${blocks}
      </section>`;

    initCase();
  }

  /* ---------- render: specimen ---------- */
  function renderSpecimen(c) {
    const s = c.specimen || {};
    const pdf = safeUrl(s.pdf);
    const lines = (Array.isArray(s.lines) ? s.lines : []).filter((l) => plainText(l));
    const wordLines = lines.filter((l) => l !== "Aa");

    $("#specimen-root").innerHTML = `
      <section class="card reveal" id="specimen">
        <header class="card-head">
          <span class="card-kicker mono">03 / TYPE SPECIMEN</span>
          <span class="mono">字样</span>
        </header>
        <div class="specimen-layout">
          <div>
            <div class="specimen-stage">
              <div class="specimen-card" id="specimenCard" tabindex="0" role="group" aria-label="可拖拽的字体样张卡片，双指可缩放">
                <div class="spec-card-top mono"><span>WANKUYUANMENG</span><span>SPECIMEN 01</span></div>
                <div class="spec-aa" id="specAa">Aa<span class="spec-dot"></span></div>
                <div class="spec-rule"></div>
                <div class="spec-row">
                  <span class="spec-cn">永</span>
                  <span class="spec-word" id="specWord">${esc(wordLines[0] || "WANKUYUANMENG")}</span>
                </div>
                <div class="spec-glyphs" aria-hidden="true">
                  <span>ABCDEFGHIJKLMNOPQRSTUVWXYZ</span>
                  <span>abcdefghijklmnopqrstuvwxyz</span>
                  <span>0123456789 &amp; ? ! / —</span>
                </div>
                <div class="spec-axis mono"><span>WDTH <b id="axisWidthVal">100</b></span><span>WGHT <b id="axisWeightVal">700</b></span></div>
                <span class="spec-barcode" aria-hidden="true"></span>
              </div>
            </div>
            <div class="specimen-tools">
              <button class="specimen-reset" type="button" id="specimenReset">复位 RESET</button>
              <span class="mono">拖拽移动 / 双指捏合缩放 / CTRL + 滚轮</span>
            </div>
          </div>
          <div class="specimen-copy">
            <span class="mono">${esc(s.subtitle)}</span>
            <h3>${esc(s.title)}</h3>
            <p class="lead">${esc(s.body)}</p>
            <div class="axis-controls">
              <div class="axis-control">
                <label for="axisWidth">Width</label>
                <input id="axisWidth" type="range" min="62" max="125" step="1" value="100" aria-label="字宽 WDTH">
                <span class="axis-value" id="axisWidthValue">100</span>
              </div>
              <div class="axis-control">
                <label for="axisWeight">Weight</label>
                <input id="axisWeight" type="range" min="100" max="900" step="10" value="700" aria-label="字重 WGHT">
                <span class="axis-value" id="axisWeightValue">700</span>
              </div>
            </div>
            <div class="specimen-actions">
              ${pdf ? `<a class="pill-btn pill-btn--accent" href="${esc(pdf)}" download>下载样张 PDF <span>↓</span></a>` : `<span class="mono">样张 PDF 整理中</span>`}
              <a class="ghost-link" href="specimen.html" target="_blank" rel="noopener">在线查看 ↗</a>
            </div>
            <p class="mono specimen-note">${esc(s.note)}</p>
          </div>
        </div>
      </section>`;

    initSpecimen(wordLines);
  }

  function initSpecimen(wordLines) {
    const card = $("#specimenCard");
    if (!card) return;
    const aa = $("#specAa");
    const word = $("#specWord");
    const width = $("#axisWidth");
    const weight = $("#axisWeight");
    const widthValue = $("#axisWidthValue");
    const weightValue = $("#axisWeightValue");
    const widthVal = $("#axisWidthVal");
    const weightVal = $("#axisWeightVal");
    const reset = $("#specimenReset");
    const stage = card.closest(".specimen-stage");

    const transform = { x: 0, y: 0, scale: 1 };
    let drag = null;
    let pinchStart = 0;
    let pinchScale = 1;
    const pointers = new Map();

    const applyTransform = () => {
      card.style.setProperty("--tx", `${transform.x}px`);
      card.style.setProperty("--ty", `${transform.y}px`);
      card.style.setProperty("--sc", transform.scale.toFixed(3));
    };

    const applyAxis = () => {
      const w = Number(width.value);
      const g = Number(weight.value);
      [aa, word].forEach((el) => {
        if (el) el.style.fontVariationSettings = `"wdth" ${w}, "wght" ${g}`;
      });
      [widthValue, widthVal].forEach((el) => el && (el.textContent = String(w)));
      [weightValue, weightVal].forEach((el) => el && (el.textContent = String(g)));
    };

    width.addEventListener("input", applyAxis);
    weight.addEventListener("input", applyAxis);
    applyAxis();

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    card.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      card.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        drag = { px: event.clientX, py: event.clientY, tx: transform.x, ty: transform.y };
      } else if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        pinchStart = dist(a, b);
        pinchScale = transform.scale;
        drag = null;
      }
    });

    card.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1 && drag) {
        const maxX = window.innerWidth * 0.48;
        const maxY = window.innerHeight * 0.4;
        transform.x = clamp(drag.tx + (event.clientX - drag.px), -maxX, maxX);
        transform.y = clamp(drag.ty + (event.clientY - drag.py), -maxY, maxY);
        applyTransform();
      } else if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = Array.from(pointers.values());
        transform.scale = clamp(pinchScale * (dist(a, b) / pinchStart), 0.55, 3);
        applyTransform();
      }
    });

    const release = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 1) {
        const point = Array.from(pointers.values())[0];
        drag = { px: point.x, py: point.y, tx: transform.x, ty: transform.y };
        pinchStart = 0;
      } else if (pointers.size === 0) {
        drag = null;
        pinchStart = 0;
      }
    };
    card.addEventListener("pointerup", release);
    card.addEventListener("pointercancel", release);

    card.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        transform.scale = clamp(transform.scale * (1 - event.deltaY * 0.002), 0.55, 3);
        applyTransform();
      },
      { passive: false }
    );

    card.addEventListener("dblclick", () => {
      transform.x = 0;
      transform.y = 0;
      transform.scale = 1;
      applyTransform();
    });

    reset &&
      reset.addEventListener("click", () => {
        transform.x = 0;
        transform.y = 0;
        transform.scale = 1;
        width.value = 100;
        weight.value = 700;
        applyTransform();
        applyAxis();
        toast("样张已复位");
      });

    if (!reduceMotion.matches && word && wordLines.length > 1 && stage) {
      let index = Math.max(0, wordLines.indexOf(word.textContent));
      const timer = setInterval(() => {
        if (!document.body.contains(stage) || document.hidden) return;
        const box = stage.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        index = (index + 1) % wordLines.length;
        word.textContent = wordLines[index];
        if (typeof word.animate === "function") {
          word.animate(
            [
              { opacity: 0, transform: "translateY(7px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" }
          );
        }
      }, 3600);
      window.addEventListener("pagehide", () => clearInterval(timer), { once: true });
    }
  }

  /* ---------- render: palette ---------- */
  function renderPalette(c) {
    const palette = (Array.isArray(c.palette) ? c.palette : []).filter((p) => p && p.hex);
    const cards = palette
      .map((color, i) => {
        const fg = contrastInk(color.hex);
        return `
          <button class="swatch" type="button" style="--c:${esc(color.hex)};--fg:${fg}" data-hex="${esc(color.hex)}" aria-label="复制色值 ${esc(color.name)} ${esc(color.hex)}">
            <span class="swatch-top"><span>${pad(i + 1)}</span><span>${esc(color.name)}</span></span>
            <span class="swatch-mid"><span class="swatch-name">${esc(color.name)}</span><span class="swatch-cn">${esc(color.cn)}</span></span>
            <span class="swatch-hex">${esc(color.hex)}</span>
          </button>`;
      })
      .join("");

    $("#palette-root").innerHTML = `
      <section class="card reveal" id="palette">
        <header class="card-head">
          <span class="card-kicker mono">04 / PALETTE</span>
          <span class="mono">色板</span>
        </header>
        <p class="palette-caption">纸、墨与一管星蓝。拖动胶片条，像翻看印刷打样那样核对待用颜色；点击色卡复制色值。</p>
        <div class="film">
          <div class="film-track" id="filmTrack" aria-label="色板胶片条，可拖动">${cards}</div>
        </div>
        <div class="film-foot mono">
          <span>SCRATCH → 按住拖动 / 点击复制</span>
          <span>${pad(palette.length)} INKS / DARK EDITION</span>
        </div>
      </section>`;

    initFilm();
  }

  function copyText(text) {
    const done = () => toast(`已复制 ${text}`);
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
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
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
  }

  function initFilm() {
    const track = $("#filmTrack");
    if (!track) return;
    let down = false;
    let startX = 0;
    let startLeft = 0;
    let moved = 0;

    track.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      down = true;
      moved = 0;
      startX = event.clientX;
      startLeft = track.scrollLeft;
      track.classList.add("is-dragging");
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointermove", (event) => {
      if (!down) return;
      const dx = event.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      track.scrollLeft = startLeft - dx;
    });
    const end = () => {
      down = false;
      track.classList.remove("is-dragging");
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
    track.addEventListener("pointerleave", end);

    track.addEventListener("click", (event) => {
      const swatch = event.target.closest(".swatch");
      if (!swatch) return;
      if (moved > 8) {
        moved = 0;
        return;
      }
      copyText(swatch.dataset.hex || "");
    });
  }

  /* ---------- render: talks ---------- */
  function toEmbed(url) {
    const raw = plainText(url);
    if (!raw) return null;
    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(raw)) return { type: "video", src: raw };
    const yt = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
    const bili = raw.match(/bilibili\.com\/video\/(BV[\w]+)/i);
    if (bili) return { type: "iframe", src: `https://player.bilibili.com/player.html?bvid=${bili[1]}&autoplay=1&high_quality=1` };
    return { type: "iframe", src: raw };
  }

  function renderTalks(c) {
    const talks = (Array.isArray(c.talks) ? c.talks : []).filter((t) => t && t.title);
    const html = talks
      .map((talk, i) => {
        const poster = safeUrl(talk.poster);
        const video = toEmbed(talk.video);
        const media = poster
          ? `<img src="${esc(poster)}" alt="${esc(talk.title)} 的海报" loading="lazy" decoding="async">`
          : `<div class="talk-poster" aria-hidden="true">
              <span class="talk-poster-top mono"><span>TALK ${pad(i + 1)}</span><span>${esc(talk.date)}</span></span>
              <span class="talk-poster-title">${esc(talk.title)}</span>
              <span class="talk-poster-foot mono"><span>${esc(talk.event)}</span><span>RECORDING</span></span>
            </div>`;
        return `
          <article class="talk">
            <div class="talk-media ${poster ? "" : "talk-media--poster"}">
              ${media}
              ${poster ? `<span class="talk-badge">TALK ${pad(i + 1)}</span>` : ""}
              ${video ? `<button class="talk-play" type="button" data-talk="${i}" aria-label="播放录像：${esc(talk.title)}"><span>▶</span></button>` : poster ? `<span class="talk-media-note mono">RECORDING / 整理中</span>` : ""}
            </div>
            <div class="talk-copy">
              <div>
                <div class="talk-meta mono"><span>${esc(talk.date)}</span><span>${esc(talk.event)}</span></div>
                <h3 class="talk-title">${esc(talk.title)}</h3>
                <p class="talk-note">${esc(talk.note)}</p>
              </div>
              <div class="talk-side">
                ${video ? `<button class="pill-btn" type="button" data-talk="${i}">播放录像 <span>▶</span></button>` : `<span class="mono" style="color:var(--text-4)">录像整理中 — 稍后上传</span>`}
              </div>
            </div>
          </article>`;
      })
      .join("");

    $("#talks-root").innerHTML = `
      <section class="card reveal" id="talks">
        <header class="card-head">
          <span class="card-kicker mono">05 / TALKS</span>
          <span class="mono">讲座</span>
        </header>
        ${html || `<p class="card-title" style="font-size:1.4rem">分享记录整理中。</p>`}
      </section>`;

    $$("[data-talk]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const talk = talks[Number(btn.dataset.talk)];
        if (talk) openVideo(talk);
      });
    });
  }

  function openVideo(talk) {
    const modal = $("#videoModal");
    const body = $("#videoModalBody");
    const title = $("#videoModalTitle");
    const embed = toEmbed(talk.video);
    if (!modal || !body || !embed) return;
    title.textContent = talk.title || "TALK";
    body.innerHTML =
      embed.type === "video"
        ? `<video src="${esc(embed.src)}" controls autoplay playsinline></video>`
        : `<iframe src="${esc(embed.src)}" title="${esc(talk.title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    modal.hidden = false;
    state.videoOpen = true;
    setLocked(true);
    $("#videoClose") && $("#videoClose").focus();
  }

  function closeVideo() {
    const modal = $("#videoModal");
    const body = $("#videoModalBody");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    state.videoOpen = false;
    if (body) body.innerHTML = "";
    if (!state.caseOpen) setLocked(false);
  }

  /* ---------- render: contact / footer ---------- */
  function renderContact(c) {
    const contact = c.contact || {};
    const email = plainText(contact.email);
    const github = safeUrl(contact.github);

    $("#contact-root").innerHTML = `
      <section class="card contact-card reveal" id="contact">
        <header class="card-head">
          <span class="card-kicker mono">06 / CONTACT</span>
          <span class="mono">联系</span>
        </header>
        <span class="hero-greeting mono" style="display:flex;width:max-content;margin-bottom:18px">${esc(contact.availability)}</span>
        <h2 class="contact-title">写信给我。<em>Say hello.</em></h2>
        ${email ? `<a class="contact-email" href="mailto:${esc(email)}">${esc(email)}</a>` : ""}
        <p class="contact-note">${esc(contact.note)}</p>
        <div class="contact-links">
          ${email ? `<a href="mailto:${esc(email)}"><span class="dot"></span>Email ↗</a>` : ""}
          ${github ? `<a href="${esc(github)}" target="_blank" rel="noopener">GitHub ↗</a>` : ""}
          <a href="#top">回到顶部 ↑</a>
        </div>
      </section>`;
  }

  function renderFooter(c) {
    const contact = c.contact || {};
    const email = plainText(contact.email);
    const github = safeUrl(contact.github);
    const year = (c.meta && c.meta.year) || "2026";

    $("#footer-root").innerHTML = `
      <div class="footer-grid">
        <div class="footer-brand">
          <span class="brand-mark" aria-hidden="true">梦<i></i></span>
          <div class="footer-brand-name">${esc(c.hero && c.hero.name)}<em>${esc(c.hero && c.hero.nameLatin)}</em></div>
        </div>
        <div class="footer-block">
          <span class="mono">TYPEFACES</span>
          <p>Archivo Variable<br>Instrument Serif<br>Space Mono<br>系统宋体 / 系统黑体</p>
        </div>
        <div class="footer-block">
          <span class="mono">BUILD</span>
          <p>HTML / CSS / JavaScript<br>无框架 · 无追踪<br>托管于 GitHub Pages</p>
        </div>
        <div class="footer-block">
          <span class="mono">CONTACT</span>
          <p>${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a><br>` : ""}${github ? `<a href="${esc(github)}" target="_blank" rel="noopener">github.com/Lihongbo-Learn</a><br>` : ""}<a href="admin/">更新内容 / Admin ↗</a></p>
        </div>
      </div>
      <div class="footer-bottom mono">
        <span>© ${esc(year)} ${esc(c.hero && c.hero.name)}</span>
        <span>SET IN ARCHIVO &amp; SONGTI</span>
        <span>NO COOKIES / NO TRACKING</span>
      </div>`;
  }

  /* ---------- case viewer ---------- */
  function initCase() {
    const modal = $("#caseModal");
    const stage = $("#caseStage");
    const dots = $("#caseDots");
    const count = $("#caseCount");
    if (!modal || !stage) return;

    const total = state.flatSpreads.length;
    stage.innerHTML = state.flatSpreads
      .map(
        (entry, i) => `
        <article class="case-spread" data-i="${i}" aria-hidden="true">
          <div class="case-page case-left">
            <div>
              <div class="case-kicker">${esc(entry.spread.kicker)}</div>
              <h3 class="case-spread-title">${esc(entry.spread.title)}</h3>
              <div class="case-body">${(Array.isArray(entry.spread.body) ? entry.spread.body : []).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
            </div>
            <div class="case-bottom">
              ${entry.spread.aside ? `<p class="case-aside">${esc(entry.spread.aside)}</p>` : ""}
              <div class="case-meta"><span>${esc(entry.project.title)} — ${esc(entry.project.year)}</span><span>${pad(entry.si + 1)} / ${pad(entry.project.spreads.length)}</span></div>
            </div>
          </div>
          <div class="case-page case-right">${plateHtml(entry)}</div>
        </article>`
      )
      .join("");

    dots.innerHTML = state.flatSpreads
      .map((_, i) => `<button type="button" data-case-dot="${i}" aria-label="跳到跨页 ${i + 1}"></button>`)
      .join("");

    const setCase = (index) => {
      if (!total) return;
      state.caseIndex = clamp(index, 0, total - 1);
      const active = state.caseIndex;
      $$(".case-spread", stage).forEach((el, i) => {
        el.classList.toggle("is-active", i === active);
        el.classList.toggle("is-before", i < active);
        el.setAttribute("aria-hidden", i === active ? "false" : "true");
      });
      $$("button", dots).forEach((el, i) => el.classList.toggle("is-active", i === active));
      count.textContent = `${pad(active + 1)} / ${pad(total)}`;
      const entry = state.flatSpreads[active];
      if (entry) {
        $("#caseKicker").textContent = `PROJECT ${pad(entry.pi + 1)} / ${entry.project.title.toUpperCase()}`;
        $("#caseTitle").textContent = `${entry.project.title}${entry.project.titleCn ? " " + entry.project.titleCn : ""}`;
      }
      const activeEl = stage.querySelector(".case-spread.is-active");
      if (activeEl) activeEl.scrollTop = 0;
    };

    const openCase = (index = 0) => {
      if (!total) return;
      state.lastFocus = document.activeElement;
      state.caseOpen = true;
      modal.hidden = false;
      setLocked(true);
      setCase(index);
      $("#caseClose") && $("#caseClose").focus();
    };

    const closeCase = () => {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      state.caseOpen = false;
      if (!state.videoOpen) setLocked(false);
      if (state.lastFocus && typeof state.lastFocus.focus === "function") state.lastFocus.focus();
    };

    const go = (dir) => setCase(state.caseIndex + dir);

    $$("[data-open-case]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pi = Number(btn.dataset.openCase);
        const first = state.flatSpreads.findIndex((entry) => entry.pi === pi);
        openCase(first < 0 ? 0 : first);
      });
    });

    $("#caseClose") && $("#caseClose").addEventListener("click", closeCase);
    $("[data-case-close]") && $("[data-case-close]").addEventListener("click", closeCase);
    $("#casePrev") && $("#casePrev").addEventListener("click", () => go(-1));
    $("#caseNext") && $("#caseNext").addEventListener("click", () => go(1));
    dots.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-case-dot]");
      if (btn) setCase(Number(btn.dataset.caseDot));
    });

    document.addEventListener("keydown", (event) => {
      if (!state.caseOpen) return;
      if (event.key === "Escape") closeCase();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    });

    // swipe
    let swipe = null;
    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      swipe = { x: event.clientX, y: event.clientY, t: Date.now() };
    });
    stage.addEventListener("pointerup", (event) => {
      if (!swipe) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      const dt = Date.now() - swipe.t;
      swipe = null;
      if (Math.abs(dx) > 54 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 700) {
        go(dx < 0 ? 1 : -1);
      }
    });
    stage.addEventListener("pointercancel", () => (swipe = null));
  }

  /* ---------- typing ---------- */
  function initTyping() {
    const el = $("#typed");
    if (!el) return;
    const hero = state.content && state.content.hero ? state.content.hero : {};
    const phrases = (Array.isArray(hero.typing) ? hero.typing : []).filter(Boolean);
    if (!phrases.length) return;
    if (reduceMotion.matches) {
      el.textContent = phrases[0];
      return;
    }
    let phrase = 0;
    let char = 0;
    let deleting = false;
    const type = () => {
      const current = phrases[phrase];
      if (deleting) {
        char -= 1;
        el.textContent = current.slice(0, Math.max(0, char));
      } else {
        char += 1;
        el.textContent = current.slice(0, char);
      }
      let delay = deleting ? 45 : 100;
      if (!deleting && char >= current.length) {
        deleting = true;
        delay = 2100;
      } else if (deleting && char <= 0) {
        deleting = false;
        phrase = (phrase + 1) % phrases.length;
        delay = 420;
      }
      setTimeout(type, delay);
    };
    setTimeout(type, 900);
  }

  /* ---------- hero latin variable morph ---------- */
  function initHeroMorph() {
    if (reduceMotion.matches || coarsePointer.matches) return;
    const hero = $(".hero");
    const line = $(".hero-latin");
    if (!hero || !line) return;
    const letters = $$("span", line);
    if (!letters.length) return;
    letters.forEach((span) => span.style.fontVariationSettings = '"wdth" 110, "wght" 500');
    let raf = 0;
    let mx = null;
    const apply = () => {
      raf = 0;
      letters.forEach((span) => {
        let pressure = 0;
        if (mx != null) {
          const box = span.getBoundingClientRect();
          const distance = Math.abs(mx - (box.left + box.width / 2)) / window.innerWidth;
          pressure = Math.max(0, 1 - distance * 4.2);
        }
        const wdth = 110 + pressure * 15;
        const wght = 500 + pressure * 200;
        span.style.fontVariationSettings = `"wdth" ${wdth.toFixed(1)}, "wght" ${wght.toFixed(0)}`;
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      mx = event.clientX;
      schedule();
    });
    hero.addEventListener("pointerleave", () => {
      mx = null;
      schedule();
    });
  }

  /* ---------- starfield ---------- */
  function initStarfield() {
    if (reduceMotion.matches) return;
    const canvas = $("#stars");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars = [];
    let shooting = [];
    let lastShot = performance.now();
    let pointerX = 0;
    let pointerY = 0;
    let smoothX = 0;
    let smoothY = 0;

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = clamp(Math.round((width * height) / 11000), 70, 220);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.25 + Math.random() * 0.75,
        r: 0.4 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.06 + Math.random() * 0.22,
        accent: Math.random() < 0.18,
      }));
    };
    build();
    window.addEventListener("resize", build);

    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        pointerX = (event.clientX / width - 0.5) * 2;
        pointerY = (event.clientY / height - 0.5) * 2;
      },
      { passive: true }
    );

    const spawnShooting = (now) => {
      if (now - lastShot < 7000 + Math.random() * 6000) return;
      lastShot = now;
      shooting.push({
        x: Math.random() * width * 0.7,
        y: Math.random() * height * 0.35,
        vx: 4 + Math.random() * 3,
        vy: 1.4 + Math.random() * 1.4,
        life: 1,
      });
    };

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(now - last, 50);
      last = now;
      smoothX += (pointerX - smoothX) * 0.045;
      smoothY += (pointerY - smoothY) * 0.045;
      ctx.clearRect(0, 0, width, height);
      const t = now / 1000;
      stars.forEach((star) => {
        star.y += star.speed * (dt / 16);
        if (star.y > height + 4) {
          star.y = -4;
          star.x = Math.random() * width;
        }
        const alpha = 0.16 + (Math.sin(t * 0.7 + star.phase) * 0.5 + 0.5) * 0.55;
        const x = star.x + smoothX * star.z * 10;
        const y = star.y + smoothY * star.z * 6;
        ctx.beginPath();
        ctx.fillStyle = star.accent
          ? `rgba(160, 174, 255, ${(alpha * 0.9).toFixed(3)})`
          : `rgba(243, 241, 234, ${alpha.toFixed(3)})`;
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
        ctx.fill();
        if (star.r > 1.5) {
          ctx.strokeStyle = `rgba(243, 241, 234, ${(alpha * 0.25).toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - star.r * 3, y);
          ctx.lineTo(x + star.r * 3, y);
          ctx.moveTo(x, y - star.r * 3);
          ctx.lineTo(x, y + star.r * 3);
          ctx.stroke();
        }
      });
      spawnShooting(now);
      shooting = shooting.filter((shot) => {
        shot.x += shot.vx * (dt / 16);
        shot.y += shot.vy * (dt / 16);
        shot.life -= dt / 1200;
        if (shot.life <= 0) return false;
        const grad = ctx.createLinearGradient(shot.x, shot.y, shot.x - shot.vx * 16, shot.y - shot.vy * 16);
        grad.addColorStop(0, `rgba(200, 210, 255, ${(shot.life * 0.85).toFixed(3)})`);
        grad.addColorStop(1, "rgba(200, 210, 255, 0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 16, shot.y - shot.vy * 16);
        ctx.stroke();
        return true;
      });
      state.stageRaf = requestAnimationFrame(loop);
    };
    state.stageRaf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(state.stageRaf);
      } else {
        last = performance.now();
        state.stageRaf = requestAnimationFrame(loop);
      }
    });
  }

  /* ---------- cursor star trail ---------- */
  function initTrace() {
    if (reduceMotion.matches || coarsePointer.matches) return;
    const canvas = $("#trace");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let dots = [];
    let last = null;
    let lastFrame = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (x, y, strength) => {
      const accent = Math.random() < 0.55;
      dots.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        r: 0.6 + Math.random() * 1.6 + strength * 1.4,
        life: 1,
        accent,
      });
      if (dots.length > 360) dots.splice(0, dots.length - 360);
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        const point = { x: event.clientX, y: event.clientY };
        if (!last) {
          last = point;
          return;
        }
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 6) return;
        const speed = Math.min(distance / 60, 1);
        const steps = Math.max(1, Math.floor(distance / 22));
        for (let i = 1; i <= steps; i += 1) {
          spawn(last.x + (dx * i) / steps, last.y + (dy * i) / steps, speed);
        }
        last = point;
      },
      { passive: true }
    );
    document.addEventListener("pointerleave", () => (last = null));

    const frame = (now) => {
      const dt = Math.min(now - lastFrame, 44);
      lastFrame = now;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      if (dots.length) {
        const next = [];
        for (let i = 0; i < dots.length; i += 1) {
          const dot = dots[i];
          dot.life -= dt / 900;
          if (dot.life <= 0) continue;
          const alpha = dot.life * (dot.accent ? 0.45 : 0.3);
          const color = dot.accent ? "139, 156, 255" : "243, 241, 234";
          ctx.beginPath();
          ctx.fillStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
          ctx.arc(dot.x, dot.y, dot.r * (0.5 + dot.life * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = `rgba(${color}, ${(alpha * 0.18).toFixed(3)})`;
          ctx.arc(dot.x, dot.y, dot.r * 3.4, 0, Math.PI * 2);
          ctx.fill();
          next.push(dot);
        }
        dots = next;
      }
      ctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /* ---------- nav / chrome ---------- */
  function initChrome() {
    const mast = $("#masthead");
    const navLinks = $$("#mastNav a");
    const dockLinks = $$(".dock a[data-dock]");
    const bar = $("#scrollProgress");
    const sections = ["top", "about", "works", "specimen", "contact"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const setActive = (id) => {
      navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
      dockLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.dock === id));
    };

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max, 0, 1).toFixed(4) : 0})`;
      if (mast) mast.classList.toggle("is-solid", window.scrollY > 24);
      const marker = window.innerHeight * 0.34;
      let current = "top";
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= marker) current = section.id;
      });
      setActive(current);
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    $("#toTop") && $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" }));

    $("#videoClose") && $("#videoClose").addEventListener("click", closeVideo);
    const videoModal = $("#videoModal");
    videoModal &&
      videoModal.addEventListener("click", (event) => {
        if (event.target === videoModal) closeVideo();
      });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.videoOpen) closeVideo();
    });
  }

  function initReveal() {
    const items = $$(".reveal");
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
    );
    items.forEach((item) => observer.observe(item));
  }

  /* ---------- error ---------- */
  function showError(error) {
    const main = $("#main");
    if (main) {
      main.innerHTML = `
        <div class="noscript" style="text-align:center">
          <p class="mono" style="color:var(--text-3);line-height:2">
            内容加载失败 — CONTENT FAILED TO LOAD<br>
            ${esc(error && error.message ? error.message : "UNKNOWN ERROR")}<br>
            <a href="./">重新加载</a>
          </p>
        </div>`;
    }
    document.body.classList.add("is-ready");
  }

  /* ---------- boot ---------- */
  async function start() {
    initStarfield();
    initTrace();

    try {
      const response = await fetch(`content/site.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.json();
      if (!content || !content.hero) throw new Error("内容结构不完整");
      state.content = content;

      if (content.meta && content.meta.title) document.title = content.meta.title;
      if (content.meta && content.meta.description) {
        const desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute("content", content.meta.description);
      }

      renderHero(content);
      renderProfile(content);
      renderAbout(content);
      renderWorks(content);
      renderSpecimen(content);
      renderPalette(content);
      renderTalks(content);
      renderContact(content);
      renderStats(content);
      renderFooter(content);

      initReveal();
      initTyping();
      initHeroMorph();
      initChrome();

      document.body.classList.add("is-ready");
    } catch (error) {
      console.error(error);
      showError(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
