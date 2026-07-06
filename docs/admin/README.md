# 管理后台文档

本目录存放 Megick Studio **管理后台（Admin）** 相关设计与实施文档。

## 文档列表

| 文档 | 说明 |
|------|------|
| [审计日志接入方案.md](./审计日志接入方案.md) | 审计日志现状、根因、两阶段接入设计（拦截器 + 关键接口显式记录） |

## 相关代码

| 模块 | 路径 |
|------|------|
| 审计写入服务 | `apps/api/src/modules/admin/admin-audit.service.ts` |
| 审计查询 API | `apps/api/src/modules/admin/admin.controller.ts` → `GET audit-log` |
| 审计日志页面 | `apps/web/src/routes/admin.audit-log.tsx` |
| 数据表 | `admin_audit_logs`（Prisma `AdminAuditLog`） |

## 实施顺序

1. 阶段一：Admin 写操作全局拦截器 + 敏感字段脱敏
2. 阶段二：P0 用户/积分/RBAC → P1 配置类 → P2 内容与运营

详见 [审计日志接入方案.md](./审计日志接入方案.md) 第 8 节。
