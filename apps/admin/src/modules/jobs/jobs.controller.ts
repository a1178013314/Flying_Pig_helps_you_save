import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Job } from "./job.registry";
import { JobsService } from "./jobs.service";

@Controller("jobs")
@ApiTags("jobs")
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(":id")
  @ApiOperation({ summary: "任务状态：前端轮询自己关心那一个" })
  get(@Param("id") id: string): Job {
    return this.jobs.get(id);
  }
}
