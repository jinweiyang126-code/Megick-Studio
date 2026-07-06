import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import {
  AdminNavigationMenusController,
  NavigationMenusController,
} from "./navigation-menus.controller";
import { NavigationMenusService } from "./navigation-menus.service";

@Module({
  imports: [AdminModule],
  controllers: [NavigationMenusController, AdminNavigationMenusController],
  providers: [NavigationMenusService],
  exports: [NavigationMenusService],
})
export class NavigationMenusModule {}
