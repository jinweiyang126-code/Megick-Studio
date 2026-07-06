import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import { OAuthProvidersController } from "./oauth-providers.controller";
import { OAuthProvidersService } from "./oauth-providers.service";

@Module({
  imports: [AdminAuditModule],
  controllers: [OAuthProvidersController],
  providers: [OAuthProvidersService],
  exports: [OAuthProvidersService],
})
export class OAuthProvidersModule {}
