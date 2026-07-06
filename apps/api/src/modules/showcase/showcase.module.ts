import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { ShowcaseService } from "./showcase.service";
import { ShowcaseController, AdminShowcaseController } from "./showcase.controller";
import { OssModule } from "../oss/oss.module";

@Module({
  imports: [OssModule, AdminModule],
  controllers: [ShowcaseController, AdminShowcaseController],
  providers: [ShowcaseService],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
