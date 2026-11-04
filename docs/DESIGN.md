# DESIGN.md — apps/web 两页的视觉与资产出处

范围：入口页（`/`）与三段页（`/save`）。视觉事实源两份：`docs/入口页面，这个要原样实现.jpg`（1080×2400，结构级原样）与 `docs/原型/功能页-三段页（已选）.html`（390×844，已批准方案图的源码）。方向契约见 `.impeccable/surfaces/web-src-routes-save.md`。

## 1. token（`apps/web/src/index.css` 的 `@theme`）

| token | 值 | 用在哪 | 出处 |
|---|---|---|---|
| `--color-brand` | `#ff5b23` | 主按钮、现价折线、选中下划线 | 方向契约 OWN-WORLD |
| `--color-brand-deep` | `#ff4e00` | 现价数字、选中段文字、强调角标 | 原型 `.seg div.on` / `.prices .now` |
| `--color-brand-soft` | `#ffede3` | 入口页头部与卡片区底、三段页头部底 | 原型 `.statusbar` / `.head` |
| `--color-surface` | `#f2f3f5` | 页面底 | 方向契约 |
| `--color-surface-sunken` | `#f2f3f5` | 卡内浅灰条（结论句、条形底、次级按钮） | 原型 `.delta` / `.foot .sec` |
| `--color-ink` | `#221a17` | 正文 | 方向契约 |
| `--radius-card` / `--radius-chip` | 16px / 12px | 卡片 / 胶囊 | 方向契约「圆角 12–16px」 |
| `--text-price` | 34px | 现价数字 | 原型 `.prices .now` |

约定：数字一律 `tabular-nums`；价格永远是所在卡片最大字号；不引组件库（tailwind + 上面四种件够用）。

## 2. 两页的壳

- `App.tsx` 的 `main` 是 390px 居中容器，两页都按 390 排版，宽屏只留白。
- 入口页底部 tab 用 `div`（不可点的东西不进 tab 顺序、不长成像按钮）；三段页自带头部与底部按钮区，不挂入口页 tab。
- 三段页头部左侧 36px 圆形返回键（原型没有，窄屏浏览器没有可靠返回手势）。
- 每张数据卡右下角一行 11px 来源小字，由 `components/source-tag.tsx` 统一渲染，三种取值见 spec §4。

## 3. 入口页资产 provenance

源图：`docs/入口页面，这个要原样实现.jpg`（1080×2400）。全部用 macOS 自带 `sips` 裁切，命令模板：

```
sips -c <高> <宽> --cropOffset <y> <x> docs/入口页面，这个要原样实现.jpg --out apps/web/src/assets/home/<名>.png
```

坐标是 1080×2400 图上的像素值（`x` 为左边缘，`y` 为上边缘），一次性脚本跑完即弃、不入库。

| 文件 | 宽×高 | x | y | 用在 |
|---|---|---|---|---|
| `avatar.png` | 85×85 | 28 | 338 | 会员行头像 |
| `hotel-cat.png` | 122×118 | 47 | 478 | 类目「酒店」 |
| `flight-cat.png` | 128×128 | 260 | 468 | 类目「机票」（唯一可点，进省钱段） |
| `train-cat.png` | 128×128 | 476 | 468 | 类目「火车票」 |
| `car-cat.png` | 128×128 | 692 | 468 | 类目「租车」 |
| `ticket-cat.png` | 128×128 | 908 | 468 | 类目「门票」 |
| `rent-cat.png` | 95×95 | 60 | 648 | 类目「旅行租赁」 |
| `transfer-cat.png` | 95×95 | 276 | 648 | 类目「接送/打车」 |
| `visa-cat.png` | 95×95 | 492 | 648 | 类目「出境游/签证」 |
| `homestay-cat.png` | 95×95 | 708 | 648 | 类目「民宿」 |
| `mileage-cat.png` | 95×95 | 924 | 648 | 类目「里程签到」 |
| `coupon-pig.png` | 240×235 | 30 | 1072 | 新人专区「免费升房」插画 |
| `hotel-photo.png` | 300×165 | 30 | 1715 | 特价酒店配图 |
| `rank-photo.png` | 305×125 | 680 | 1715 | 飞猪榜单配图 |
| `explore-left.png` | 490×160 | 30 | 2060 | 探索区左图 |
| `explore-right.png` | 495×160 | 555 | 2060 | 探索区右图 |
| `tab-tao.png` | 105×90 | 63 | 2240 | 底 tab「淘」 |
| `tab-video.png` | 70×60 | 294 | 2245 | 底 tab「视频」 |
| `tab-msg.png` | 70×62 | 505 | 2243 | 底 tab「消息」 |
| `tab-cart.png` | 70×62 | 724 | 2243 | 底 tab「购物车」 |
| `tab-me.png` | 70×62 | 938 | 2243 | 底 tab「我的淘宝」 |

文字、金额、券面、角标一律不裁进图：由 `pages/entry/seed.ts` 出文案，橙块/角标/红点/下划线用 CSS 画。

### 裁切取舍（三处偏离 spec §3.2）

1. **特价机票卡背景没裁**：截图上那张卡的蓝色块整块是文字，裁下来会和我们自己的文案叠两层；改用 CSS 渐变（`from-sky-300 to-sky-500`），符合「纯 CSS 能画的一律不裁」。
2. **`rent-cat.png` 里的「大疆9.9」角标是裁进来的**：原图角标压在图标上，无法只裁图标；所以旅行租赁这一格不再叠 CSS 角标，其余角标（可减200、百元券、双11、消息红点）都是 CSS。
3. **功能入口 banner 比截图的双11 banner 高约 40px**：宽度、圆角、位置不变；要塞三张可点卡与一句人话，高度按内容走。

## 4. 三段页与原型的一致性

省钱段卡片、曲线（318×104 SVG、当前点实心 / 最低点空心、目标虚线）、推送 chips、推送记录、底部双按钮全部按原型 HTML 的类名与尺寸移植；曲线轴标把出发日标成「出发」而不是「今天」——快照里 `watch.date` 不一定是今天，标「今天」会说谎。
