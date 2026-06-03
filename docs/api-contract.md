# API 契约

## 实施边界

本 API 已从 MVP 演示接口推进为本地生产化过渡接口：服务端读取 `poi-data/` 全量真实 POI，订单、票务、支付、商户、审核和审计日志写入 SQLite。认证为 sandbox session auth，可后续替换真实登录；支付、票务和地图均保留 provider adapter 与 sandbox/fallback。生产模式下 `PAYMENT_PROVIDER=sandbox` 与 `TICKET_PROVIDER=sandbox` 会被启动校验和 readiness 拦截。

## 公共接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/pois` | POI 搜索，支持 `keyword/cityId/category/limit` |
| GET | `/api/pois/:id` | POI 详情 |
| GET | `/api/cities` | 城市元数据 |
| POST | `/api/itineraries/generate` | 基于真实 POI 候选生成演示行程 |
| POST | `/api/agent/chat` | 服务端 Travel Agent，对接 POI、路线、天气和票务候选工具，返回前端聊天卡片 |

## 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | sandbox 登录，body: `{ role, password }` |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/logout` | 登出并清理 Session Cookie |

默认 sandbox 密码为 `sandbox`，数据库中保存 PBKDF2 hash。

## 票务与订单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tickets/options` | 查询票种、时段与库存 |
| POST | `/api/tickets/lock` | 锁票，需登录 |
| POST | `/api/tickets/release` | 释放锁票 |
| POST | `/api/tickets/confirm` | 管理端确认锁票 |
| POST | `/api/tickets/verify` | 商户核销凭证 |
| GET | `/api/tickets/locks/:id` | 查询锁票 |
| POST | `/api/orders` | 基于锁票创建订单 |
| GET | `/api/orders` | 查询订单 |
| GET | `/api/orders/:id` | 查询订单详情 |

票务 provider 统一接口为 `getOptions`、`lock`、`release`、`confirm`、`verify`。当前 `sandbox` provider 使用本地 SQLite 库存事务，保留库存不足 409、锁票失效 409、重复核销 409 等错误语义。非 sandbox provider 必须配置 `TICKET_API_BASE_URL`、`TICKET_API_TOKEN`、`TICKET_API_SECRET`；未提供真实厂商协议前，adapter 边界保持 fail-closed，不伪造真实票务能力。

## 支付

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/payments/create` | 创建支付 |
| GET | `/api/payments/:id` | 查询支付 |
| POST | `/api/payments/:id/sandbox` | sandbox 模拟成功、失败或超时 |
| POST | `/api/payments/webhook/:provider` | 支付回调入口，预留验签 |
| POST | `/api/payments/cancel` | 取消支付 |
| POST | `/api/payments/refund` | 退款 |

支付 provider 统一接口为 `createPayment`、`queryPayment`、`cancelPayment`、`refundPayment`、`verifyWebhook`。支付成功会由服务端确认票务锁、更新订单并生成电子凭证；失败、取消、超时会释放锁票库存。Webhook 使用 `(provider, eventId)` 去重，重复事件不会重复确认票务或重复生成凭证。非 sandbox provider 必须配置 `PAYMENT_API_BASE_URL`、`PAYMENT_API_KEY`、`PAYMENT_WEBHOOK_SECRET`；未提供真实厂商协议前，adapter 边界保持 fail-closed，不伪造真实扣款能力。

## 后台

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/metrics` | 运营指标 |
| GET | `/api/admin/merchants` | 商户列表 |
| POST | `/api/admin/merchants` | 新增商户 |
| POST | `/api/admin/merchants/:id/sync` | 库存同步 |
| GET | `/api/admin/reviews` | 审核列表 |
| POST | `/api/admin/reviews/:id/decision` | 审核决策 |

## 地图

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/maps/pois/nearby` | 附近 POI |
| POST | `/api/maps/route` | 路线规划 |
| POST | `/api/maps/geocode` | 地理编码 |
| POST | `/api/maps/reverse-geocode` | 逆地理编码 |

当前 POI 坐标系为 `GCJ-02`。未配置真实地图 key 时返回 fallback 路线与失败原因。

## Agent

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/agent/chat` | body: `{ input: string }`，返回 `AiResponse` |

`AiResponse` 返回字段：

| 字段 | 说明 |
|---|---|
| `text` | 中文建议正文 |
| `cards` | 前端可渲染的推荐卡片，包含 `id/title/subtitle/image/actionLabel/href` |
| `toolCalls` | 工具调用状态，包含 POI 搜索、路线规划、地理编码、逆地理编码、天气查询、票务候选 |
| `confidence` | 0-1 置信度分数，用于前端展示 |
| `sourceNote` | 来源和限制说明，明确 fallback、provider 与官方接口边界 |

前端 `askTravelAssistant` 优先调用该接口；后端不可用时才回退到浏览器本地 deterministic fallback。模型配置只允许放在服务端 `AI_PROVIDER`、`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`，不得暴露到 `VITE_*`。

## 错误处理

| 状态码 | 场景 |
|---|---|
| 400 | 请求字段缺失或格式错误 |
| 401 | 未登录 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 库存不足、锁票失效、重复核销等业务冲突 |
| 500 | 内部异常 |
