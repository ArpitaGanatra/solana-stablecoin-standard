#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init";
import { registerMintCommand } from "./commands/mint";
import { registerBurnCommand } from "./commands/burn";
import { registerFreezeCommand } from "./commands/freeze";
import { registerThawCommand } from "./commands/thaw";
import { registerPauseCommand, registerUnpauseCommand } from "./commands/pause";
import {
  registerStatusCommand,
  registerSupplyCommand,
} from "./commands/status";
import { registerBlacklistCommand } from "./commands/blacklist";
import { registerSeizeCommand } from "./commands/seize";
import { registerMintersCommand } from "./commands/minters";
import { registerRolesCommand } from "./commands/roles";
import { registerHoldersCommand } from "./commands/holders";
import { registerAuditLogCommand } from "./commands/audit-log";
import { registerTuiCommand } from "./commands/tui";
import { registerOracleCommand } from "./commands/oracle";

const program = new Command();

program
  .name("sss-token")
  .description("Solana Stablecoin Standard CLI")
  .version("0.1.0");

// Core commands
registerInitCommand(program);
registerMintCommand(program);
registerBurnCommand(program);
registerFreezeCommand(program);
registerThawCommand(program);
registerPauseCommand(program);
registerUnpauseCommand(program);
registerStatusCommand(program);
registerSupplyCommand(program);

// SSS-2 compliance
registerBlacklistCommand(program);
registerSeizeCommand(program);

// Management
registerMintersCommand(program);
registerRolesCommand(program);
registerHoldersCommand(program);
registerAuditLogCommand(program);

// Interactive TUI
registerTuiCommand(program);

// Oracle module
registerOracleCommand(program);

program.parse();
