import { Module } from "@nestjs/common";
import { AGENT_JOB_ROOT, AGENT_RUNNER } from "./agent.tokens";
import { AGENT_ROOT, OpencodeRunner } from "./opencode.runner";

/** 智能体实现与执行目录根：换实现或测试只动这里（决策 9） */
@Module({
  providers: [
    { provide: AGENT_RUNNER, useClass: OpencodeRunner },
    { provide: AGENT_JOB_ROOT, useValue: AGENT_ROOT },
  ],
  exports: [AGENT_RUNNER, AGENT_JOB_ROOT],
})
export class AgentModule {}
