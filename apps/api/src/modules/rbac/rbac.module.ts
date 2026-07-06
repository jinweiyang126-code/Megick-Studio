import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { RbacService } from "./rbac.service";
import { RbacController } from "./rbac.controller";

@Module({
  imports: [AdminModule],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule {}
