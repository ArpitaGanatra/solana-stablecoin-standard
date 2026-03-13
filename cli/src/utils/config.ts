import fs from "fs";
import path from "path";

const CONFIG_FILE = ".sss-token.json";

export interface CliConfig {
  mint: string;
  decimals: number;
  preset?: string;
  network: string;
  transferHookProgramId?: string;
}

function configPath(): string {
  return path.resolve(process.cwd(), CONFIG_FILE);
}

export function saveConfig(config: CliConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

export function loadConfig(): CliConfig {
  const p = configPath();
  if (!fs.existsSync(p)) {
    throw new Error(`No ${CONFIG_FILE} found. Run "sss-token init" first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function configExists(): boolean {
  return fs.existsSync(configPath());
}
