# 账本

更新时间：2026-11-04 ｜ 当前阶段：批次 A 已交付，批次 B 待开 ｜ 一句话现状：入口页与三段页两页落地并通过 spec §10 八条验收（真实 discover/refresh/replan 各跑通一次），数据管道 131 tests 全绿；卡点仍是 refresh 单轮约 200s 与 replan 常超单轮，留给批次 B。

> 注：规则引用的总纲（§5/§7/§8）尚未入库，本账本暂以 `.qoder/spec/initial-framework-scaffolding-spec.md`、`docs/specs/2026-11-04-初始架构-design.md`、`docs/specs/2026-11-04-数据管道-design.md`、`docs/specs/2026-11-04-入口页与三段页-design.md` 与 `docs/需求.md` 为口径来源，待总纲入库后改为引用。

## 本次做什么

| 项 | 状态 | 完成标准 |
|---|---|---|
| 按批次 A 的 spec 实现两页（入口页 + 三段页） | 已完成 | spec §10 八条验收逐条有实测记录（已写进该 spec §13） |
| 后端唯一改动：`cheapestDays` 航线不匹配只回空 days | 已完成 | e2e 断言 `jobId` 为 undefined，`DaysResult` 只剩 `days`；`pnpm test` 全绿 |
| 交付物同步回文档 | 已完成 | `docs/DESIGN.md` 记 token/组件约定/21 个资产的裁切坐标与三处取舍；两份 spec 按实测改写（轴标「出发」、`{ days: [] }`、§13 验收记录） |

## 已完成

| 项 | 状态 | 落地位置 | 验证方式 |
|---|---|---|---|
| 入口页（结构级原样 10 板块） | 已完成 | `apps/web/src/pages/entry/index.tsx`、`apps/web/src/pages/entry/seed.ts`、`apps/web/src/assets/home/*.png`（21 张） | 390×844 截图逐板块比对：类目 10 项、券 5 张、底 tab 5 项齐全，首屏露到新人专区；只有「机票」与三功能卡可点，其余 `div` 纯视觉 |
| 三段页外壳与三段内容 | 已完成 | `apps/web/src/pages/save/{index,money,heart,time}.tsx`、`apps/web/src/components/source-tag.tsx` | 浏览器实测：省钱段真实跑通 discover→盯这条→watch→一键更新→5 天曲线与 ¥490；省心段单轮出 summary + 3 条候选；省时间段同航线出 5 天并高亮最便宜那天 |
| 前端共享纯函数 | 已完成 | `apps/web/src/lib/{job,target,days,format}.ts` + 同名 `.test.ts` | 36 tests：`pollJob` 620s 上限与超时文案、目标价脏值当未设、推送偏好白名单丢弃、最便宜那天与结论句、曲线几何（同价不 NaN、目标价进定义域）、换航线前置校验、时间文案 |
| 路由与 390 壳 | 已完成 | `apps/web/src/routes.tsx`、`apps/web/src/App.tsx`、`apps/web/src/index.css`（补 3 个 token） | `?seg=money/heart/time` 三条入口与返回箭头实测；`?seg=xx` 回落省钱段；`main` 上限 390px |
| 代理 5xx 归到「后端服务不可达」 | 已完成 | `apps/web/src/lib/api.ts`、`apps/web/src/lib/api.test.ts` | 先写失败测试（实测只回 `Bad Gateway`）再改；把 web 代理指向死端口后三段页错误行显示「后端服务不可达，请确认 admin 已启动」，两页都不白屏 |
| 后端 `cheapestDays` 不匹配分支 | 已完成 | `apps/admin/src/modules/jobs/jobs.service.ts`、`apps/admin/test/pipeline.e2e.spec.ts` | e2e 17 tests 全绿，断言 `{ days: [] }` 且无 `jobId` |
| 临时验证面板退役 | 已完成 | 删除 `apps/web/src/pages/home.tsx` | `pnpm build` 4 包 Done，无残留引用 |
| 设计与资产口径入库 | 已完成 | `docs/DESIGN.md` | 21 个资产逐条带裁切坐标与出处；三处取舍（机票卡背景改 CSS、`rent-cat` 角标随图标裁入、banner 高度按内容）写明理由 |
| spec 同步 | 已完成 | `docs/specs/2026-11-04-入口页与三段页-design.md`（§5/§8/§9/§11/新增 §13）、`docs/specs/2026-11-04-数据管道-design.md`（§3 两处口径） | 轴标改「出发」、`{ days: [] }` 不起任务、四组纯函数测试与 `lib/format.ts` 进清单、§13 八条验收逐条有实测结论 |
| 装配与测试基建 | 已完成 | 根 `package.json` 四条命令 | `pnpm test` 131 tests（shared 18 / admin 70 / web 40 / logger 3）；`pnpm typecheck` 6 包 Done；`pnpm lint` 92 files 0 诊断；`pnpm build` 4 包 Done |

## 接下来做什么

1. 【阻塞项：无｜归属：批次 B】把 replan 预算与 refresh 提速、`BAILIAN_API_KEY` / `FLYAI_API_KEY` 口径合成一个 spec：replan 按类型给超时或压查询次数，refresh 走命令模板 + 缓存。完成标准：一次真实 replan 单轮内 done 且候选 ≤3 条；真实 refresh 稳定进 120s 内且闸门全过。
2. 【阻塞项：批次 B 的口径落定｜归属：批次 D】补建总纲与 §5 口径表，把账本引用的 D1–D4 / S0–S6 / R1–R13 编号对齐；与批次 B 的 spec 一并产出。
3. 【阻塞项：批次 A 通过验收（已过）｜归属：批次 C】ECS 上装并验证 `flyai` 与 `opencode`，跑通线上刷新与重规划。完成标准：线上两页各跑通一次真实任务。
4. 【阻塞项：批次 B｜归属：批次 A 的遗留】被打断行程只能在省心段那句话里改，界面没有结构化入口（spec §12 未定项）；批次 B 若动 replan 入参一并解决。
5. 【阻塞项：无｜归属：批次 A 的遗留】被盯航线始终只有一条（快照只有一份 watch），原型「正在盯 2 个航班」落不了地；多航线是否要做，按演示效果再定。
6. 【阻塞项：多端同步需求出现时｜归属：批次 A 的遗留】目标价只存 `localStorage`（`flypig:target:<班次>`），后端 `watch.target_price` 恒 0；挪回后端要改契约（spec 决策 11 的 shortcut）。
