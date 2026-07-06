import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { OAuthProvidersController } from "./oauth-providers.controller";
import { OAuthProvidersService } from "./oauth-providers.service";

@Module({
  imports: [AdminModule],
  controllers: [OAuthProvidersController],
  providers: [OAuthProvidersService],
  exports: [OAuthProvidersService],
})
export class OAuthProvidersModule {}
