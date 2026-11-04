# 账本

更新时间：2026-11-04 ｜ 当前阶段：数据管道已交付（S0 前置准备完成）｜ 一句话现状：管道代码按 spec v5 落地并跑通真实链路，深度思考已关（discover 50s→21s），95 tests 全绿；卡点是 refresh 属 I/O bound 压不到 200s 以内、replan 真实单轮跑不完，且三段页与入口页仍不存在。

> 注：规则引用的总纲（§5/§7/§8）尚未入库，本账本暂以 `.qoder/spec/initial-framework-scaffolding-spec.md`、`docs/specs/2026-11-04-初始架构-design.md`、`docs/specs/2026-11-04-数据管道-design.md` 与 `docs/需求.md` 为口径来源，待总纲入库后改为引用。

## 本次做什么

| 项 | 状态 | 完成标准 |
|---|---|---|
| 按 spec v4 用 TDD 实现数据管道（契约守卫 / 三道闸门 / 执行器 / 状态机 / 快照与接口 / 验证面板） | 已完成 | spec §10 七条验收逐条有验证记录；根目录 `pnpm test` / `pnpm typecheck` / `pnpm lint` 全绿 |
| 把实测校正回写 spec（v4 → v5） | 已完成 | §0.3 实测表、决策 7 超时、§2 `input.json`、§3 `notes` 与 cheapest-days、§4 入参、§5 四条实测修正、§8 落点、§9 测试数、§10 验收表、§12 风险，全部与代码一致，无「待实测」项 |
| replan 真实链路单独验收 | 阻塞 | 一次真实 replan 在单轮超时内 done，且 `candidates` ≤3 条真实班次；否则按类型放宽超时并回写 spec |

## 已完成

| 项 | 状态 | 落地位置 | 验证方式 |
|---|---|---|---|
| 数据契约与手写守卫（前后端同源，不引 zod） | 已完成 | `packages/shared/src/dataset.ts`、`packages/shared/src/dataset.test.ts` | 18 tests：`parseDataset` 拒缺 `meta` / `series` 非数组 / `price` 为字符串，错误带字段路径；`parseOffers` / `parsePlan`（候选 >3 拒）/ `isNeedQuestion` 覆盖 |
| 三道闸门（结构 / 完整 / 有据） | 已完成 | `apps/admin/src/modules/agent/agent.gate.ts`、`apps/admin/test/fixtures/{raw/flight.json,raw/flight-live.json,offers.from-raw.json}` | 14 tests，fixture 用 2026-11-04 真实录制的 flyai stdout：价格改 `1` → 「有 1 个价格在原始输出里找不到」；缺 11-08 → 写明缺哪天；host 非 `router.feizhu.com` → 拒；raw 为空 → 全拒；`meta.updated_at` / `mode` 后端覆盖（真实 raw 含「体验模式」→ trial，另一份 fixture → live） |
| AgentRunner 接缝 + opencode 执行器 | 已完成 | `apps/admin/src/modules/agent/{agent.runner.ts,opencode.runner.ts,agent.tokens.ts}` | 12 tests：执行目录形状（`raw/`、只读 skill 副本、`opencode.json` 的 model 与 permission、`input.json`）、skill hash 篡改可检出、成功即删 / 失败保留、7 天清理、PATH 里 `flyai` 可执行、缺 `BAILIAN_API_KEY` 直接给失败原因；`RUN_TIMEOUT_MS = 300_000` 由测试锁住 |
| 三类任务提示词 | 已完成 | `apps/admin/src/modules/agent/prompts/{common,discover,refresh,replan}.ts` | 12 tests：公共纪律（raw / 不许编造 / 反问出口）、refresh 写明 5 天逐天各查一次、重试带上轮失败原因、只给班次号时标注「未提供」并要求交 `need` |
| job 状态机与管道编排 | 已完成 | `apps/admin/src/modules/jobs/{job.registry.ts,jobs.service.ts}` | 9 + 17 tests：同类型在跑复用 jobId、终态后是新 job、不交产物重试一轮、闸门拒或 runner 抛错时旧快照不动、skill 被改写判失败、成功即删执行目录 |
| 快照存储与 6 条接口 | 已完成 | `apps/admin/src/modules/dataset/{dataset.entity.ts,dataset.service.ts,dataset.controller.ts,dataset.seed.ts}`、`apps/admin/src/modules/jobs/jobs.controller.ts` | e2e：空库 `GET /api/dataset` 回种子；`POST /api/dataset/refresh|discover|replan` 202 + jobId；`POST /api/watch` 200 只写骨架；`GET /api/cheapest-days` 命中缓存不起任务；`GET /api/jobs/:id`；replan 情况超 200 字 → 400 |
| 关掉深度思考（模型级 `options.enable_thinking: false`） | 已完成 | `apps/admin/src/modules/agent/opencode.runner.ts` 的 `buildOpencodeConfig()` | 实测同一提示词 reasoning 33→0 token、2448ms→1145ms；真实 discover 50s→21s；refresh 175s→208s（I/O bound，未变快）；由测试锁住配置字段 | discover 约 50s 出 10 条真实班次并过闸门；refresh 单轮 175s 出 5 天逐天真最低价（450/350/260/250/220）+ `push_log` 5 条 + `notes` 自陈放弃打码火车价；只给 `MU5101` 7s 回 `need` 反问；阶段文案在 11-06/11-07/11-08/11-10 间跳 |
| 临时验证面板 | 已完成 | `apps/web/src/pages/home.tsx` | 浏览器打开 `localhost:5173/`：显示来源（体验模式标注）、示例数据标记、盯的班次、更新时间、5 天价格、discover 表单（含「班次号（可只填这个）」）、replan 输入框 |
| flyai 作为仓库依赖落地 | 已完成 | `apps/admin/package.json`（`@fly-ai/flyai-cli@1.0.16`）、`pnpm-lock.yaml` | `apps/admin/node_modules/.bin/flyai --help` 可执行；真实 job 由 `agentEnv()` 前置该目录后取到真价 |
| 装配与测试基建调整 | 已完成 | `apps/admin/src/app.bootstrap.ts`（抽出 `configureApp`）、`apps/admin/src/app.module.ts`、`apps/admin/vitest.config.mts` 未改、`biome.json`（`unsafeParameterDecoratorsEnabled` + 排除 `test/fixtures` 与 `.opencode`） | `pnpm build` 4 包 Done；`pnpm typecheck` 6 包 Done；`pnpm lint` 78 files 0 诊断；`pnpm test` 95 tests 全绿（shared 18 / admin 70 / web 4 / logger 3） |
| 官方 flyai skill 入库 | 已完成 | `.opencode/skills/flyai/SKILL.md`（逐字节复制，MIT） | 真实 job 里 agent 加载该 skill 并靠 `flyai --help` 自探参数跑通；正文是 flyai-cli 仓库 README，无参数表（已记进 spec §5 与 §12） |
| spec v5 与术语表同步 | 已完成 | `docs/specs/2026-11-04-数据管道-design.md`、`CONTEXT.md` | spec 242 行、12 节与代码一致；§10 验收表逐条标注验证方式；术语表新增「任务输入」并改写「执行目录」「刷新任务」 |

