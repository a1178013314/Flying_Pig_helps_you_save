import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { DatasetController } from "../dataset/dataset.controller";
import { DatasetModule } from "../dataset/dataset.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

/** 管道装配：数据集供快照，Agent 供执行器与沙箱根 */
@Module({
  imports: [DatasetModule, AgentModule],
  controllers: [DatasetController, JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
