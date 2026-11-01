# 宛枯缘梦 — 个人主页

一个深色、星空背景的个人主页：玻璃卡片版面、逐字打出的首屏、可切换的项目跨页、可拖拽的字体样张、胶片式色板，以及一个不需要写代码的可视化后台。

- 线上地址：<https://lihongbo-learn.github.io/>
- 后台：<https://lihongbo-learn.github.io/admin/>
- 字体样张 PDF：`assets/wankuyuanmeng-specimen.pdf`

## 技术

纯静态站点，无构建步骤、无框架、无追踪：

- HTML / CSS / JavaScript
- Canvas 星空与光标星尘
- 自托管 Archivo Variable、Instrument Serif、Space Mono
- 中文使用系统中文字体（苹方 / 微软雅黑 / 宋体）
- 后台通过 GitHub Contents API 直接提交 `content/site.json`

## 本地预览

不要直接双击 `index.html`（`fetch` 读取 JSON 会被浏览器的本地文件策略拦截）。在项目根目录起一个静态服务器：

```bash
python -m http.server 8080
```

然后打开 <http://127.0.0.1:8080/>。

## 目录

```
index.html                 首页骨架
specimen.html              印刷版字体样张（用于打印成 PDF）
404.html                   404 页
content/site.json          站点全部内容（后台写这个文件）
admin/                     可视化后台
assets/css/site.css        首页样式
assets/js/site.js          首页渲染与交互
assets/fonts/*.woff2       自托管字体
assets/img/avatar.png      头像
assets/img/schoollink-icon.png  项目标识（非截图）
assets/img/og.png          分享卡片
assets/wankuyuanmeng-specimen.pdf  可下载样张
uploads/                   后台上传的图片
```

## 后台

1. 在 GitHub 创建 **fine-grained personal access token**：
   - Repository access：只选 `Lihongbo-Learn/lihongbo-learn.github.io`
   - Permissions → Contents：**Read and write**
2. 打开 `/admin/`，粘贴 Token，连接仓库。
3. 左侧可编辑：站点、首屏、项目与跨页、字体样张、色板、讲座、联系。
4. 右上角「保存并发布」会把 `content/site.json` 提交到 `main`。GitHub Pages 通常 1–2 分钟重建完成（CDN 可能再缓存约 10 分钟）。
5. 图片 / PDF 可以在对应字段直接上传，会写入 `uploads/`。

Token 只保存在你浏览器的 localStorage / sessionStorage，不会提交到仓库。请使用只授权本仓库的 Token，并定期更换。

## 内容约定

- **不要使用界面截图**。项目视觉请用矢量版面、品牌资产、图标或作品实拍。后台在图片字段旁也做了提示。
- 首页项目卡使用 `projects[].image`；项目跨页使用 `projects[].spreads[]`（`visual` 可选 `diagram` / `signal` / `mark`，留空时使用图片）。
- 首屏大字是 `hero.name`，拼音行是 `hero.nameLatin`，打字机短句是 `hero.typing`。
- 关于标题支持换行（后台直接回车）。

## 部署

仓库名为 `lihongbo-learn.github.io`，GitHub Pages 使用 `main` 分支根目录。推送到 `main` 即发布。

## 字体与素材

- Archivo Variable / Instrument Serif / Space Mono：SIL Open Font License
- 头像插画：由站长提供
- SchoolLink 标识：站长作品
- 站点所有图形均由 HTML / CSS / SVG 绘制，不含网页截图

## License

站点内容与设计 © 2026 宛枯缘梦。代码可参考，转载内容与插画请先联系。
