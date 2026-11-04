# 账本

更新时间：2026-11-03 ｜ 当前阶段：S0 前置准备 ｜ 一句话现状：功能页已锁定「三段页」并写下方向契约（含三种用户输入），仓库仍是零代码，下一步按 spec 搭 monorepo。

> 注：规则引用的总纲（§5/§7/§8）与 CONTEXT.md 尚未存在于仓库，本账本暂以 spec 与需求.md 为口径来源，待总纲入库后改为引用。

## 本次做什么

1. 为三个功能页出 3 版结构方案并锁定其中一版。完成标准：三版方案图可对照，用户明确选一版。
2. 把锁定方向写成可复用的方向契约。完成标准：`surface-brief read` 能读到 THESIS/OWN-WORLD/STORY/FIRST VIEWPORT/FORM/SIGNATURE/FINISH 与 seed 引用。

## 已完成

| 项 | 状态 | 落地位置 | 验证方式 |
|---|---|---|---|
| 三功能页 3 版结构原型（盯盘台 / 行程时间轴 / 三段页），各含一种输入形态 | 已完成 | `docs/原型/功能页-*.html` + 同名 `.png`（390×844 @2x）+ `.png.json` 来源记录 | 浏览器直接打开 html 即为移动首屏；`python3 -c "import json,glob;[json.load(open(f)) for f in glob.glob('docs/原型/*.png.json')]"` 不报错；`impeccable detect` 过机械检查 |
| 用户锁定「三段页」 | 已完成 | 决策回到 `concept-seed --from d3a8c6c4e147d55a --option 2`，输出 `choice recorded` | 重跑该命令返回 `choice recorded` |
| /save 方向契约（7 段 + COMP + seed） | 已完成 | `.impeccable/surfaces/web-src-routes-save.md` | `surface-brief read web/src/routes/save` 可见全部契约段、`seed: d3a8c6c4e147d55a` 与已批准方案图路径 |
| 三功能均需用户输入的约束（情况 / 航班号 / 出发地+目的地） | 已完成 | `docs/需求.md` §3–11（用户补充）；三版方案已按之重画 | 三张方案图分别可见：一行「说一句」、情况 chips、航班号输入行、出发→到达输入 |
| impeccable 安装与 PRODUCT.md | 已完成 | `.qoder/skills/impeccable/`、`PRODUCT.md` | `impeccable context` 不再报 NO_PRODUCT_MD |

## 接下来做什么

1. 【阻塞项：无｜归属：骨架搭建 S0】按 spec 搭 monorepo 骨架并过 spec §8 验收——下次会话第一件事。
2. 【阻塞项：骨架｜归属：入口页】入口页原样还原（截图即视觉事实源）。
3. 【阻塞项：骨架｜归属：/save 功能页】按三段页契约实现：三段切换 + 三段各自输入 + 目标价虚线进度 + 推送记录，数据由智能体编造且可一键更新；口径以 `.impeccable/surfaces/web-src-routes-save.md` 为准，对照物为 `docs/原型/功能页-三段页（已选）.png`。
4. 【阻塞项：入口页｜口径】三段页与入口页底部 tab 的合并方式待定；省心段「情况输入」是否可组合（带娃+生病）待定；一键更新是全部刷新还是只刷当前段待定。
5. 【阻塞项：总纲入库｜口径】补建 CONTEXT.md 与总纲文档，账本编号（D1–D4/S0–S6/R1–R13）届时对齐。