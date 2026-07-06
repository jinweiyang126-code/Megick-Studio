import { Module } from "@nestjs/common";
import { AdminAuditModule } from "../admin/admin-audit.module";
import {
  AdminNavigationMenusController,
  NavigationMenusController,
} from "./navigation-menus.controller";
import { NavigationMenusService } from "./navigation-menus.service";

@Module({
  imports: [AdminAuditModule],
  controllers: [NavigationMenusController, AdminNavigationMenusController],
  providers: [NavigationMenusService],
  exports: [NavigationMenusService],
})
export class NavigationMenusModule {}
