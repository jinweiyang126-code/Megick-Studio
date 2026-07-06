import { forwardRef, Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { SiteSettingsService } from "./site-settings.service";
import { SiteSettingsController, AdminSiteSettingsController } from "./site-settings.controller";

@Module({
  imports: [forwardRef(() => AdminModule)],
  controllers: [SiteSettingsController, AdminSiteSettingsController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
