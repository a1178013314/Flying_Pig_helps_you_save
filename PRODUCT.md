# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

用户已指定架构 spec（`.qoder/spec/initial-framework-scaffolding-spec.md`）为事实源：pnpm monorepo，admin = NestJS 12 + TypeORM + SQLite（better-sqlite3），web = Vite 8 + React 19 + react-router 8 + Tailwind 4 + shadcn/ui，测试 Vitest 5，lint Biome 2.5，Node >= 22.12。智能体运行时：opencode CLI。

## Users

出行决策期的旅行用户：已在或将在飞猪类 OTA 场景中预订机票/酒店，处在"要不要买、什么时候买、行程被打断了怎么办"的决策与应变时刻。核心任务：省钱、省时间、行程中断时快速恢复。

## Product Purpose

「飞猪帮你省」是一个旅游智能体产品，围绕三个功能存在：

1. **省心**——误接驳、各种意外导致行程中断时，一键重新规划；
2. **省钱**——监听指定航班，解析用户输入，可按定制时间推送降价信息；
3. **省时间**——用户已有确定目的地，帮用户算出未来 5 天哪天走更便宜。

成功标准（用户确认）：按真实产品方向推进，工程质量优先，非一次性演示。

## Positioning

差异机制是"智能体持续替你盯着"：不是用户主动查询比价，而是 agent 监听航班、按用户自然语言输入定制推送时机、在行程中断时一键接管重规划（来源：docs/需求.md §一）。

## Operating Context

- 入口页面复刻飞猪 App 首页（docs/入口页面，这个要原样实现.jpg），**要求原样实现**，页面内部内容由本项目设计；
- 使用形态为移动 Web（H5），在浏览器移动视口内运行（用户确认，2026-11-03）；
- 开发与演示在本地（pnpm dev），交付前部署到云主机（华为云 ECS 123.60.210.134，4C/7.6G/40G，Docker 26 已就绪）。

## Capabilities and Constraints

- **无真实用户数据**：数据需由智能体编造生成，且支持"一键更新"（docs/需求.md §二）——这是产品硬约束，后续工作不得假装有真实数据源；
- 智能体运行时锁定 opencode CLI（docs/需求.md §三）；
- 模型接入：阿里云百炼 ai api（base `https://maas.qianwenaiapi.com/compatible-mode/v1`）；实测现有 key 对 token-plan 域名返回 401，token plan 需另开 key；模型清单 183 个（docs/静态文档.md，实测 2026-11-03）；
- API key 与 ECS 密码存 `secrets.env`（gitignore，不入库）；
- 架构骨架的验收标准与风险项见 spec §8/§9（SQLite synchronize、Node 22.12 基线、admin 未纳入 biome 等）。
- **未定**：三个功能的页面信息架构与流程细节；数据"一键更新"的触发入口位置；后端 RBAC/登录是否需要（spec 骨架含 AuthProvider 壳，业务未定）。

## Brand Commitments

- 产品名「飞猪帮你省」，视觉与文案沿用飞猪 App 首页的原样还原要求（docs/需求.md §五）；
- 入口页截图中的板块结构（搜索栏、类目图标墙、新人专区券包、双11 banner、特价酒店/机票卡、底部 tab）为绑定参考，实现须原样；其中数据内容为编造数据。

## Evidence on Hand

- docs/需求.md——产品需求原始文档（3 功能、数据策略、运行时、架构、页面参考）；
- docs/入口页面，这个要原样实现.jpg——飞猪 App 首页截图（入口页唯一视觉事实源）；
- .qoder/spec/initial-framework-scaffolding-spec.md——框架搭建技术 spec；
- docs/静态文档.md——模型 API 与云主机凭据说明；
- **不存在**：任何已运行代码、真实用户数据、真实供应商报价数据、测试用户。后续工作不得虚构这些。

## Product Principles

1. 智能体是核心机制，不是装饰——三个功能都由 agent 驱动（编数据、监听、规划）；
2. 数据可以是编的，但必须可一键更新、来源标注清楚，不得冒充真实数据；
3. 入口页原样还原是用户信任的起点，内页设计自由但须与之一致；
4. 按真实产品标准推进：错误处理、日志、traceId 等骨架约定（spec §7）不可省略；
5. 移动优先：一切页面以 H5 移动视口为第一形态。

## Accessibility & Inclusion

暂无产品级要求（未建立）。移动 Web 文本对比度与触控目标尺寸按平台基线执行。
