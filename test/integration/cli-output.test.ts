import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { delimiter, join, resolve } from "path";

const ROOT = resolve(__dirname, "../..");
const JAVA_FIXTURES = resolve(__dirname, "../fixtures/java");

let stubBin: string;
let workDir: string;

/** Runs the CLI from source without a live Copilot installation (`gh` stub exits 1). */
function cli(args: string[], cwd = ROOT) {
  const tsx = join(ROOT, "node_modules", "tsx", "dist", "loader.mjs");
  return spawnSync(process.execPath, ["--import", tsx, join(ROOT, "src/index.ts"), ...args], {
    shell: false,
    cwd,
    encoding: "utf-8",
    timeout: 30000,
    env: { ...process.env, PATH: `${stubBin}${delimiter}${process.env.PATH ?? ""}`, FORCE_COLOR: "0" },
  });
}

beforeAll(async () => {
  stubBin = await mkdtemp(join(tmpdir(), "hambugsy-bin-"));
  workDir = await mkdtemp(join(tmpdir(), "hambugsy-init-"));
  await writeFile(join(stubBin, "gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
});

afterAll(async () => {
  await rm(stubBin, { recursive: true, force: true });
  await rm(workDir, { recursive: true, force: true });
});

describe("CLI machine-readable output", () => {
  it("prints only parseable JSON on stdout for analyze --format json", () => {
    const run = cli(["analyze", JAVA_FIXTURES, "--format", "json"]);
    const report = JSON.parse(run.stdout);

    expect(Array.isArray(report.results)).toBe(true);
    expect(report.summary.total).toBe(report.results.length);
    // The Copilot hint still reaches the user, on stderr
    expect(run.stderr).toContain("GitHub Copilot CLI");
  });

  it("prints the package version", async () => {
    const { version } = JSON.parse(await readFile(join(ROOT, "package.json"), "utf-8"));
    expect(cli(["--version"]).stdout.trim()).toBe(version);
  });

  it("rejects an invalid confidence threshold", () => {
    const run = cli(["analyze", JAVA_FIXTURES, "-c", "abc"]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Invalid --confidence");
  });
});

describe("init", () => {
  it("does not overwrite an existing configuration without --force", async () => {
    const project = join(workDir, "project");
    await mkdir(project, { recursive: true });
    const configPath = join(project, ".hambugsy.yml");
    await writeFile(configPath, "custom: true\n");

    const refused = cli(["init"], project);
    expect(refused.status).toBe(1);
    expect(await readFile(configPath, "utf-8")).toBe("custom: true\n");

    const forced = cli(["init", "--force", "--language", "python"], project);
    expect(forced.status).toBe(0);
    expect(await readFile(configPath, "utf-8")).toContain("language: python");
  });
});
