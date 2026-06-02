# Codex 生产化能力补齐提示词

## 使用说明

这份提示词用于把当前 MVP 中明确标注为演示能力的部分，推进为可接真实服务、可验收、可上线前评审的生产化闭环。

建议不要一次性让 Codex 全部实现。真实支付、锁票、认证、地图、数据库持久化都属于高风险变更，应按阶段执行，每阶段先让 Codex 输出接口契约、数据模型、影响范围和回滚方案，再确认实施。

每阶段完成后必须要求 Codex 输出：

- 变更范围
- 修改文件
- 数据库/接口/环境变量变化
- 验证命令与结果
- 失败状态与回滚方案
- 未完成事项

---

## 主控提示词

```markdown
你是高级全栈工程师 + 系统架构师，正在接手 `/Users/a111/chen/code/ly` 项目。

当前系统已是可运行 MVP，但仍有 5 个演示能力需要生产化：

1. 真实数据库持久化
2. 真实认证与权限
3. 真实票务库存与锁票
4. 真实支付闭环
5. 真实地图路径规划

请先完整审查：
- `README.md`
- `docs/mvp-spec.md`
- `docs/api-contract.md`
- `package.json`
- `server/index.ts`
- `src/services/`
- `src/pages/TravelPages.tsx`
- `src/pages/AdminPages.tsx`
- `src/components/layout/AppShell.tsx`
- `src/types/index.ts`
- `poi-data/README.md`
- `poi-data/VALIDATION.md`

执行原则：
1. 这些都属于高风险变更，先输出 3-7 步总体实施计划，不要直接改代码。
2. 每个阶段先给数据模型、接口契约、环境变量、回滚方案和验收标准。
3. 优先保持现有 Vite + React + TypeScript + Node API 结构，不做无关重构。
4. 数据库优先使用 SQLite 作为本地生产化过渡方案；如需 PostgreSQL，只给后续迁移方案。
5. 真实第三方服务必须做 provider adapter，不能把项目绑定到单一厂商。
6. 没有第三方密钥时，必须保留 sandbox/mock fallback，确保演示可运行。
7. 支付、锁票、认证不得只在前端实现；必须有服务端校验。
8. 所有敏感信息只通过环境变量配置，不得写入代码或文档。
9. 每阶段结束执行 `npm test`、`npm run build:server`、`npm run build`。
10. 不得删除用户已有改动。

现在开始第 0 阶段：生产化差距审计与实施路线图。请输出可执行路线图、风险清单、验收顺序，不要先写大段理论。
```

---

## 阶段 0：生产化差距审计

```markdown
请对 `/Users/a111/chen/code/ly` 做一次生产化差距审计。

重点检查：
- 当前 API 是否仍为内存或 fallback 数据
- 当前订单是否仍依赖 localStorage
- 当前支付是否仍为 mock provider
- 当前鉴权是否只在前端角色切换
- 当前票务是否缺少锁票、释放、核销、退款状态
- 当前地图是否只是示意图
- 当前数据是否缺少数据库事务、唯一约束、审计日志

输出：
1. 当前已具备的能力。
2. 仍是演示能力的部分。
3. 生产化必须补齐的功能清单。
4. 推荐实施顺序。
5. 每个能力的核心风险、数据模型、接口影响。
6. 3-7 个阶段的开发计划，每阶段给验收标准。

限制：
- 本阶段只做审计和路线图，不修改代码。
- 所有结论必须引用本地文件证据。
```

---

## 阶段 1：数据库持久化

```markdown
请先把系统从内存/localStorage 演示数据推进到服务端数据库持久化。

建议方案：
- 使用 SQLite 作为本地 MVP 持久化数据库。
- 在 `server/` 下新增数据库访问层。
- 不引入过重 ORM，除非能说明收益；优先选择轻量、类型清晰、易迁移方案。

必须持久化的数据：
- 用户与角色
- POI 索引引用或缓存元数据
- 票务产品
- 时段库存
- 锁票记录
- 订单
- 支付记录
- 审核记录
- 商户
- 审计日志

必须实现：
- 数据库初始化脚本
- seed 脚本
- 唯一约束、外键或等价校验
- 基础事务封装
- API 从数据库读取订单、票务、商户、审核记录
- 前端订单不再主要依赖 localStorage；localStorage 只作为后端不可用 fallback

要求：
- 先输出 Schema 设计和迁移计划，等待确认后再实现。
- 所有写操作必须有错误处理。
- 订单号、锁票号、支付流水号不可重复。
- 执行 `npm test`、`npm run build:server`、`npm run build`。
```

