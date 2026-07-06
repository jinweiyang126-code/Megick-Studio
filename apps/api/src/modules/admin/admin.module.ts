import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AdminAuditInterceptor } from "@/common/interceptors/admin-audit.interceptor";
import { AdminController } from "./admin.controller";
import { AdminLoginController } from "./admin-login.controller";
import { AdminAuditModule } from "./admin-audit.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AdminAuditModule, AuthModule],
  controllers: [AdminController, AdminLoginController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
  exports: [AdminAuditModule],
})
export class AdminModule {}
