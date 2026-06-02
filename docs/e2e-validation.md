# 端到端验收记录

## 成功链路

| 步骤 | 验收方式 | 预期 |
|---|---|---|
| 游客登录 | `POST /api/auth/login` | 返回 `authenticated=true` 与 visitor 用户 |
| 查询 POI | `GET /api/pois?cityId=wuhan` | 返回武汉真实 POI |
| 查询库存 | `GET /api/tickets/options?poiId=ticket-yellow-crane-tower-demo&visitDate=2026-06-06` | 返回黄鹤楼 sandbox 票种与时段库存候选 |
| 锁票 | `POST /api/tickets/lock` | 返回 active lock 和过期时间 |
| 创建订单 | `POST /api/orders` | 返回 `pending_payment` 订单 |
| 创建支付 | `POST /api/payments/create` | 返回 sandbox pending 支付 |
| 支付成功 | `POST /api/payments/:id/sandbox` | 支付变为 `paid`，订单变为 `paid`，生成凭证 |
| 我的订单 | `GET /api/orders` | 返回当前用户订单 |
| 地图路线 | `POST /api/maps/route` | 返回距离、时长、途经点、provider 和 fallback 状态 |

可直接运行：

```bash
npm run smoke:api
```

## 失败链路

| 场景 | 验收方式 | 预期 |
|---|---|---|
| 未登录访问敏感接口 | 不带 Cookie 请求 `POST /api/tickets/lock` | `401` |
| 库存不足 | 锁票数量大于可用库存 | `409` |
| 锁票过期 | 锁过期后再创建订单 | `409` 或锁状态 `expired` |
| 支付失败 | `POST /api/payments/:id/sandbox`，`status=failed` | 支付 `failed`，订单 `payment_failed`，库存释放 |
| 支付超时 | `status=expired` | 支付 `expired`，订单 `expired`，库存释放 |
| Webhook 重复通知 | 重复 `eventId` 调用 webhook | 返回 `duplicated=true` |
| 重复核销 | 已核销凭证再次 `POST /api/tickets/verify` | `409` |
| 地图服务不可用 | 不配置 `MAP_API_KEY` | 返回 fallback 路线与 `failureReason` |

## 当前局限

- sandbox auth 不是生产级身份认证，只用于服务端权限闭环演示。
- sandbox payment 不产生真实扣款。
- 黄鹤楼票务只使用 sandbox/demo 数据，不代表真实官方库存、出票或支付。
- 地图真实 provider 尚未绑定具体厂商，当前返回 deterministic fallback。