---

## 阶段 2：真实认证与权限

```markdown
请为系统实现服务端认证与权限控制。

目标：
- 将当前前端演示角色切换升级为服务端 mock-auth/sandbox-auth，可后续接真实登录。
- 前端仍保留演示登录入口，但权限判断必须由 API 层兜底。

必须实现：
- 登录接口：`POST /api/auth/login`
- 当前用户接口：`GET /api/auth/me`
- 登出接口：`POST /api/auth/logout`
- 服务端 auth middleware
- RBAC 权限表或角色权限映射
- API 层敏感操作鉴权
- 前端路由守卫改为读取 `/api/auth/me`

角色：
- visitor
- operator
- reviewer
- merchant
- admin

要求：
- 密码不得明文存储；即使是 sandbox，也要使用 hash。
- session/JWT 方案先做取舍说明。
- Cookie、Token、过期时间、刷新机制要写清楚。
- 不要声称已经具备生产安全；标注当前安全边界。
- 对审核、商户、订单、支付类接口做服务端权限校验。
- 执行 `npm test`、`npm run build:server`、`npm run build`。
```

---

## 阶段 3：真实票务库存与锁票

```markdown
请把票务从演示库存升级为服务端可校验的库存、锁票、释放、核销闭环。

必须实现的数据对象：
- ticket_products
- ticket_slots
- ticket_inventory
- ticket_locks
- ticket_vouchers

必须实现的 API：
- `GET /api/tickets/options?poiId=...`
- `POST /api/tickets/lock`
- `POST /api/tickets/release`
- `POST /api/tickets/confirm`
- `POST /api/tickets/verify`
- `GET /api/tickets/locks/:id`

业务规则：
- 下单前必须先锁票。
- 锁票有过期时间，例如 15 分钟。
- 支付成功后锁票转为确认。
- 支付失败或超时释放库存。
- 库存不足必须返回明确错误。
- 核销必须校验订单状态、凭证状态、入园日期和时段。

要求：
- 必须使用数据库事务处理库存扣减和锁释放。
- 不能出现超卖。
- 前端票务页要展示锁票倒计时、锁票失败、库存不足、时段不可用。
- 当前没有官方票务接口时，先实现本地 provider adapter；后续可接官方票务。
- 执行 `npm test`、`npm run build:server`、`npm run build`。
```

---

## 阶段 4：真实支付闭环

```markdown
请把支付从 mock payment provider 升级为可接真实支付服务的支付适配层。

目标：
- 仍保留 sandbox/mock provider。
- 新增真实支付 provider adapter 的结构。
- 支付状态必须由服务端维护，前端不能直接改为已支付。

必须实现：
- `POST /api/payments/create`
- `GET /api/payments/:id`
- `POST /api/payments/webhook/:provider`
- `POST /api/payments/cancel`
- `POST /api/payments/refund`

支付状态：
- created
- pending
- paid
- failed
- cancelled
- expired
- refunding
- refunded

要求：
- 先设计支付表、支付流水表、Webhook 事件表。
- Webhook 必须做签名校验接口预留。
- 支付成功后调用票务 confirm，失败/超时调用票务 release。
- 不接真实支付密钥时，sandbox provider 可以模拟成功、失败、超时、退款。
- 前端支付页要展示真实服务端状态轮询或查询结果。
- 不得在前端点击按钮后直接把订单改成已支付。
- 执行 `npm test`、`npm run build:server`、`npm run build`。
```

---

## 阶段 5：真实地图路径规划

