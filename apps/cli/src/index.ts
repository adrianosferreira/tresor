#!/usr/bin/env node
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { secretGetCommand, type SecretGetOptions } from "./commands/secret-get.js";

function printHelp() {
  console.log(`Tresor CLI — zero-knowledge secret retrieval

Usage:
  tresor login
  tresor logout
  tresor secret get <alias> [--field <name>] [--json]

Environment:
  TRESOR_API_URL          API base URL (default: http://localhost:8080)
  TRESOR_EMAIL            Email for login (skips prompt)
  TRESOR_PASSWORD         Password (skips prompt; use in CI carefully)
  TRESOR_CONFIG_DIR       Config directory (default: ~/.config/tresor)

Examples:
  tresor login
  tresor secret get prod/stripe --field apiKey
  tresor secret get prod/stripe --json
`);
}

function parseSecretGetArgs(argv: string[]): { alias: string; options: SecretGetOptions } {
  const options: SecretGetOptions = { json: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--field" && argv[i + 1]) {
      options.field = argv[++i];
    } else if (arg.startsWith("--field=")) {
      options.field = arg.slice("--field=".length);
    } else {
      positional.push(arg);
    }
  }

  const alias = positional.join("/");
  if (!alias) {
    throw new Error("Alias is required, e.g. tresor secret get prod/stripe");
  }

  return { alias, options };
}

async function main() {
  const [, , command, subcommand, ...rest] = process.argv;

  try {
    if (command === "login") {
      await loginCommand();
      return;
    }

    if (command === "logout") {
      await logoutCommand();
      return;
    }

    if (command === "secret" && subcommand === "get") {
      const { alias, options } = parseSecretGetArgs(rest);
      await secretGetCommand(alias, options);
      return;
    }

    printHelp();
    process.exit(command ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Command failed";
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
