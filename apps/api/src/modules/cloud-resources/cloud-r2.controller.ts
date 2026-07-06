import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUserContext } from "@/common/decorators/current-user.decorator";
import { adminAuditRequestContext } from "@/common/utils/admin-audit-context";
import { CloudR2Service } from "./cloud-r2.service";
import { UpsertCloudR2ConfigDto } from "./cloud-resources.dto";

@Roles("SUPER_ADMIN")
@Controller("api/admin/cloud-resources/r2-config")
export class CloudR2Controller {
  constructor(private readonly r2: CloudR2Service) {}

  @Get()
  getConfig() {
    return this.r2.getAdminConfig();
  }

  @Post()
  upsertConfig(
    @Body() body: UpsertCloudR2ConfigDto,
    @Req() req: Request & { user?: AuthUserContext },
  ) {
    return this.r2.upsertConfig(body, adminAuditRequestContext(req));
  }

  @Post("test")
  testConfig() {
    return this.r2.testConfig();
  }
}
