import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { ShowcaseService } from "./showcase.service";
import { ShowcaseController, AdminShowcaseController } from "./showcase.controller";
import { OssModule } from "../oss/oss.module";

@Module({
  imports: [OssModule, AdminAuditModule],
  controllers: [ShowcaseController, AdminShowcaseController],
  providers: [ShowcaseService],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
