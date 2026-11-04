import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentRunner, AgentRunRequest } from "./agent.runner";

/** 执行目录与产物协议（spec §2、§5） */

export const AGENT_ROOT = join(tmpdir(), "flypig-agent");
/** 2026-11-04 实测：refresh 单轮 175s（5 天逐天查 + 候选），spec 原写的 180s 只差 5s */
export const RUN_TIMEOUT_MS = 300_000;

const SKILL_SOURCE = join(process.cwd(), "../../.opencode/skills/flyai/SKILL.md");
const SKILL_IN_JOB = join(".opencode", "skills", "flyai", "SKILL.md");
const FLYAI_BIN = join(process.cwd(), "node_modules", ".bin");

export function jobDirPath(root: string, jobId: string): string {
  return join(root, jobId);
}

/** 每个 job 一份 opencode.json（spec §5 的三条实测修正都在这里） */
export function buildOpencodeConfig(): Record<string, unknown> {
  return {
    $schema: "https://opencode.ai/config.json",
    model: "bailian/qwen3.8-flash",
    provider: {
      bailian: {
        npm: "@ai-sdk/openai-compatible",
        name: "bailian",
        options: {
          baseURL: "https://maas.qianwenaiapi.com/compatible-mode/v1",
          apiKey: "{env:BAILIAN_API_KEY}",
        },
        models: { "qwen3.8-flash": { name: "Qwen3.8 Flash" } },
      },
    },
    permission: {
      // 全 deny 会让 bash 工具从工具表里消失（spec §5 实测），只能默认 allow + 高危 deny
      bash: {
        "curl *": "deny",
        "wget *": "deny",
        "ssh *": "deny",
        "sudo *": "deny",
        "rm -rf *": "deny",
        "*": "allow",
      },
      edit: "allow",
      read: "allow",
      webfetch: "deny",
      websearch: "deny",
      external_directory: "deny",
      skill: { flyai: "allow" },
    },
  };
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** 建沙箱：raw/、只读 skill 副本、opencode.json、input.json；返回 skill 副本的 hash */
export function prepareJobDir(jobDir: string, input: unknown): string {
  mkdirSync(join(jobDir, "raw"), { recursive: true });

  const skillPath = join(jobDir, SKILL_IN_JOB);
  mkdirSync(dirname(skillPath), { recursive: true });
  copyFileSync(SKILL_SOURCE, skillPath);
  chmodSync(skillPath, 0o444);

  writeFileSync(join(jobDir, "opencode.json"), JSON.stringify(buildOpencodeConfig()));
  writeFileSync(join(jobDir, "input.json"), JSON.stringify(input));
  return sha256(skillPath);
}

/** 模型实测会试图重写 SKILL.md（spec §5），落库前必须比 hash */
export function skillIntact(jobDir: string, expectedSha256: string): boolean {
  const skillPath = join(jobDir, SKILL_IN_JOB);
  if (!existsSync(skillPath)) return false;
  return sha256(skillPath) === expectedSha256;
}

/** 跑完即删；失败的目录留着排查（spec §2，清理见 §12 shortcut） */
export function releaseJobDir(jobDir: string, outcome: "success" | "failure"): void {
  if (outcome === "success") rmSync(jobDir, { recursive: true, force: true });
}

const KEEP_FAILED_MS = 7 * 86_400_000;

/** 启动时清掉超过 7 天的失败目录（spec §12：留着排查，但要记得清理） */
export function pruneStaleJobDirs(root: string, now = Date.now()): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (!statSync(path).isDirectory()) continue;
    if (now - statSync(path).mtimeMs > KEEP_FAILED_MS)
      rmSync(path, { recursive: true, force: true });
  }
}

/** flyai 装在 node_modules/.bin，必须进 PATH（spec §5） */
export function agentEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, PATH: `${FLYAI_BIN}:${base.PATH ?? ""}` };
}

/** key 缺失就别重试（spec §12） */
export function missingApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.BAILIAN_API_KEY?.trim() ? null : "BAILIAN_API_KEY 未注入，模型无法调用";
}

/**
 * 从输出里取最近一个日期当阶段文案，取不到用兜底句（spec §4）。
 * shortcut: 解析的是默认文本输出；要精确到 CLI 进度事件就换 `--format json`，
 * 等界面真要按工具调用粒度显示阶段时再换。
 */
export function stageFromOutput(text: string): string {
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g);
  const latest = dates?.at(-1);
  return latest ? `正在查 ${latest.slice(5)} 的票` : "智能体正在执行";
}

export class OpencodeRunner implements AgentRunner {
  constructor(private readonly opts: { bin?: string; timeoutMs?: number } = {}) {}

  async run(req: AgentRunRequest): Promise<void> {
    const missing = missingApiKey();
    if (missing) throw new Error(missing);

    const bin = this.opts.bin ?? "opencode";
    const timeoutMs = this.opts.timeoutMs ?? RUN_TIMEOUT_MS;

    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, ["run", "--dir", req.jobDir, "--auto", req.prompt], {
        cwd: req.jobDir,
        env: agentEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let tail = "";
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`智能体超过 ${Math.round(timeoutMs / 1000)}s 未结束，已强杀`));
      }, timeoutMs);

      const collect = (chunk: Buffer): void => {
        tail = (tail + chunk.toString("utf8")).slice(-8000);
        req.onStage(stageFromOutput(tail));
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`opencode 启动失败：${String(error)}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else
          reject(
            new Error(`智能体退出码 ${String(code)}：${tail.split("\n").slice(-3).join(" ")}`),
          );
      });
    });
  }
}
