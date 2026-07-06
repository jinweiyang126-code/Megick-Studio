import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import {
  ModelProvidersController,
  PublicModelProvidersController,
} from "./model-providers.controller";
import { ModelProvidersService } from "./model-providers.service";

@Module({
  imports: [AdminAuditModule],
  controllers: [ModelProvidersController, PublicModelProvidersController],
  providers: [ModelProvidersService],
  exports: [ModelProvidersService],
})
export class ModelProvidersModule {}
