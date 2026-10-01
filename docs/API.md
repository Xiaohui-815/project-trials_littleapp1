# 积分接口与数据约定

通过 `app.callFunction({ name: 'points-ledger', data: { action, data } })` 调用。用户身份来自 CloudBase 认证上下文，客户端不传用户 ID。所有成功响应为 `{ ok: true, data }`，失败为 `{ ok: false, error: { code, message } }`。

| action | data | 响应 data |
| --- | --- | --- |
| `create` | `incomeDate`, `points`, `source`, `note`, `requestId` | 保存后的记录 |
| `update` | `id`, `version`, `incomeDate`, `points`, `source`, `note` | 更新后的记录 |
| `delete` | `id`, `version` | `{ id }` |
| `list` | `year`, 可选 `month`, `page` 默认 1, `pageSize` 默认 10 | `{ records, total, page, pageSize }` |
| `summary` | `year` | `{ year, totalMinor, count, months }`，months 固定十二项 |

`points` 必须是十进制字符串（如 `"12.35"`），范围 `0.01` 至 `999999999.99`。数据库保存 `pointsMinor` 整数（百分之一积分）。禁止指数格式、负数和超过两位小数。

`incomeDate` 为严格 `YYYY-MM-DD`，最早 1900-01-01，不晚于北京时间今天。统计使用该日期，而不是服务器写入时间。月份采用左闭右开的字符串日期范围。

`source` 去除首尾空格后为 1–60 字符，`note` 为 0–500 字符。查询页大小只能为 5、10、20、50。

创建时 `requestId` 为浏览器生成的 UUID。服务端对 UID 与 requestId 哈希生成记录 ID，同一提交重试不重复记账。修改和删除要求当前 `version`，过期版本返回 `CONFLICT`。

返回记录字段：`id`, `incomeDate`, `pointsMinor`, `source`, `note`, `createdAt`, `updatedAt`, `version`。`ownerId` 仅用于服务端数据库，不作为授权输入。

错误码：`UNAUTHENTICATED`（需登录）、`VALIDATION`（输入无效）、`NOT_FOUND`（不存在或不属于当前用户）、`CONFLICT`（并发更新）、`DATA`（数值异常）、`UNAVAILABLE`（服务暂不可用）。

数据库集合为 `point_records`，客户端读写禁止。年度汇总在数据库内按月聚合，最多返回十二条结果，不截取明细第一页。
