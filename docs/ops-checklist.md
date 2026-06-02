# 运维检查清单

## 上线前

| 检查项 | 标准 |
|---|---|
| 构建 | `npm test`、`npm run build:server`、`npm run build` 全部通过 |
| 就绪检查 | 本地演示执行 `npm run readiness`；生产部署执行 `npm run readiness:prod` 且无失败项 |
| 数据库 | `npm run db:init` 成功，SQLite 文件可读写 |
| 环境变量 | 不提交真实密钥，部署环境注入密钥 |
| 认证 | 默认 sandbox 密码只用于演示，生产接入真实登录前不得宣称生产安全 |
| 权限 | 后台、支付、核销等接口返回 401/403 能被复现 |
| 支付 | Webhook 重复通知不会重复确认票务 |
| 票务 | 库存不足返回 409，锁票过期释放库存 |
| 地图 | provider 不可用时返回 fallback 与 failureReason |

## 生产上线剩余清单

| 项 | 当前状态 | 上线前要求 |
|---|---|---|
| Session secret | 已支持弱密钥识别、生成命令和生产启动 fail fast | 用 `npm run secret:generate` 生成后通过部署环境注入 `AUTH_SESSION_SECRET` |
| 支付 provider | `sandbox` 保留本地演示；非 sandbox 缺配置会失败，未实现真实厂商 adapter 时 fail-closed | 提供支付厂商名称、API base URL、API key、webhook secret、签名算法、事件 ID 字段、支付状态映射和回调域名 |
| 票务 provider | 黄鹤楼 `sandbox` 保留本地演示；非 sandbox 缺配置会失败，未实现真实厂商 adapter 时 fail-closed；当前不代表真实官方库存、出票或支付 | 提供票务厂商 API base URL、token、secret、票种/场次/库存字段、锁票/释放/确认/核销接口、锁票有效期和错误码映射 |
| 地图 provider | `fallback` 可本地演示，生产 readiness 会阻塞 fallback 或缺少高德 key | 配置服务端 `MAP_PROVIDER=amap`、`MAP_API_KEY` 和浏览器地图域名受限的 `VITE_AMAP_JS_KEY` |
| 认证体系 | 当前仍是 sandbox session auth 和演示账号 | 接入生产身份源、密码/验证码/SSO 策略、账号生命周期和权限审计 |

## 备份与恢复

1. 停止写入流量或进入维护窗口。
2. 复制 `data/ly.sqlite` 和同目录 WAL 文件。
3. 恢复时停止服务，替换数据库文件后重启。
4. 执行 `npm run smoke:api` 验证游客下单链路。

## 常见故障

| 故障 | 处理 |
|---|---|
| 登录后仍无权限 | 检查浏览器是否允许 Cookie，确认 API CORS credentials 配置 |
| 锁票失败 | 检查库存、锁是否过期、是否已被其他订单占用 |
| 支付成功但无凭证 | 检查 payment event、order status、ticket_locks 是否已确认 |
| Webhook 失败 | 检查 provider、eventId、签名材料和 `PAYMENT_WEBHOOK_SECRET` |
| 地图路线失败 | 检查 `MAP_PROVIDER`、`MAP_API_KEY`，确认 fallback 是否正常返回 |

## 审计日志

敏感操作会写入 `audit_logs`，覆盖商户创建、库存同步、审核决策、锁票、订单、支付状态、退款和核销。上线前应补充日志查询后台或导出脚本。
