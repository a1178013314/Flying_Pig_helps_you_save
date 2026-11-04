/**
 * 智能体执行的接缝（spec §8）：后端只认这个接口，不认 opencode。
 * e2e 用假实现写产物，真实实现只在手动验收里跑（决策 9）。
 */
export interface AgentRunRequest {
  jobId: string;
  /** 一次性沙箱目录，已由 prepareJobDir 建好 */
  jobDir: string;
  prompt: string;
  /** 给人看的一句话，取不到就别调 */
  onStage(stage: string): void;
}

export interface AgentRunner {
  /** 跑一次；失败抛 Error，message 直接进 job.error */
  run(req: AgentRunRequest): Promise<void>;
}
