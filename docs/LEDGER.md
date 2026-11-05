# 账本

更新时间：2026-11-05 ｜ 当前阶段：批次 B 代码已落地、真机验收缺 key ｜ 一句话现状：批次 B 的脚本化查询 / 超时分档 / 两个 key / replan 入参已全部写进代码，146 tests 与四道门全绿；脚本真跑抓出并修掉三处问题（漏 `flyai` 前缀、非法参数打挂进程、6 并发撞 429），剩下只差注入 `BAILIAN_API_KEY` 起一次真实 refresh / replan 计时。

> 注：规则引用的总纲（§5/§7/§8）与 D1–D4 / S0–S6 / R1–R13 编号体系**已作废**——仓库内从未定义过它们。秒数与预算的唯一事实源改为 `docs/specs/2026-11-04-执行预算与密钥-design.md` §2；管道与闸门口径见 `docs/specs/2026-11-04-数据管道-design.md`；术语以 `CONTEXT.md` 为准。

## 本次做什么

| 项 | 状态 | 完成标准 |
|---|---|---|
| 照 spec 落地批次 B：查询脚本 / 超时分档 / 密钥口径 / replan 入参 | 已完成 | spec §9 第 4、5、7 条当场验过：注入参数填 `"; rm -rf /tmp/flypig-agent"` 时 job failed 且文案点名 `origin`、进程存活；三类任务 timeoutMs 断言 90/150/120；`pnpm lint/typecheck/test/build` 全绿 |
| 脚本在真 flyai 上真跑一次，确认参数与产物 | 已完成 | `planRefresh` 生成的 `run-queries.sh` 无 key 串行跑 6 次：3.2s、6 份非空 `.json`、6 份 `.err` 全空 |
| 真机跑 §9 #1 / #2（refresh 与 replan 计时） | 阻塞 | 注入 `BAILIAN_API_KEY` 后：refresh ≤150s（目标 120s）且 §9 #3 的 `raw/` 计数对得上；replan 单轮 done 且候选 ≤3；阻塞原因：`.env` 里两个 key 都没有 |

## 已完成

