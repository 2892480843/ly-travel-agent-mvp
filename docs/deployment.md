# 部署说明

## 目标与边界

本项目当前支持本地生产化过渡部署：前端使用 Vite 构建，服务端使用 Node API，数据持久化使用 SQLite。真实支付、地图和票务服务通过 provider adapter 预留；未配置第三方密钥时，本地演示可使用 sandbox/fallback。生产模式禁止把 sandbox/fallback 宣称为真实生产能力。

## 环境变量

| 变量 | 说明 | 本地默认 / 生产要求 |
|---|---|---|
| `PORT` | Node API 端口 | `8787` |
| `DATABASE_URL` | SQLite 数据库位置 | `file:./data/ly.sqlite` |
| `AUTH_COOKIE_NAME` | Session Cookie 名称 | `ly_session` |
| `AUTH_SESSION_SECRET` | Session 预留签名/加密密钥 | 本地可用示例值；生产必须用 `npm run secret:generate` 生成并由环境注入 |
| `PAYMENT_PROVIDER` | 支付 provider | 本地 `sandbox`；生产必须改为真实 provider 名称 |
| `PAYMENT_API_BASE_URL` | 支付 provider API 地址 | 非 sandbox 必填 |
| `PAYMENT_API_KEY` | 支付 provider API 密钥 | 非 sandbox 必填 |
| `PAYMENT_WEBHOOK_SECRET` | Webhook 验签密钥 | 非 sandbox 必填 |
| `MAP_PROVIDER` | 地图 provider | 本地可 `fallback`；生产建议 `amap` |
| `MAP_API_KEY` | 高德 Web 服务 key，只给 Node API 使用 | 真实 provider 必填 |
| `TICKET_PROVIDER` | 票务 provider | 本地 `sandbox`；生产必须改为真实 provider 名称 |
| `TICKET_API_BASE_URL` | 票务 provider API 地址 | 非 sandbox 必填 |
| `TICKET_API_TOKEN` | 票务 provider token | 非 sandbox 必填 |
| `TICKET_API_SECRET` | 票务 provider 签名或加密密钥 | 非 sandbox 必填 |
| `VITE_API_BASE_URL` | 前端访问 API 地址 | 留空（推荐）：同源 `/api` 经 Vite/反向代理转发；仅独立 API 域名时填绝对地址 |
| `VITE_DATA_MODE` | 前端数据模式：`demo` 静默兜底 / `live` 标注演示内容并对服务故障弹横幅 | 留空自动：开发→`demo`，生产构建→`live` |
| `VITE_PAYMENT_PROVIDER` | 前端创建支付时传递的 provider | 本地 `sandbox`；生产应与 `PAYMENT_PROVIDER` 对齐 |
| `VITE_AMAP_JS_KEY` | 高德 JSAPI Web 端公开 Key，用于浏览器地图 | 按部署域名限制 |
| `VITE_AMAP_SECURITY_JS_CODE` | 高德 JSAPI 安全密钥，本地开发可直接配置 | 生产优先代理 |
| `VITE_AMAP_SERVICE_HOST` | 高德 JSAPI 代理地址，和安全密钥二选一 | 生产建议配置 |

## 环境矩阵（demo vs live）

系统的环境区分贯穿前后端两层，部署前请按此对照：

| 维度 | 开发/演示（demo） | 真实部署（live/production） |
|---|---|---|
| 前端数据模式 | `VITE_DATA_MODE=demo`（或留空+dev server）：API 失败静默切本地演示数据 | `VITE_DATA_MODE=live`（或留空+生产构建）：后端不可达/请求降级时顶部显示警示横幅；硬编码演示内容（客流、出行提醒等）带「演示数据」徽标 |
| 后端运行模式 | 默认：sandbox/fallback 仅产生 warn | `NODE_ENV=production`：启动即执行 `assertProductionRuntimeConfig`，弱密钥/沙箱支付/沙箱票务直接拒绝启动 |
| 服务状态可观测 | `/api/health` 返回 `providers.{map,ai,payment,ticket}` 的真实运行态（live/sandbox/fallback）；启动日志打印 `[config]` 摘要 | 同左；前端 live 模式会消费该接口提示「以下能力为演示模式」 |
| 验收命令 | `npm run readiness` | `npm run readiness:prod`（阻断式） |

## 初始化

```bash
npm install
npm run db:init
npm run readiness
npm run build:server
npm run build
```

`npm run readiness` 用于本地 MVP 检查，会提示 sandbox/fallback 风险但不一定阻塞。真实部署前使用：

```bash
npm run readiness:prod
```

生产模式会将默认或弱 `AUTH_SESSION_SECRET`、sandbox 支付/票务、缺失真实 provider 密钥、API 不可访问等判定为失败项。服务端启动时如果 `NODE_ENV`、`APP_ENV`、`LY_ENV` 或 `READINESS_MODE` 为 `production`，也会执行生产配置 fail fast。

## 启动

```bash
npm run dev:server
npm run dev
```

## 支付 Webhook

当前 sandbox provider 可通过 `POST /api/payments/webhook/sandbox` 模拟通知，仅用于本地演示。真实 provider 接入时必须：

- 使用 provider adapter 封装 `createPayment`、`queryPayment`、`cancelPayment`、`refundPayment` 和 `verifyWebhook`。
- 设置 `PAYMENT_WEBHOOK_SECRET` 或 provider 指定的验签材料。
- 将成功事件映射为 `paid`，失败/超时/取消映射为 `failed`、`expired`、`cancelled`。
- 支付成功后由服务端确认票务锁并生成凭证。
- 提供厂商回调签名算法、事件唯一 ID 字段和支付单状态字段；未实现前非 sandbox adapter 会 fail-closed。

## 票务 Provider

当前黄鹤楼 sandbox provider 只用于本地演示，不代表真实官方库存、出票或支付。真实票务 provider 接入时必须：

- 使用 provider adapter 封装 `getOptions`、`lock`、`release`、`confirm` 和 `verify`。
- 设置 `TICKET_API_BASE_URL`、`TICKET_API_TOKEN`、`TICKET_API_SECRET`。
- 明确票种、场次、库存、锁票有效期、订单确认、退锁、凭证核销和重复核销字段。
- 保持库存不足返回 409、锁票过期释放库存、重复核销返回业务冲突；未实现前非 sandbox adapter 会 fail-closed。

## 地图服务

当前 POI 坐标系为 `GCJ-02`。服务端地图 provider 通过 `MAP_PROVIDER=amap` 和 `MAP_API_KEY` 调用高德 Web 服务；前端 `/map` 页面通过 `VITE_AMAP_JS_KEY` 加载高德 JSAPI 渲染底图、点位和路线。服务失败时返回 fallback 路线和失败原因，前端 JSAPI 未配置或加载失败时展示本地兜底底图。

## 回滚

- 代码回滚：回到上一版本构建产物并重启 Node API。
- 数据回滚：停止服务，替换 `data/ly.sqlite` 为最近备份。
- provider 回滚：本地演示可将 `PAYMENT_PROVIDER=sandbox`、`MAP_PROVIDER=fallback`、`TICKET_PROVIDER=sandbox`；生产回滚不得把 sandbox/fallback 当作真实能力，应进入维护或切换到已验证 provider。
