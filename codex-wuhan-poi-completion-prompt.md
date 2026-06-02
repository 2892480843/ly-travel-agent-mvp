# Codex 武汉 POI 全量修正主控提示词

> 用法：把下面「主控提示词」整段交给 Codex 执行。目标不是把全国数据改成武汉数据，而是把系统默认试点城市从杭州切到武汉，同时保留全国 POI 检索能力。

## 已确认本地事实

| 项目 | 结论 |
|---|---|
| 项目路径 | `/Users/a111/chen/code/ly` |
| 本地平台 | macOS/Darwin arm64，shell 为 `zsh` |
| 技术栈 | Vite + React + TypeScript + Node TypeScript API |
| 数据来源 | `poi-data/` 下的高德地图 Web 服务 POI 数据 |
| 数据规模 | `poi-data/VALIDATION.md` 记录：11616 条 POI、337 个城市、GCJ-02 坐标系 |
| 武汉城市元数据 | `id: "wuhan"`，`adcode: "420100"` |
| 武汉 POI 正确口径 | 优先使用 `poi-data/usable-pois-by-city.json` 的 `wuhan` 分组，共 72 条 |
| 武汉类别分布 | 8 类各 9 条：景点、美食、文化艺术、购物、亲子游、公园自然、历史遗迹、夜生活 |

## 主控提示词