## 接下来做什么

1. 【阻塞项：无｜归属：/save 三段页】按 `.impeccable/surfaces/web-src-routes-save.md` 与 `docs/原型/功能页-三段页（已选）.png` 实现三段页：省钱/省心走 `GET /api/dataset`，省时间走 `GET /api/cheapest-days`，用户设定存 localStorage。数据源与接口已就绪，曲线是未来 5 天（无历史价数据源），原型的 4 天历史轴需调整。
2. 【阻塞项：无｜归属：数据管道】replan 按类型给超时或压缩查询次数：实测 replan 单轮 >300s 触发强杀重试。完成标准：一次真实 replan 在单轮内 done 且候选 ≤3 条。
3. 【阻塞项：无｜归属：数据管道】refresh 提速（瓶颈已量清：flyai 单次 0.6s、每轮模型往返 1.4s 且重发 ~10k token，200s 全花在轮次上）。按性价比做三件事：提示词给死命令模板把 5 天压进一次并发 shell、SKILL.md 瘦身去掉对 agent 无用的 README 段落、后端按 `(航线, 日期)` 缓存当天最低价只补缺失天。完成标准：真实 refresh 稳定进 120s 内，且闸门与 raw 佐证仍全过。
3. 【阻塞项：无｜归属：口径】`BAILIAN_API_KEY` 的正式注入方式：当前是我从 `~/.bailian/config.json` 临时传给进程环境，未写进 `apps/admin/.env`（该文件已 gitignore）。完成标准：部署 spec 里写明 key 来源与缺失时的行为（直接 failed，不重试）。
4. 【阻塞项：无｜归属：口径】注入 `FLYAI_API_KEY` 后重跑酒店/门票/火车，确认打码是否消失。当前体验模式下 replan 的火车候选必然为空（agent 已在 `notes` 里交代）。
5. 【阻塞项：无｜归属：入口页】入口页原样还原（视觉事实源 `docs/入口页面，这个要原样实现.jpg`），替换临时验证面板。
6. 【阻塞项：无｜归属：部署】在 ECS 上装并验证 `flyai` 与 `opencode`（两者都能出结果），否则线上刷新与重规划必然 failed。
7. 【阻塞项：总纲入库｜归属：口径】补建总纲与 §5 口径表，把账本引用的 D1–D4 / S0–S6 / R1–R13 编号对齐。
