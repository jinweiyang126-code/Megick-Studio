import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { SmtpController } from "./smtp.controller";
import { SmtpService } from "./smtp.service";

@Module({
  imports: [AdminAuditModule],
  controllers: [SmtpController],
  providers: [SmtpService],
  exports: [SmtpService],
})
export class SmtpModule {}
