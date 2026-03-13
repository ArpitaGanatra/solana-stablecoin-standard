import { Command } from "commander";
import { spawn } from "child_process";
import path from "path";
import { error } from "../utils/format";

export function registerTuiCommand(program: Command): void {
  program
    .command("tui")
    .description("Launch the interactive Admin TUI dashboard")
    .action(async () => {
      try {
        const tuiEntry = path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "tui",
          "dist",
          "index.js"
        );

        const child = spawn("node", [tuiEntry], {
          stdio: "inherit",
          env: process.env,
          cwd: process.cwd(),
        });

        child.on("error", (err) => {
          error(
            `Failed to start TUI: ${err.message}. Make sure you've built the TUI (cd tui && npm run build).`
          );
          process.exit(1);
        });

        child.on("exit", (code) => {
          process.exit(code || 0);
        });
      } catch (err: any) {
        error(err.message);
        process.exit(1);
      }
    });
}
