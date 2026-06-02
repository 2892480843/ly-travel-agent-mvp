# 可用 POI 数据

这份数据按 `deep-research-report.md` 的文旅智能体需求清理：只保留真实 POI 元数据、城市数据、来源审计和可解释的衍生字段。

## 保留

- `usable-pois.json`：可用于检索、推荐、导览和路线规划候选召回的 POI。
- `usable-pois.csv`：同一数据的 CSV 版本。
- `usable-pois-by-city.json`：按 `cityId` 分组的 POI。
- `china-prefecture-cities.json`：城市元数据。
- `poi-source-audit.json`：POI 来源审计。
- `usable-poi-summary.json`：清理后的统计摘要。

## 已删除/未保留

- 手工演示 POI、伪造用户评论、mock 用户、mock 天气、mock 行程、mock 动态事件。
- 相对地图坐标 `x/y`、演示距离 `distance`、空 `reviews`、无可信来源的 `reviewCount`。
- 默认门票占位文本、无可信来源价格、泛化 AI 推荐理由。
