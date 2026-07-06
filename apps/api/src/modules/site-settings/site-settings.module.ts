import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { SiteSettingsService } from "./site-settings.service";
import { SiteSettingsController, AdminSiteSettingsController } from "./site-settings.controller";

@Module({
  imports: [AdminAuditModule],
  controllers: [SiteSettingsController, AdminSiteSettingsController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
