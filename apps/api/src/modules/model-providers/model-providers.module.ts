import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import {
  ModelProvidersController,
  PublicModelProvidersController,
} from "./model-providers.controller";
import { ModelProvidersService } from "./model-providers.service";

@Module({
  imports: [AdminModule],
  controllers: [ModelProvidersController, PublicModelProvidersController],
  providers: [ModelProvidersService],
  exports: [ModelProvidersService],
})
export class ModelProvidersModule {}