```markdown
你是高级全栈工程师，正在接手 `/Users/a111/chen/code/ly` 项目。请端到端修正当前系统的数据地域问题：系统当前大量默认文案、兜底逻辑、测试、地图、票务演示仍硬编码为杭州/西湖/雷峰塔，但项目的 POI（Point of Interest，兴趣点/地理点位数据）实际是全国数据集，不是杭州单城数据。现在需要把默认试点城市优先切换为武汉，并用 `poi-data/` 中真实 POI 完善游客端、AI 助手、地图、票务演示、服务层、后端默认值、测试和文档。

## 核心目标

1. 系统默认城市从杭州改为武汉：默认 `cityId` 必须是 `wuhan`。
2. 保留全国数据能力：不要删除或缩窄 `poi-data/usable-pois.json`、`poi-data/usable-pois-by-city.json`、`poi-data/china-prefecture-cities.json` 的全国数据。
3. 武汉 POI 必须来自本地真实数据：优先从 `poi-data/usable-pois-by-city.json.wuhan` 读取，共 72 条；不得凭空编造景点、地址、坐标、评分、开放时间、票价或库存。
4. 杭州/西湖/雷峰塔只能作为明确标注的 legacy 示例存在；面向用户的默认界面、默认搜索、默认 AI 问题、默认票务演示、默认地图和验收文档都要换成武汉。
5. 票务、库存、支付仍然只能是 sandbox/demo，必须明确说明非真实官方库存、非真实支付结果。

## 必须先做的审计

先用 `rg` 定位硬编码，不要直接改：

```bash
rg -n "杭州|Hangzhou|西湖|雷峰塔|leifeng|hangzhou|ticket-leifeng-demo" src server docs scripts codex-*.md -S
```

再阅读这些关键文件：

- `poi-data/README.md`
- `poi-data/VALIDATION.md`
- `poi-data/usable-pois-by-city.json`
- `poi-data/china-prefecture-cities.json`
- `src/services/poiService.ts`
- `src/services/apiClient.ts`
- `src/services/aiService.ts`
- `src/components/common.tsx`
- `src/pages/TravelPages.tsx`
- `src/data/mockData.ts`
- `src/data/realPoiPreview.ts`
- `server/index.ts`
- `server/travelAgent.ts`
- `server/mapProvider.ts`
- 相关测试：`src/services/poiService.test.ts`、`server/travelAgent.test.ts`、`server/mapProvider.test.ts`

## 数据口径要求

武汉数据过滤必须以这些口径为准：

- 首选：`poi.cityId === "wuhan"`。
- 服务端如需校验行政区划，可接受 `poi.source.amapAdcode` 以 `4201` 开头。
- 不要用 `address.includes("武汉")` 作为武汉判断条件，因为全国数据中可能存在外地的“武汉路”等地址，会误判。
- 坐标系继续标注为 `GCJ-02`。

请先运行并确认武汉数据量：

```bash
node - <<'NODE'
const fs = require('fs');
const byCity = JSON.parse(fs.readFileSync('poi-data/usable-pois-by-city.json','utf8'));
const wuhanPois = byCity.wuhan ?? [];
const byCategory = wuhanPois.reduce((acc,p)=>{ acc[p.category]=(acc[p.category]||0)+1; return acc; }, {});
console.log({ count: wuhanPois.length, byCategory });
console.log(wuhanPois.slice(0, 12).map(p => ({ id:p.id, name:p.name, category:p.category, address:p.address, rating:p.rating, lng:p.lng, lat:p.lat, adcode:p.source?.amapAdcode })));
NODE
```

预期：`count` 为 72，8 个类别各 9 条。

## 建议实现范围

### 1. 增加城市配置

新增或调整统一配置，例如：

- `src/config/city.ts`
- `server/config/city.ts`，如果服务端已有合适配置文件，可复用

建议导出：

- `DEFAULT_CITY_ID = "wuhan"`
- `DEFAULT_CITY_NAME = "武汉"`
- `DEFAULT_CITY_OFFICIAL_NAME = "武汉市"`
- `DEFAULT_CITY_ADCODE = "420100"`
- `DEFAULT_CITY_CENTER = { lng: 114.305392, lat: 30.593098 }`
- `DEFAULT_TICKET_DEMO_POI_ID`，建议关联真实武汉 POI `wuhan-b001b0i4k0`（黄鹤楼），但票务商品仍用 sandbox/demo 标识

要求：不要把 `"wuhan"` 散落复制到多个文件；前后端能复用则复用，不能复用也要保持命名一致。

### 2. 修正 POI 服务和 fallback 数据

重点处理：

- `src/services/poiService.ts`
  - `getFeaturedPois` 默认值改为武汉。
  - `poiToScenicSpot` 的地区兜底不要再写 `"杭州"`。
  - 搜索、分类、标签逻辑要继续支持全国数据和城市过滤。
- `src/data/realPoiPreview.ts`
  - 当前是杭州预览数据，必须替换为武汉真实 POI 子集。
  - 子集必须从 `poi-data/usable-pois-by-city.json.wuhan` 抽取，不得手写虚构数据。
  - 至少覆盖景点、美食、文化艺术、公园自然、历史遗迹、夜生活等关键类别。
  - 如选择直接在前端导入完整 JSON，必须评估 bundle 体积；更推荐生成/维护一个武汉 fallback 子集，服务端仍读全量。
- `src/services/apiClient.ts`
  - 无后端 fallback 时默认返回武汉 POI。
  - `fetchPoi` 默认兜底不要回杭州。

### 3. 修正游客端页面

重点替换 `src/pages/TravelPages.tsx`：

- 首页英文/中文城市定位从杭州改为武汉。
- 今日推荐、热门路线、演出/活动、AI 热门问题、行程规划、详情页、地图页默认内容改为武汉。
- 推荐页 `fetchPois({ cityId: "hangzhou" ... })` 改为武汉配置。
- 景点详情默认从杭州灵隐寺改为武汉真实 POI，例如黄鹤楼 `wuhan-b001b0i4k0` 或湖北省博物馆。
- 票务预约页从雷峰塔改为黄鹤楼 sandbox/demo 票务预约；文案必须说明票务/库存/支付是演示。
- 路由可以继续使用旧路径一轮兼容，但面向用户标签不要再叫“雷峰塔预约”；更推荐新增 `/ticket/yellow-crane-tower`，并保留旧 `/ticket/leifeng` 重定向或兼容入口。

武汉候选点位可优先使用这些真实 POI：

- 黄鹤楼：`wuhan-b001b0i4k0`
- 黄鹤楼公园：`wuhan-b001b0iy32`
- 湖北省博物馆：请从 `wuhan` 分组中查询真实 id
- 江汉关博物馆：`wuhan-b001b08bc3`
- 汉口江滩-观江台：`wuhan-b0ffhtu92u`
- 武昌江滩：`wuhan-b001b0ipsg`
- 解放公园：`wuhan-b001b0izt0`
- 中山公园：`wuhan-b001b00022`

### 4. 修正 AI 助手

重点处理：

- `src/services/aiService.ts`
- `server/travelAgent.ts`
- `src/components/common.tsx` 中 AI 初始消息和 quick questions

要求：

- 默认城市改为武汉。
- 示例问题改为：
  - `武汉一日游，带老人，少排队`
  - `帮我预约黄鹤楼上午票`
  - `推荐武汉周边亲子景点`
  - `武汉最近有什么活动？`
- 意图识别要支持武汉关键词：`黄鹤楼`、`湖北省博物馆`、`江汉关`、`江滩`、`东湖` 等；如果本地 POI 没有某个点，必须返回“未命中稳定 POI 候选”，不得编造。
- 工具调用摘要中的“命中杭州真实 POI 候选”改为“命中武汉真实 POI 候选”或使用动态城市名。
- 票务 fallback 从雷峰塔改为黄鹤楼 sandbox/demo。

### 5. 修正地图和路线

重点处理：

- `src/components/common.tsx` 的 `MapPanel`
- `server/mapProvider.ts`
- `server/mapProvider.test.ts`

要求：

- 地图默认中心改为武汉中心或首个武汉 POI。
- 本地静态地图 fallback pins 改为武汉 POI，不再显示雷峰塔/苏堤/断桥等杭州点。
- 服务端 route/geocode 默认 `cityId` 改为武汉。
- `resolveCity` 默认优先武汉，但仍支持全国其他城市。

### 6. 修正票务、订单、运营数据

重点处理：

- `server/db.ts`
- `server/repositories.ts`
- `server/providerBoundary.test.ts`
- `server/repositories.test.ts`
- `scripts/api-smoke.mjs`
- `docs/ops-checklist.md`
- `docs/deployment.md`

要求：

- 将 `ticket-leifeng-demo` 替换或迁移为武汉黄鹤楼 demo，例如 `ticket-yellow-crane-tower-demo`。
- demo 票务必须和真实武汉 POI 建立可追溯关联，推荐关联 `wuhan-b001b0i4k0`。
- 库存、票价、支付全部标注 sandbox/demo，不得写成真实官方票源。
- 后台告警、商户、审核、知识库示例从西湖/雷峰塔改为武汉/黄鹤楼/江汉关/湖北省博物馆等。

### 7. 修正文档和旧提示词

重点处理：

- `docs/mvp-spec.md`
- `docs/e2e-validation.md`
- `codex-development-prompts.md`
- `codex-production-prompts.md`

要求：

- 明确系统数据是全国 POI 数据集。
- 明确当前默认试点城市是武汉，不是杭州。
- 验收标准改成：
  - `/api/pois?cityId=wuhan` 返回武汉真实 POI。
  - 前端推荐页默认展示武汉真实 POI。
  - AI 输入“武汉一日游，带老人，少排队”返回武汉 POI 推荐。
  - AI 输入“帮我预约黄鹤楼上午票”只返回 sandbox 票务候选，不假装真实支付完成。
  - 地图无高德 JS key 时，本地 fallback 也展示武汉点位。

### 8. 测试和验收

至少更新并运行：

```bash
npm test
npm run build
```

如果后端 smoke test 依赖服务启动，请说明启动步骤，并在可行时执行：

```bash
npm run build:server
npm run dev:server
npm run smoke:api
```

额外验收命令：

```bash
node - <<'NODE'
const fs = require('fs');
const byCity = JSON.parse(fs.readFileSync('poi-data/usable-pois-by-city.json','utf8'));
console.log('wuhan count:', byCity.wuhan?.length);
NODE
```

```bash
rg -n "杭州|Hangzhou|西湖|雷峰塔|leifeng|hangzhou|ticket-leifeng-demo" src server docs scripts codex-*.md -S
```

第二条命令不是要求零结果，而是要求：

- 用户默认界面、默认业务流程、默认测试不再依赖杭州。
- 若仍保留旧词，必须是 legacy 兼容、历史说明、迁移提示或明确的非默认全国示例。

## 输出要求

完成后用中文输出：

1. 结果摘要：是否完成武汉默认试点切换，是否保留全国 POI。
2. 修改文件列表：按前端、服务端、数据/文档、测试分组。
3. 验证结果：列出执行过的命令和结果。
4. 剩余风险：例如真实票务未接入、天气/客流仍为演示、部分老路由兼容仍存在。
5. 后续建议：优先补齐真实票务 provider、POI 增量更新、城市切换器、运营数据真实化。

## 禁止事项

- 不得删除全国 POI 数据。
- 不得把武汉以外的“武汉路”等地址误判为武汉城市数据。
- 不得编造 POI、票价、库存、开放时间、用户评论。
- 不得把 sandbox/demo 写成真实官方票源。
- 不得大规模重构无关代码。
- 不得回退用户已有改动。
```