| 项 | 状态 | 落地位置 | 验证方式 |
|---|---|---|---|
| 查询计划与脚本文本 | 已完成 | `apps/admin/src/modules/agent/query.script.ts`（`planRefresh` / `planReplan` / `buildScript` / `seriesDates`） | `query.script.spec.ts` 8 tests：5 天连续、`watched-` 只在 refresh、replan 只当日 + 次日、无 key 无 `search-train`、串行无 `&`/`wait`、三类非法参数各自 throw 并点名字段 |
| 脚本真跑（真 flyai） | 已完成 | 同一份 `run-queries.sh` | 无 key 执行 6 次查询 3.2s、`raw/` 6 份 9.2–9.4KB、`.err` 全空；`watched-` 那份只有 1 条（班次号过滤生效） |
| 并发 429 → 改串行 | 已完成 | `query.script.ts` `buildScript` 注释与实现 | 实测 6 条并发时 4 条返回 `MCP HTTP 429 Rate limit exceeded`、raw 只剩 2 份；改串行后 6 份齐全 |
| 非法参数不再打挂进程 | 已完成 | `apps/admin/src/modules/jobs/jobs.service.ts`（`prepare` 移进 try） | 先复现：真机 POST `/api/watch`（origin 含 `"; rm -rf`）+ refresh 让 admin 进程 exit；修后同一操作 job failed、`/api/health` 仍 200；e2e「盯的航线里有 shell 元字符」回归 |
| 超时与重试按类型分档 | 已完成 | `jobs.service.ts` 的 `BUDGET`（discover 90s×2 / refresh 150s×1 / replan 120s×1）；`agent.runner.ts` 接口加 `timeoutMs`；`opencode.runner.ts` 删全局 `RUN_TIMEOUT_MS` | e2e「超时按类型分档」断言 Set(timeouts) = {90/150/120}；「refresh 失败即 failed，不重试」calls=1；「重试只留给 discover」calls=2 且第二轮提示词含上一轮失败原因 |
| 提示词改跑脚本 | 已完成 | `prompts/refresh.ts`、`prompts/replan.ts` | `prompts.spec.ts`：两份都含 `./run-queries.sh` 与具体 raw 文件名、**不含** `search-flight`/`--dep-date`；replan 含「不许自己补查」 |
| 无 `FLYAI_API_KEY` 不查火车 | 已完成 | `jobs.service.ts` 读 `process.env.FLYAI_API_KEY` → `plan.train`；两份提示词按 `plan.train` 追加「不要查火车」 | 单测「无 key 时明写不要查火车」；真跑 `search-train` 确认体验模式价格是 `4xx`/`5xx` 打码值，所以不进脚本是对的 |
| discover 第二轮带失败原因 | 已完成 | `prompts/discover.ts` 补 `retryNote` | e2e「重试只留给 discover」断言第二轮提示词含「上一轮失败原因」与首轮错误原文 |
| replan 结构化入参 | 已完成 | `dataset.controller.ts` `FlightDto` + `ReplanDto.flight`；`jobs.service.ts` 覆盖 `previous.interruption.flight` 的副本 | e2e：带 `flight` 时 `input.json` 与 `run-queries.sh` 都被覆盖（航线/当日/次日）；缺字段 400；不带则沿用快照 |
| 两个 key 写进示例 | 已完成 | `apps/admin/.env.example` | 两行带来源注释，均不进 Joi：`BAILIAN_API_KEY` 缺失走运行期报错，`FLYAI_API_KEY` 允许缺失 |
| spec 与实测对齐 | 已完成 | `docs/specs/2026-11-04-执行预算与密钥-design.md` §3.1/§3.2/§3.3/§4.1/§7/§8/§9/§11 | 脚本示例补 `flyai` 前缀并改串行 + 429 实测；日期规则改「回写等于原值」；§9 #1 验收线改 150s（目标 120s）；新增「flyai 有限流」风险行 |
| 批次 B 口径 spec | 已完成 | `docs/specs/2026-11-04-执行预算与密钥-design.md` | 四件事各有决策行 + 代码落点 + 验收；数字口径只在 §2 一张表 |
| 旧文档回写（批次 B） | 已完成 | `docs/specs/2026-11-04-数据管道-design.md` §1 决策 6/7、§5 密钥指针、§7 refresh/replan、§12 四行；`docs/specs/2026-11-04-入口页与三段页-design.md` §12 两行 | 两份旧 spec 已无与新 spec 冲突的秒数或范围 |
| 入口页（结构级原样 10 板块） | 已完成 | `apps/web/src/pages/entry/index.tsx`、`apps/web/src/pages/entry/seed.ts`、`apps/web/src/assets/home/*.png`（21 张） | 390×844 截图逐板块比对：类目 10 项、券 5 张、底 tab 5 项齐全，首屏露到新人专区；只有「机票」与三功能卡可点，其余 `div` 纯视觉 |
| 三段页外壳与三段内容 | 已完成 | `apps/web/src/pages/save/{index,money,heart,time}.tsx`、`apps/web/src/components/source-tag.tsx` | 浏览器实测：省钱段真实跑通 discover→盯这条→watch→一键更新→5 天曲线与 ¥490；省心段单轮出 summary + 3 条候选；省时间段同航线出 5 天并高亮最便宜那天 |
| 前端共享纯函数 | 已完成 | `apps/web/src/lib/{job,target,days,format}.ts` + 同名 `.test.ts` | 36 tests：`pollJob` 620s 上限与超时文案、目标价脏值当未设、推送偏好白名单丢弃、最便宜那天与结论句、曲线几何、换航线前置校验、时间文案 |
| 路由与 390 壳 | 已完成 | `apps/web/src/routes.tsx`、`apps/web/src/App.tsx`、`apps/web/src/index.css`（补 3 个 token） | `?seg=money/heart/time` 三条入口与返回箭头实测；`?seg=xx` 回落省钱段；`main` 上限 390px |
| 代理 5xx 归到「后端服务不可达」 | 已完成 | `apps/web/src/lib/api.ts`、`apps/web/src/lib/api.test.ts` | 把 web 代理指向死端口后三段页错误行显示「后端服务不可达，请确认 admin 已启动」，两页都不白屏 |
| 后端 `cheapestDays` 不匹配分支 | 已完成 | `apps/admin/src/modules/jobs/jobs.service.ts`、`apps/admin/test/pipeline.e2e.spec.ts` | e2e 断言 `{ days: [] }` 且无 `jobId` |
| 临时验证面板退役 | 已完成 | 删除 `apps/web/src/pages/home.tsx` | `pnpm build` 4 包 Done，无残留引用 |
| 设计与资产口径入库 | 已完成 | `docs/DESIGN.md` | 21 个资产逐条带裁切坐标与出处；三处取舍写明理由 |
| spec 同步（批次 A） | 已完成 | `docs/specs/2026-11-04-入口页与三段页-design.md`（§5/§8/§9/§11/§13）、`docs/specs/2026-11-04-数据管道-design.md`（§3 两处口径） | 轴标改「出发」、`{ days: [] }` 不起任务、四组纯函数测试与 `lib/format.ts` 进清单、§13 八条验收逐条有实测结论 |
| 装配与测试基建 | 已完成 | 根 `package.json` 四条命令 | `pnpm test` 146 tests（shared 18 / admin 85 / web 40 / logger 3）；`pnpm typecheck` 6 包 Done；`pnpm lint` 94 files 0 诊断；`pnpm build` 4 包 Done |

## 接下来做什么

1. 【阻塞项：`BAILIAN_API_KEY` 未注入（`.env` 只有 4 个基础变量）｜归属：批次 B】起一次真实 refresh 与一次真实 replan：计时 ≤150s / ≤120s、闸门全过、replan 候选 ≤3；顺带补 §9 #1 的 raw 计数与 §9 #3 的无 key 场景。完成标准：spec §9 第 1–3、6 条各有实测结论写回账本。
2. 【阻塞项：N 上限待定（与 120s 的冲突已消失，剩下的是并发请求数与 raw 体积）｜归属：批次 A 遗留 + 批次 D】`WatchState` 一次改到位：多航线（`watch` → `watches[]`）与目标价挪回后端（`target_price` 不再恒 0）共一次契约改动。不做多盯就只做目标价。
3. 【阻塞项：无（契约已定，见批次 B spec §6）｜归属：批次 A 遗留】省心段加结构化行程入口：界面能改被打断的航班并传 `flight`。完成标准：改成别的航线后，候选与脚本参数随之变化。
4. 【阻塞项：无，排最后｜归属：批次 C】ECS 上装并验证 `flyai` 与 `opencode`，跑通线上刷新与重规划。完成标准：线上两页各跑通一次真实任务。
