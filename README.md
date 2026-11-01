# 宛枯缘梦 — 个人主页

一个深色、星空背景的个人主页：玻璃卡片版面、逐字打出的首屏、项目展示、联系方式、独立的文件下载站，以及一个不需要写代码的可视化后台。

- 线上地址：<https://lihongbo-learn.github.io/>
- 下载站：<https://lihongbo-learn.github.io/downloads/>
- 后台：<https://lihongbo-learn.github.io/admin/>

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
downloads/                 独立下载站（index.html / downloads.css / downloads.js）
specimen.html              独立字体样张（保留文件，首页不展示）
404.html                   404 页
content/site.json          站点全部内容（后台写这个文件，含 downloads[]）
admin/                     可视化后台
assets/css/site.css        首页样式
assets/js/site.js          首页渲染与交互
assets/fonts/*.woff2       自托管字体
assets/img/avatar.png      头像
assets/img/schoollink-icon.png  项目标识（非截图）
assets/img/og.png          分享卡片
assets/wankuyuanmeng-specimen.pdf  独立样张 PDF（首页不展示）
uploads/                   后台上传的图片
```

## 后台

1. 在 GitHub 创建 **fine-grained personal access token**：
   - Repository access：只选 `Lihongbo-Learn/lihongbo-learn.github.io`
   - Permissions → Contents：**Read and write**
2. 打开 `/admin/`，粘贴 Token，连接仓库。
3. 左侧可编辑：站点、首屏、项目、下载、联系、账户。
4. 右上角「保存并发布」会把 `content/site.json` 提交到 `main`。GitHub Pages 通常 1–2 分钟重建完成（CDN 可能再缓存约 10 分钟）。
5. 图片可以在对应字段直接上传，会写入 `uploads/`；**大文件不要走后台上传**，见下节。

Token 只保存在你浏览器的 localStorage / sessionStorage，不会提交到仓库。请使用只授权本仓库的 Token，并定期更换。

## 下载站 / 大文件

`/downloads/` 是独立页面，读取 `content/site.json` 的 `downloads[]`。文件本体放在 GitHub Releases，不放进 Pages 仓库：仓库单文件上限 100 MiB，Pages 站点总量约 1 GB；Release 单个附件上限 2 GiB，官方文档不限制 Release 总大小与带宽（受合理使用约束）。

### 数据结构

```json
{
  "downloads": [
    {
      "id": "schoollink-windows",
      "title": "SchoolLink 校联 · Windows",
      "version": "0.2.0-dev",
      "platform": "Windows",
      "date": "2026-10-31",
      "size": "53.5 MB",
      "note": "安装说明……",
      "featured": true,
      "files": [
        {
          "label": "安装程序 .exe",
          "kind": "primary",
          "url": "https://github.com/.../releases/download/v0.2.0-dev/....exe",
          "size": "53.5 MB",
          "sha256": "……"
        },
        {
          "label": "分卷 1/3",
          "kind": "part",
          "url": "https://github.com/.../....7z.001",
          "size": "1.5 GB",
          "sha256": "……"
        },
        {
          "label": "镜像 · OneDrive",
          "kind": "mirror",
          "url": "https://1drv.ms/...",
          "size": "1.8 GB",
          "sha256": ""
        }
      ]
    }
  ]
}
```

`kind` 为 `primary` / `part` / `mirror`：主文件、分卷、镜像。超过 2 GB 的文件用 7-Zip 分卷（每卷小于 2 GiB），上传到同一个 Release，下载页会列出全部分卷并提示解压第 1 卷。

### 发布流程

1. 仓库 → **Releases → Draft a new release**，填写 Tag（如 `v1.4.0`）。
2. 上传附件：单个附件必须小于 2 GiB；大的文件分卷后全部上传。
3. Publish 后复制每个附件的直链：
   `https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`
4. 计算 SHA-256（Windows：`certutil -hashfile 文件 SHA256`；macOS/Linux：`sha256sum 文件`）。
5. 打开 `/admin/ → 下载`，填写条目与直链，保存。下载页 1–2 分钟更新。

也可以用 `gh release create v1.4.0 ./dist/*.7z --title "..." --notes "..."`，后续 `gh release upload v1.4.0 文件 --clobber`。后台只保存索引，不传输大文件。

### 公开与限制

- Release 附件公开，任何拿到直链的人都能下载；需要密码时上传加密压缩包并线下发送密码。
- 大文件下载速度受网络影响；页面预留 `mirror`，可填 R2 / B2 / OneDrive 等镜像。
- GitHub 合理使用条款适用；不要把 Releases 当作高并发 CDN。

## 内容约定

- **不要使用界面截图**。项目视觉请用矢量版面、品牌资产、图标或作品实拍。后台在图片字段旁也做了提示。
- 首页项目卡使用 `projects[].image`、`projects[].summary`、`projects[].links`（官网 / GitHub）与 `projects[].credits`。
- 首屏大字是 `hero.name`，拼音行是 `hero.nameLatin`，打字机短句是 `hero.typing`。
- 下载站的条目由 `downloads[]` 驱动；二进制放在 GitHub Releases，后台只编辑元数据与直链。

## 部署

仓库名为 `lihongbo-learn.github.io`，GitHub Pages 使用 `main` 分支根目录。推送到 `main` 即发布。

## 字体与素材

- Archivo Variable / Instrument Serif / Space Mono：SIL Open Font License
- 头像插画：由站长提供
- SchoolLink 标识：站长作品
- 站点所有图形均由 HTML / CSS / SVG 绘制，不含网页截图

## License

站点内容与设计 © 2026 宛枯缘梦。代码可参考，转载内容与插画请先联系。
