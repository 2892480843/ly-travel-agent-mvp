# 生活智能体文旅体 MVP

本项目是 Vite + React + TypeScript 的文旅智能体 MVP，覆盖游客端、运营端、商户端。当前版本接入了 `poi-data/` 真实 POI 数据、本地 Node API、SQLite 持久化、sandbox 认证、票务锁票、sandbox 支付和地图 fallback provider，同时保留无后端、无模型 key 时的演示 fallback。

## 功能清单

| 端 | 能力 |
|---|---|
| 游客端 | 首页、AI 旅行助手、真实 POI 推荐、景点详情、行程规划、票务预约、演示支付、电子凭证、我的订单、套餐、沉浸体验、地图 |
| 运营端 | 运营看板、内容与商户管理、知识库、活动专题、审核中心、工作流配置 |
| 商户端 | 营业状态、库存同步、订单列表、核销入口演示 |
| 技术底座 | POI 服务层、API client、Node API、SQLite 数据层、sandbox auth、RBAC、票务锁票、支付 adapter、地图 adapter、localStorage fallback、Vitest 测试、lazy loading 分包 |

## 本地启动

```bash
npm install
cp .env.example .env
npm run dev
```

前端默认由 Vite 启动。若需要 API：

```bash
npm run build:server
npm run dev:server
```

另开一个终端启动前端，并在 `.env` 中配置：

```bash
VITE_API_BASE_URL=http://localhost:8787
```

AI 助手现在优先调用服务端 `/api/agent/chat`。前端不再需要、也不应配置模型 API Key；未启动后端时会自动回到浏览器本地 deterministic fallback。

生产部署前必须替换 session secret，可用以下命令生成安全随机值，并通过部署环境注入，不要提交到仓库：

```bash
npm run secret:generate
```

## 验证命令

```bash
npm test
npm run readiness
npm run build:server
npm run build
```

## 演示账号

当前是前端演示鉴权，不是真实认证。顶部角色下拉可切换：

| 角色 | 可访问范围 |
|---|---|
| 游客 | 游客端页面 |
| 运营人员 | 运营后台 |
| 审核人员 | 审核中心 |
| 商户 | 商户工作台 |
| 管理员 | 全部页面 |

## 环境变量

参考 `.env.example`。服务端 Web Service Key 只放服务端环境变量；浏览器端高德 JSAPI 需要单独申请 Web 端 Key，并在高德控制台限制可用域名：

