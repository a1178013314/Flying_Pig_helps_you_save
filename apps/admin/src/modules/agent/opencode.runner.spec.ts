import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  agentEnv,
  jobDirPath,
  missingApiKey,
  prepareJobDir,
  pruneStaleJobDirs,
  releaseJobDir,
  skillIntact,
  stageFromOutput,
} from "./opencode.runner";

const REPO_ROOT = join(process.cwd(), "..", "..");

describe("执行目录", () => {
  let jobDir = "";

  beforeEach(() => {
    mkdirSync(join(tmpdir(), "flypig-agent"), { recursive: true });
    jobDir = jobDirPath(join(tmpdir(), "flypig-agent"), "job-1");
    rmSync(jobDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(jobDir, { recursive: true, force: true });
  });

  it("opencode.json 关掉深度思考（实测同一提示词 2448ms/33 reasoning token → 1145ms/0）", () => {
    prepareJobDir(jobDir, {});
    const config = JSON.parse(readFileSync(join(jobDir, "opencode.json"), "utf8")) as {
      provider: { bailian: { models: Record<string, { options?: Record<string, unknown> }> } };
    };
    expect(config.provider.bailian.models["qwen3.8-flash"]?.options).toEqual({
      enable_thinking: false,
    });
  });

  it("建出 raw/、skill 副本与 opencode.json", () => {
    prepareJobDir(jobDir, { type: "discover", task: { origin: "北京" } });
    expect(existsSync(join(jobDir, "raw"))).toBe(true);
    expect(existsSync(join(jobDir, ".opencode/skills/flyai/SKILL.md"))).toBe(true);

    const config = JSON.parse(readFileSync(join(jobDir, "opencode.json"), "utf8")) as {
      model: string;
      provider: { bailian: { options: { apiKey: string } } };
      permission: {
        webfetch: string;
        websearch: string;
        external_directory: string;
        bash: Record<string, string>;
      };
    };
    expect(config.model).toBe("bailian/qwen3.8-flash");
    expect(config.provider.bailian.options.apiKey).toBe("{env:BAILIAN_API_KEY}");
    expect(config.permission.webfetch).toBe("deny");
    expect(config.permission.websearch).toBe("deny");
    expect(config.permission.external_directory).toBe("deny");
    expect(config.permission.bash["curl *"]).toBe("deny");
    expect(config.permission.bash["*"]).toBe("allow");
  });

  it("任务输入落进 input.json 供 agent 读", () => {
    prepareJobDir(jobDir, { type: "refresh", task: { date: "2026-11-06" } });
    const input = JSON.parse(readFileSync(join(jobDir, "input.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(input).toEqual({ type: "refresh", task: { date: "2026-11-06" } });
  });

  it("skill 副本写成只读，内容等于仓库里那份", () => {
    prepareJobDir(jobDir, {});
    const copy = join(jobDir, ".opencode/skills/flyai/SKILL.md");
    expect(statSync(copy).mode & 0o022).toBe(0);
    const source = readFileSync(join(REPO_ROOT, ".opencode/skills/flyai/SKILL.md"), "utf8");
    expect(readFileSync(copy, "utf8")).toBe(source);
  });

  it("skill 被改写时 hash 校验失败", () => {
    const expected = prepareJobDir(jobDir, {});
    expect(skillIntact(jobDir, expected)).toBe(true);

    const copy = join(jobDir, ".opencode/skills/flyai/SKILL.md");
    chmodSync(copy, 0o644);
    writeFileSync(copy, `${readFileSync(copy, "utf8")}\n改一下规则`, "utf8");
    expect(skillIntact(jobDir, expected)).toBe(false);
  });

  it("有脚本时写成可执行的 run-queries.sh，没有就不写", () => {
    prepareJobDir(jobDir, {}, "#!/bin/sh\nwait\n");
    const script = join(jobDir, "run-queries.sh");
    expect(statSync(script).mode & 0o111).toBe(0o111);
    expect(readFileSync(script, "utf8")).toBe("#!/bin/sh\nwait\n");

    rmSync(jobDir, { recursive: true, force: true });
    prepareJobDir(jobDir, {});
    expect(existsSync(join(jobDir, "run-queries.sh"))).toBe(false);
  });

  it("跑完即删；失败的目录留着排查", () => {
    prepareJobDir(jobDir, {});
    releaseJobDir(jobDir, "success");
    expect(existsSync(jobDir)).toBe(false);

    prepareJobDir(jobDir, {});
    releaseJobDir(jobDir, "failure");
    expect(existsSync(jobDir)).toBe(true);
  });

  it("目录名由 jobId 决定", () => {
    expect(jobDirPath("/tmp/x", "abc")).toBe(join("/tmp/x", "abc"));
  });

  it("超过 7 天的失败目录在启动清理时被删掉", () => {
    prepareJobDir(jobDir, {});
    const stale = new Date(Date.now() - 8 * 86_400_000);
    utimesSync(jobDir, stale, stale);
    const fresh = jobDirPath(join(tmpdir(), "flypig-agent"), "job-2");
    rmSync(fresh, { recursive: true, force: true });
    prepareJobDir(fresh, {});

    pruneStaleJobDirs(join(tmpdir(), "flypig-agent"));
    expect(existsSync(jobDir)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    rmSync(fresh, { recursive: true, force: true });
  });
});

describe("运行时环境", () => {
  it("PATH 里 flyai 可执行", () => {
    const env = agentEnv({ PATH: "/usr/bin" });
    const first = String(env.PATH).split(":")[0];
    expect(first).toMatch(/node_modules[/\\]\.bin$/);
    expect(existsSync(join(first ?? "", "flyai"))).toBe(true);
  });

  it("缺 BAILIAN_API_KEY 时给出直接失败的原因而不是重试", () => {
    expect(missingApiKey({})).toContain("BAILIAN_API_KEY");
    expect(missingApiKey({ BAILIAN_API_KEY: "sk-x" })).toBeNull();
  });
});

describe("阶段文案", () => {
  it("取输出里最近一个日期", () => {
    expect(stageFromOutput("查 2026-11-07 的票\n然后 2026-11-08")).toBe("正在查 11-08 的票");
  });

  it("取不到日期时用兜底文案", () => {
    expect(stageFromOutput("我来查一下")).toBe("智能体正在执行");
  });
});
