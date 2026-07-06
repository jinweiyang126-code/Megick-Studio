import { Module } from "@nestjs/common";
import { AdminAuditService } from "./admin-audit.service";

@Module({
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}
