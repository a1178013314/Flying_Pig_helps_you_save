---
version: 1
slug: "web-src-routes-save"
primary_target: "web/src/routes/save"
related_targets: []
---

# /save — 三个功能页

Scope：移动 H5 的功能容器页（省心 / 省钱 / 省时间三段）及其输入行与结果卡。不含入口页复刻。
Visitor mode：Operate —— 用户来完成一件事：让我盯、让我重规划、让我比价。

## Audience / job

出行决策期的用户，正站在「要不要买 / 什么时候买 / 断了怎么办」三个时刻之一。进场时手上一定有一个最小的东西要说：一段自己的情况（带娃、身体不舒服、临时有事）、一个航班号、或一对城市。任务：说完这一句，拿到结论并知道智能体在替自己盯着。成功 = 从输入到结论在一屏内闭环，且事后能看见「它叫过我」。

## Constraints

- 数据是编的，必须显式标注「示例数据 · 一键更新」，不得冒充真实报价；
- 视觉语言继承入口页复刻的飞猪身份（橙 + 白卡 + 浅灰底），不另立世界；
- 无登录、无真实个人数据；
- 未定：三段之外的导航，以及底部 tab 如何与入口页的 tab 合并。

## Direction contract

THESIS: 三个能力各占一段，一屏只做一件事；拒绝把三件事塞进一条信息流。

OWN-WORLD: 唯一强调色飞猪橙 #FF5B23，白卡 + #F2F3F5 浅灰底，圆角 12–16px，圆形分段控件；深色 #221A17 只留给不可逆的中断；数字一律 tabular，价格永远是屏上最大字号。

STORY: 用户先认出自己站在哪一段，输入一个最小参数，立刻看到结论（最低价 / 离目标还差多少 / 新行程），再看见智能体叫过自己几次。

FIRST VIEWPORT: 品牌行 + 示例数据与一键更新 → 三段分段控件（省心带未处理红点）→ 当前段输入行（省钱：航班号 + 加盯）→ 一张大卡：¥468 现价 34px 在左、目标 ¥420 在右、4 天曲线与目标虚线 → 推送时机 chips → 推送记录。

FORM: 三段页；7 个结构里第 7 位；roll 出的第三张牌（option 2）。seed: d3a8c6c4e147d55a

SIGNATURE: 目标价虚线 —— 把「还差 ¥48」变成曲线与虚线的几何距离，降价进度不用解释。

COMP: 已批准方案图 docs/原型/功能页-三段页（已选）.png（源 docs/原型/功能页-三段页（已选）.html，390×844 @2x）；未选的两版同目录保留作对比。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- 三段与入口页底部 tab 怎么对齐（入口页复刻完成后再定）；
- 省心段的「情况输入」是单 chip 还是可组合（带娃 + 生病）；
- 一键更新是三段全刷还是只刷当前段。
