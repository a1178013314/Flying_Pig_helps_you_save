# 账本

更新时间：2026-11-04 ｜ 当前阶段：S0 前置准备 ｜ 一句话现状：monorepo 骨架已跑通 spec §8 全部九项验收，前后端本地能连通，但业务页面为零——前端只有一个连通验证页，入口页与三段页还没动工。

> 注：规则引用的总纲（§5/§7/§8）尚未入库，本账本暂以 `.qoder/spec/initial-framework-scaffolding-spec.md`、`docs/specs/2026-11-04-初始架构-design.md` 与 `docs/需求.md` 为口径来源，待总纲入库后改为引用。

## 本次做什么

1. 按 spec 搭 pnpm monorepo 骨架（logger / shared / typescript-config / admin / web）。完成标准：根目录 `pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm test` 四条命令全绿。
2. 过 spec §8 九项验收。完成标准：九项每一项都有当场可复现的命令或断言，不含"大概"。
3. 把本次对 spec 的 5 处偏移回写 spec，并沉淀设计文档与术语表。完成标准：`docs/specs/2026-11-04-初始架构-design.md` 与 `CONTEXT.md` 存在，spec 内不再残留 `@guard-work` 与登录壳描述。

## 已完成

| 项 | 状态 | 落地位置 | 验证方式 |
|---|---|---|---|
| pnpm monorepo 骨架（apps/admin NestJS 12 + TypeORM 1 + SQLite、apps/web Vite 8 + React 19 + RR8 + Tailwind 4、packages/{logger,shared,typescript-config}） | 已完成 | `apps/`、`packages/`、`pnpm-workspace.yaml`、`biome.json`、根 `package.json` | 根目录 `pnpm build`（5 包 Done）、`pnpm typecheck`（4 包 Done）、`pnpm lint`（53 files，0 error）、`pnpm test`（14 tests passed）；`pnpm why vitest` 四包均可达；`grep -cE "^\s*(jest\|ts-jest)[-/]" pnpm-lock.yaml` 为 0。环境约定：`apps/admin/.env` 由 `.env.example` 副本生成，`data/`、`logs/`、`secrets.env` 已 gitignore |
| spec §8 九项运行时验收 | 已完成 | `apps/admin/test/health.e2e.spec.ts`、`apps/admin/src/infra/*` | #2 移走 `.env` 启动 → exit=1 且报「NODE_ENV 必填」；#3 `curl :3001/api/health` → 200 `{status:"ok"}`；#4 e2e 建临时库写入读回 + `apps/admin/data/flypig.sqlite` 自动创建；#5 带 `x-trace-id: verify-2026` 的响应头回同值且 `apps/admin/logs/admin.log` 命中 1 条；#6 `curl :3001/api/nope` → `{statusCode,message,error,path,timestamp}`；#7 `:3001/api/docs-json` info.title=`@flypig/admin`；#8 vite 代理 → `GET /api/health` 200（验证期间 5173 被仓外进程占过一次，落在 5174；该进程已不在，现在固定 5173）；#9 SIGINT 后进程干净退出 |
| 全链路 traceId + pino JSONL 落盘 | 已完成 | `packages/logger/src/{context,serializers,logger}.ts`、`apps/admin/src/infra/http/trace.middleware.ts`、`apps/admin/src/infra/logger/app-logger.service.ts` | e2e 断言响应头与日志同一 traceId；文件通道为 sync 写入（避免退出时 flush 崩溃） |
| Nest DI 约定：admin 关闭 `style/useImportType` | 已完成 | `biome.json` overrides | 曾把 `AppLoggerService` 改成 `import type` 导致 decorator metadata 退化为 `[Function]`、DI 崩溃；现在 `grep design:paramtypes apps/admin/dist/app.controller.js` 可见真实类引用 |
| web 连通验证页 + 统一请求层 + 设计令牌 | 已完成 | `apps/web/src/pages/home.tsx`、`apps/web/src/lib/{api.ts,utils.ts}`、`apps/web/src/index.css` | `pnpm dev` 起前后端，首页显示后端 status/uptime；`apiFetch` 4 条单测通过（前缀、空 body、错误归一 + traceId、网络失败）。注意：`pnpm build` 与 `pnpm dev` 同时跑会抢 dist（nest-cli `deleteOutDir`），dev 期间不要并发 build |
| 设计文档与术语表 | 已完成 | `docs/specs/2026-11-04-初始架构-design.md`、`CONTEXT.md` | 两份文件存在；设计文档含 8 节 + 对 spec 的偏移表 |
| 对 spec 的 5 处偏移回写 | 已完成 | `.qoder/spec/initial-framework-scaffolding-spec.md` | §3.1 pnpm 11.13.0、§3.3 admin 纳入 biome、§6.2/6.3 删除登录壳与 401 跳转、§8 #8 改为代理连通、全文包名改 `@flypig/*` 与 `data/flypig.sqlite` |

## 接下来做什么

1. 【阻塞项：无｜归属：入口页】入口页原样还原（视觉事实源 `docs/入口页面，这个要原样实现.jpg`，页面内容按编造数据设计）。完成后把 `apps/web` 的连通验证页换成真实首页。
2. 【阻塞项：入口页｜归属：/save 三段页】按 `.impeccable/surfaces/web-src-routes-save.md` 与 `docs/原型/功能页-三段页（已选）.png` 实现三段页：三段切换 + 三段各自输入 + 目标价虚线进度 + 推送记录。
3. 【阻塞项：无｜归属：数据管道】出「示例数据 · 一键更新」的数据 spec：数据形态、存放位置（SQLite 表 vs JSON）、opencode CLI 怎么被调用。现在 SQLite 零实体、`synchronize: true` 是骨架期口径，实体一旦定型就要切 migration。
4. 【阻塞项：无｜口径】三个遗留口径待用户定：三段页与入口页底部 tab 的合并方式；省心段「情况输入」是否可组合（带娃 + 生病）；一键更新是全部刷新还是只刷当前段。
5. 【阻塞项：总纲入库｜口径】补建总纲与 §5 口径表，把账本引用的 D1–D4 / S0–S6 / R1–R13 编号对齐。
