import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { OssModule } from "../oss/oss.module";
import { SiteSettingsModule } from "../site-settings/site-settings.module";
import { AdminTemplatesController, TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";

@Module({
  imports: [OssModule, SiteSettingsModule, AdminAuditModule],
  controllers: [TemplatesController, AdminTemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
