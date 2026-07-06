import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { RbacService } from "./rbac.service";
import { RbacController } from "./rbac.controller";

@Module({
  imports: [AdminAuditModule],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule {}
