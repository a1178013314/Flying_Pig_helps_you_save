/**
 * 入口页的编造内容（决策 9）：文案与数字全在这里，改内容不动布局。
 * 金额一律成品字符串，界面不做计算。
 */

export const ENTRY_SEED = {
  channels: [
    { label: "推荐", badge: "618" },
    { label: "双11", hot: true },
    { label: "国补" },
    { label: "飞猪", selected: true },
    { label: "穿搭" },
    { label: "美食" },
    { label: "数码" },
    { label: "居家" },
  ],
  search: { dropdown: "飞猪", keyword: "环球影城", tag: "旅行", button: "搜索" },
  member: {
    label: "飞猪",
    level: "F1会员",
    actions: [
      { label: "订单", tone: "bg-indigo-400" },
      { label: "优惠券", tone: "bg-brand" },
    ],
  },
  categories: [
    { key: "hotel", label: "酒店", badge: "可减200" },
    { key: "flight", label: "机票", to: "/save?seg=money" },
    { key: "train", label: "火车票" },
    { key: "car", label: "租车" },
    { key: "ticket", label: "门票" },
    { key: "rent", label: "旅行租赁" },
    { key: "transfer", label: "接送/打车" },
    { key: "visa", label: "出境游/签证" },
    { key: "homestay", label: "民宿" },
    { key: "mileage", label: "里程签到" },
  ],
  hot: ["机票次卡", "韩国签证", "天安门城楼", "三清山", "丽江古城"],
  newMember: {
    title: "飞猪新人专区",
    count: "可用12张",
    more: "查看更多权益",
    illustration: { image: "coupon-pig", caption: "立即领取" },
    coupons: [
      { amount: "15", scope: "国内酒店", limit: "至少", left: "剩6天" },
      { amount: "50", scope: "国内机票券", limit: "最高", left: "剩6天" },
      { amount: "30", scope: "景区门票", limit: "最高", left: "剩6天" },
      { amount: "20", scope: "国内酒店", limit: "最高", left: "剩2天" },
      { amount: "8", scope: "火车票券", limit: "最高", left: "剩1天" },
    ],
  },
  saveEntry: {
    title: "飞猪帮你省",
    subtitle: "说一句情况，剩下的我来算",
    tag: "示例数据",
    segments: [
      { seg: "heart", label: "省心", line: "断了怎么办" },
      { seg: "money", label: "省钱", line: "它替你盯价" },
      { seg: "time", label: "省时间", line: "哪天走更便宜" },
    ],
  },
  deals: [
    {
      title: "特价酒店",
      badge: "百元券",
      image: "hotel-photo",
      caption: "北京丽都维景酒店",
    },
    {
      title: "特价机票",
      image: null,
      lines: [
        { route: "北京→达州", price: "¥460 起 · 3.4折" },
        { route: "北京→霍林郭勒", price: "¥465 起 · 4.4折" },
      ],
    },
    {
      title: "飞猪榜单",
      badge: "双11",
      image: "rank-photo",
      caption: "出境爆款热销榜",
      place: "全球",
    },
  ],
  explore: {
    title: "探索",
    place: "全世界",
    chips: ["全部", "双11狂欢", "88VIP特惠", "亲子出游"],
    cards: [
      { image: "explore-left", title: "海岛反季捡漏", note: "三亚 · 5 天 4 晚" },
      { image: "explore-right", title: "城郊酒店清仓", note: "北京 · 周末可用" },
    ],
  },
  tabBar: [
    { key: "tao", label: "淘", active: true },
    { key: "video", label: "视频" },
    { key: "msg", label: "消息", badge: "1" },
    { key: "cart", label: "购物车" },
    { key: "me", label: "我的淘宝" },
  ],
};
