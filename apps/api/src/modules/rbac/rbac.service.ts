import { Injectable } from "@nestjs/common";
import { PrismaService } from "nestjs-prisma";
import type { AdminAuditRequestContext } from "@/common/utils/admin-audit-context";
import { AdminAuditService } from "@/modules/admin/admin-audit.service";

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { code: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ group: "asc" }, { code: "asc" }] });
  }

  async createRole(
    input: { code: string; name: string; description?: string; permissionCodes: string[] },
    auditCtx?: AdminAuditRequestContext,
  ) {
    const role = await this.prisma.role.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
      },
    });
    if (input.permissionCodes.length) {
      await this.replacePermissions(role.id, input.permissionCodes);
    }
    const after = await this.roleSnapshot(role.id);
    await this.audit.logExplicit(auditCtx, {
      action: "CREATE",
      targetType: "role",
      targetId: role.id,
      after,
    });
    return role;
  }

  async updateRole(
    id: string,
    input: { name?: string; description?: string; permissionCodes?: string[] },
    auditCtx?: AdminAuditRequestContext,
  ) {
    const before = await this.roleSnapshot(id);
    const role = await this.prisma.role.update({
      where: { id },
      data: { name: input.name, description: input.description },
    });
    if (input.permissionCodes) {
      await this.replacePermissions(id, input.permissionCodes);
    }
    const after = await this.roleSnapshot(id);
    await this.audit.logExplicit(auditCtx, {
      action: "UPDATE",
      targetType: "role",
      targetId: role.id,
      before,
      after,
    });
    return role;
  }

  async deleteRole(id: string, auditCtx?: AdminAuditRequestContext) {
    const before = await this.roleSnapshot(id);
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role || role.isSystem) {
      throw new Error("Cannot delete system role");
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit.logExplicit(auditCtx, {
      action: "DELETE",
      targetType: "role",
      targetId: id,
      before,
    });
    return role;
  }

  private async roleSnapshot(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
        _count: { select: { users: true } },
      },
    });
    if (!role) return null;
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionCodes: role.permissions.map((item) => item.permission.code),
      userCount: role._count.users,
    };
  }

  private async replacePermissions(roleId: string, codes: string[]) {
    const perms = await this.prisma.permission.findMany({ where: { code: { in: codes } } });
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (perms.length) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      });
    }
  }

  async assignRoleToUser(userId: string, roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error("Role not found");
    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }

  async removeRoleFromUser(userId: string, roleCode: string) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) return;
    await this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
  }
}
