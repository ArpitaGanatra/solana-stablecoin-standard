#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import {
  loadCliConfig,
  loadKeypair,
  getConnection,
  getCoreProgram,
  getProvider,
} from "./utils/connection.js";

async function main() {
  try {
    const config = loadCliConfig();
    const keypair = loadKeypair();
    const connection = getConnection(config.network);
    const provider = getProvider(connection, keypair);
    const program = await getCoreProgram(provider);

    render(
      <App
        mintAddress={config.mint}
        network={config.network}
        decimals={config.decimals}
        preset={config.preset}
        program={program}
        connection={connection}
        keypair={keypair}
        hookProgramId={config.transferHookProgramId}
      />
    );
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    console.error(
      'Make sure you have run "sss-token init" first and have a valid keypair configured.'
    );
    process.exit(1);
  }
}

main();