| 变量 | 说明 |
|---|---|
| `AUTH_SESSION_SECRET` | 服务端 session 预留签名/加密密钥；生产不得使用 `.env.example` 默认值，建议用 `npm run secret:generate` 生成 |
| `AI_PROVIDER` / `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | 服务端 Agent 可选模型配置；无 Key 时 `/api/agent/chat` 使用 deterministic Agent fallback |
| `MAP_PROVIDER=amap` | 启用高德 Web 服务 provider；未配置或配置为 `fallback` 时使用本地 deterministic fallback |
| `MAP_API_KEY` | 高德 Web 服务 Key，只在 Node API 中使用，不暴露给前端 |
| `VITE_API_BASE_URL` | 前端访问本地 Node API 的地址 |
| `VITE_AMAP_JS_KEY` | 高德 JSAPI Web 端公开 Key，用于浏览器加载真实地图 |
| `VITE_AMAP_SECURITY_JS_CODE` / `VITE_AMAP_SERVICE_HOST` | 高德 JSAPI 安全配置；本地开发可用 `securityJsCode`，生产环境优先配置代理服务 |
| `PAYMENT_PROVIDER=sandbox` | 本地演示支付 provider；生产禁止使用 `sandbox` |
| `PAYMENT_API_BASE_URL` / `PAYMENT_API_KEY` / `PAYMENT_WEBHOOK_SECRET` | 非 sandbox 支付 provider 的基础接入材料；真实厂商协议未接入前 adapter 会 fail-closed |
| `TICKET_PROVIDER=sandbox` | 本地黄鹤楼演示票务 provider；不代表真实官方库存、出票或支付，生产禁止使用 `sandbox` |
| `TICKET_API_BASE_URL` / `TICKET_API_TOKEN` / `TICKET_API_SECRET` | 非 sandbox 票务 provider 的基础接入材料；真实厂商接口未接入前 adapter 会 fail-closed |

无真实支付、地图、票务或模型 Key 时，本地演示可使用 `sandbox` 或 `fallback` provider，敏感状态仍由服务端维护。生产模式会 fail fast：默认 `AUTH_SESSION_SECRET`、`PAYMENT_PROVIDER=sandbox`、`TICKET_PROVIDER=sandbox` 或非 sandbox provider 缺少必要密钥都会阻止启动或 readiness 通过。

## 数据库与联调

```bash
npm run db:init
npm run dev:server
```

服务端运行后可执行 API 冒烟脚本：

```bash
npm run smoke:api
```

Agent 与地图接口可单独验收：

```bash
curl -s http://localhost:8787/api/maps/pois/nearby?cityId=wuhan\&keyword=黄鹤楼\&limit=2
curl -s -X POST http://localhost:8787/api/maps/route -H 'Content-Type: application/json' -d '{"mode":"walking"}'
curl -s -X POST http://localhost:8787/api/agent/chat -H 'Content-Type: application/json' -d '{"input":"黄鹤楼一日游，带老人，少排队"}'
```

浏览器地图联调需在 `.env` 中补充高德 JSAPI 配置：

```bash
VITE_AMAP_JS_KEY=your-amap-jsapi-web-key
VITE_AMAP_SECURITY_JS_CODE=your-amap-jsapi-security-code
```

默认 sandbox 登录密码为 `sandbox`。该密码以 PBKDF2 hash 写入 SQLite seed 数据，不以明文保存。

## 演示脚本

1. 游客端：首页进入“推荐”，筛选武汉真实 POI，查看黄鹤楼详情。
2. AI 助手：输入“黄鹤楼一日游，带老人，少排队”，观察工具调用状态、置信度和推荐卡片。
3. 票务：进入“黄鹤楼预约”，选择票种、日期、时段、数量，提交订单前会先锁定 sandbox 候选库存。
4. 支付：在支付页点击“演示支付”，服务端创建 sandbox 支付并确认票务，进入电子凭证，再到“我的行程”查看订单。
5. 权限：尝试以游客进入运营后台，再切换管理员访问全部。
6. 运营端：进入看板查看 API/fallback 指标；在商户管理新增商户并同步库存。
7. 审核端：进入审核中心，查看条目，尝试驳回时不填备注会被校验拦截。
8. 商户端：切换商户角色，进入商户工作台，切换营业状态并触发库存同步。

## 验收清单

| 验收项 | 步骤 |
|---|---|
| 真实 POI | 推荐页显示武汉真实 POI；API 启动后 `/api/pois?cityId=wuhan` 返回武汉数据 |
| AI fallback | 不配置 key 时，AI 助手仍可回答并提示来源 |
| Agent 编排 | `/api/agent/chat` 返回中文建议、推荐卡片、工具调用状态和来源说明 |
| 高德地图 | 配置 `MAP_PROVIDER=amap`、`MAP_API_KEY` 后服务端地图接口优先调用高德；配置 `VITE_AMAP_JS_KEY` 后 `/map` 页面渲染高德 JS 地图；无 Key 或失败时返回/展示 fallback |
| 票务订单 | 预约、演示支付、电子凭证、我的订单状态可串联 |
| 后台操作 | 商户新增、库存同步、FAQ 发布状态、活动上下架、审核通过/驳回可改变状态 |
| 权限 | 不同角色访问受限，管理员可访问全部 |
| 工程质量 | `npm test`、`npm run build:server`、`npm run build` 通过 |

生产化推进前可执行 `npm run readiness` 查看本地 MVP 就绪状态；正式上线前使用 `npm run readiness:prod`，该模式会把 sandbox/fallback provider、默认 session secret、缺失真实密钥等判定为阻塞项。服务端在 `NODE_ENV=production`、`APP_ENV=production`、`LY_ENV=production` 或 `READINESS_MODE=production` 时也会执行同类生产配置校验。

## 已知边界

- 当前没有真实支付扣款、真实第三方票务接口或生产级身份认证；支付和票务已有 provider 边界与生产配置校验，但非 sandbox adapter 在缺少厂商协议时保持 fail-closed；高德 REST provider 与 JS 地图已按 Key 配置启用，未配置时仍使用 provider adapter 与 fallback。
- 后端订单、票务锁、支付、商户、审核和审计日志已进入 SQLite；前端 `localStorage` 仅作为后端不可用时的 fallback。
- `poi-data/usable-pois.json` 体积较大，前端 fallback 使用真实子集，后端 API 使用全量文件。
