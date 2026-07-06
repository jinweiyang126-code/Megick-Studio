import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { CloudResourcesModule } from "../cloud-resources/cloud-resources.module";
import { DesktopReleasesController } from "./desktop-releases.controller";
import { DesktopUploadsController } from "./desktop-uploads.controller";
import { DesktopReleasesService } from "./desktop-releases.service";

@Module({
  imports: [CloudResourcesModule, AdminAuditModule],
  controllers: [DesktopReleasesController, DesktopUploadsController],
  providers: [DesktopReleasesService],
})
export class DesktopUpdatesModule {}
