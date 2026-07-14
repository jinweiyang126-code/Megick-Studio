import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
    if (!role) throw new NotFoundException("ROLE_NOT_FOUND");
    if (role.isSystem) throw new BadRequestException("CANNOT_DELETE_SYSTEM_ROLE");
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

  async assignRoleToUser(
    userId: string,
    roleCode: string,
    auditCtx?: AdminAuditRequestContext,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException("USER_NOT_FOUND");
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundException("ROLE_NOT_FOUND");
    const before = await this.userRoleCodes(userId);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    const after = await this.userRoleCodes(userId);
    await this.audit.logExplicit(auditCtx, {
      action: "UPDATE",
      targetType: "user",
      targetId: userId,
      before: { roles: before },
      after: { roles: after, assigned: roleCode },
    });
    return { userId, roles: after };
  }

  async removeRoleFromUser(
    userId: string,
    roleCode: string,
    actorUserId?: string,
    auditCtx?: AdminAuditRequestContext,
  ) {
    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new NotFoundException("ROLE_NOT_FOUND");
    if (roleCode === "SUPER_ADMIN" && actorUserId && actorUserId === userId) {
      throw new BadRequestException("CANNOT_REMOVE_OWN_SUPER_ADMIN");
    }
    const before = await this.userRoleCodes(userId);
    await this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
    const after = await this.userRoleCodes(userId);
    await this.audit.logExplicit(auditCtx, {
      action: "UPDATE",
      targetType: "user",
      targetId: userId,
      before: { roles: before },
      after: { roles: after, removed: roleCode },
    });
    return { userId, roles: after };
  }

  private async userRoleCodes(userId: string) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { select: { code: true } } },
      orderBy: { role: { code: "asc" } },
    });
    return rows.map((row) => row.role.code);
  }
}