```markdown
请把当前示意地图升级为可接真实地图服务的路线规划能力。

目标：
- 支持地图 provider adapter。
- 没有地图 key 时保留本地 fallback 路线。
- 前端地图页展示真实路径结果或 fallback 状态。

建议 provider：
- AMap 高德地图
- 或其他适合中国城市文旅场景的地图服务

必须实现：
- `GET /api/maps/pois/nearby`
- `POST /api/maps/route`
- `POST /api/maps/geocode`
- `POST /api/maps/reverse-geocode`

路线参数：
- 起点
- 终点
- 途经点
- 出行方式：walking / driving / transit
- 偏好：少排队、少台阶、无障碍、亲子、文化深读

要求：
- 地图 key 只读环境变量。
- 坐标系必须明确，当前 POI 为 GCJ-02。
- 路线失败时返回 fallback 路线和失败原因。
- 前端地图页展示距离、时长、途经点、服务来源。
- 不要把真实地图 SDK 强行塞进主包；如需 SDK，采用 lazy loading。
- 执行 `npm test`、`npm run build:server`、`npm run build`。
```

---

## 阶段 6：生产化联调与端到端验收

```markdown
请对数据库、认证、锁票、支付、地图做端到端联调。

必须验证的链路：
1. 游客登录。
2. 搜索杭州真实 POI。
3. 进入票务页。
4. 查询真实/沙箱库存。
5. 锁票成功。
6. 创建订单。
7. 创建支付。
8. 沙箱支付成功。
9. 票务确认。
10. 生成电子凭证。
11. 我的订单展示已支付/待出行。
12. 商户端看到订单。
13. 核销成功。
14. 运营看板指标变化。

失败链路也必须验证：
- 未登录访问敏感接口
- 库存不足
- 锁票过期
- 支付失败
- 支付超时
- Webhook 重复通知
- 重复核销
- 地图服务不可用

输出：
- 联调结果表
- 测试命令与结果
- API 冒烟脚本
- 剩余风险
- 上线前必须补充事项

执行：
- `npm test`
- `npm run build:server`
- `npm run build`
- 如新增 e2e 测试，执行 e2e 命令
```

---

## 阶段 7：部署与运维补齐

```markdown
请补齐生产化部署与运维说明。

交付物：
- 更新 `README.md`
- 更新 `.env.example`
- 新增或更新 `docs/deployment.md`
- 新增或更新 `docs/ops-checklist.md`

必须覆盖：
- 数据库初始化与迁移
- 环境变量
- 支付 Webhook 配置
- 地图服务配置
- 认证密钥配置
- 日志与审计
- 备份与恢复
- 常见故障处理
- 回滚方案

要求：
- 不写真实密钥。
- 不承诺未验证的云服务能力。
- 所有命令必须本地验证。
- 执行 `npm test`、`npm run build:server`、`npm run build`。
```

---

## 一次性连续推进版

```markdown
你是高级全栈工程师 + 系统架构师，请接手 `/Users/a111/chen/code/ly`，把当前 MVP 中仍为演示的能力推进到生产化闭环。

目标能力：
1. 数据库持久化
2. 服务端认证与 RBAC
3. 票务库存、锁票、释放、确认、核销
4. 支付 provider adapter、sandbox 支付、Webhook、退款
5. 地图 provider adapter、路径规划、地理编码
6. 端到端联调、测试、部署文档

硬性要求：
- 先做生产化差距审计和阶段计划，不要直接改代码。
- 每个高风险阶段必须先给 Schema、接口契约、环境变量、事务边界、失败状态和回滚方案。
- 没有真实第三方密钥时保留 sandbox/fallback。
- 真实支付、锁票、认证必须由服务端校验，不得只靠前端。
- 数据库写操作必须考虑事务和唯一约束。
- 票务不得超卖。
- 支付成功必须由服务端支付状态或 Webhook 驱动订单状态。
- 地图坐标系必须明确，当前 POI 是 GCJ-02。
- 所有敏感信息只从环境变量读取。
- 每阶段结束执行 `npm test`、`npm run build:server`、`npm run build`。
- 不删除用户已有改动。

现在从阶段 0：生产化差距审计开始。
```
