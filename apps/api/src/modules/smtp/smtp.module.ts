import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SmtpController } from "./smtp.controller";
import { SmtpService } from "./smtp.service";

@Module({
  imports: [AdminModule],
  controllers: [SmtpController],
  providers: [SmtpService],
  exports: [SmtpService],
})
export class SmtpModule {}
