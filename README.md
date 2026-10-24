# World Archive / 地环资料库

独立排版的世界观网站。当前使用本地整理的 104 条真实资料；Notion 同步程序已实现，但需要配置账户连接后才会启用。

## 本地预览

需要 Node.js 24。

```sh
npm ci
npm run dev -- --port 3000
```

打开 http://127.0.0.1:3000 。静态构建使用 `npm run build`，输出位于 `out/`。`next start` 不用于静态导出部署。

## 内容与版本

- `src/data/archive.json`：本地馆藏，保留当前、学说、早期和旧稿状态。
- `src/data/notion.json`：同步快照。启用后完整替代本地馆藏，不会把已取消发布的条目重新混入。
- `public/media/`：原图与阅读缩略图。
- `src/lib/config.ts`：站点名称、导航与术语。
- 旧稿独立存在；未经作者选择，不自动纳入当前设定。

## 用 Notion 编辑

1. 创建 Notion integration，并将目标数据库共享给该 integration。
2. 在数据库添加下列属性。名称支持表内中英文别名，但 `Published` 必须使用此英文名。
3. 将 `.env.example` 的配置写入本机 `.env.local`。不要把密钥提交 Git。
4. 配置 `NOTION_TOKEN` 和 `NOTION_DATA_SOURCE_ID`，后者是数据源 ID，不是数据库容器 ID。
5. 运行 `npm run sync:notion`，然后运行 `node scripts/prepare-media.mjs` 和 `npm run build`。

| 属性 | Notion 类型 | 内容 |
| --- | --- | --- |
| Name / 名称 | Title | 条目标题 |
| Published | Checkbox | 勾选才公开 |
| Type / 类型 | Select | person, location, organization, event, object, technology, infrastructure, project, system, document, media |
| Status / 状态 | Select | documented, unknown, theory, early, legacy, partial |
| Summary / 摘要 | Text | 可选，未填时从正文摘要 |
| Tags / 标签 | Multi-select | 同时生成馆藏专题 |
| Aliases / 别名 | Text | 逗号或换行分隔 |
| Location / 地点 | Text | 可选 |
| Date / 年代 | Date | 只填已知世界内日期 |
| Year / 年份 | Number | 可选，时间线排序用 |
| Relations / 关联 | Relation | 关联同一数据源内条目 |
| Reliability / 记录状况 | Text | 可选 |

正文直接在 Notion 页面编辑。同步是 **Notion 到网页的单向发布**，网站不是在线编辑器。本地馆藏不会自动写回 Notion；切换前请先迁移需要公开的正文并核对条目数。空数据库会发布为空馆藏，这是取消全部发布的明确结果。

同步会下载正文的 Markdown 图片并缓存，避免 Notion 临时图片地址过期。截断、未知区块、HTML 图片及过多内联关联会中止同步，不覆盖旧快照；请转换为普通 Markdown 支持的内容后重试。未发布的关联目标不会公开。

## GitHub Pages

将本目录作为仓库根目录推送到 `main`。在 Settings > Pages 中选择 GitHub Actions。

如需 Notion 同步，在 Settings > Secrets and variables > Actions 添加 `NOTION_TOKEN`、`NOTION_DATA_SOURCE_ID`。不配置时发布本地馆藏。

工作流在推送、手动触发和每 15 分钟的计划任务时构建。GitHub 定时任务可能延迟，不保证实时；手动运行可立即请求更新。同步或校验失败不会部署不完整版本，已发布网站继续保留。密钥只在构建阶段使用，不进入浏览器。

默认 GitHub Pages 公共站点的内容可被任何人访问，不要勾选私密草稿的 Published。

## 校验

```sh
npm run test:data
npm run typecheck
npm run lint
npm run build
```

地图标记为原图地名位置，不是测绘坐标。档案编号是编辑索引，不代表世界内机构编号。
