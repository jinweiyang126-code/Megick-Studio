import { Module } from "@nestjs/common";
import { ModelProvidersModule } from "../model-providers/model-providers.module";
import { AdminAuditModule } from "../admin/admin-audit.module";
import {
  AdminAiImageEditModesController,
  PublicAiImageEditModesController,
} from "./ai-image-edit-modes.controller";
import { AiImageEditModesService } from "./ai-image-edit-modes.service";

@Module({
  imports: [AdminAuditModule, ModelProvidersModule],
  controllers: [PublicAiImageEditModesController, AdminAiImageEditModesController],
  providers: [AiImageEditModesService],
  exports: [AiImageEditModesService],
})
export class AiImageEditModesModule {}
