import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AdminAuditInterceptor } from "@/common/interceptors/admin-audit.interceptor";
import { AdminController } from "./admin.controller";
import { AdminLoginController } from "./admin-login.controller";
import { AdminAuditService } from "./admin-audit.service";
import { AuthModule } from "../auth/auth.module";
import { SiteSettingsModule } from "../site-settings/site-settings.module";

@Module({
  imports: [AuthModule, SiteSettingsModule],
  controllers: [AdminController, AdminLoginController],
  providers: [
    AdminAuditService,
    { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor },
  ],
  exports: [AdminAuditService],
})
export class AdminModule {}
