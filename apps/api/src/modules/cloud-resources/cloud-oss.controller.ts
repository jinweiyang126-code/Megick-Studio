import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "@/common/decorators/roles.decorator";
import type { AuthUserContext } from "@/common/decorators/current-user.decorator";
import { adminAuditRequestContext } from "@/common/utils/admin-audit-context";
import { CloudOssService } from "./cloud-oss.service";
import { UpsertCloudOssConfigDto } from "./cloud-resources.dto";

@Roles("SUPER_ADMIN")
@Controller("api/admin/cloud-resources/oss-config")
export class CloudOssController {
  constructor(private readonly oss: CloudOssService) {}

  @Get()
  getConfig() {
    return this.oss.getAdminConfig();
  }

  @Post()
  upsertConfig(
    @Body() body: UpsertCloudOssConfigDto,
    @Req() req: Request & { user?: AuthUserContext },
  ) {
    return this.oss.upsertConfig(body, adminAuditRequestContext(req));
  }

  @Post("test")
  testConfig() {
    return this.oss.testConfig();
  }
}
