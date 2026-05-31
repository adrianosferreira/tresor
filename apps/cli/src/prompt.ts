import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function promptLine(message: string): Promise<string> {
  const rl = createInterface({ input, output });
  const answer = await rl.question(message);
  rl.close();
  return answer.trim();
}

export function promptPassword(message: string): Promise<string> {
  const fromEnv = process.env.TRESOR_PASSWORD ?? process.env.TRESOR_MASTER_PASSWORD;
  if (fromEnv) {
    return Promise.resolve(fromEnv);
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(message);

    let password = "";
    stdin.resume();
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.setEncoding("utf8");

    const onData = (chunk: string) => {
      switch (chunk) {
        case "\n":
        case "\r":
        case "\u0004":
          stdin.pause();
          if (stdin.isTTY) {
            stdin.setRawMode(false);
          }
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
          break;
        case "\u0003":
          process.stdout.write("\n");
          process.exit(130);
          break;
        case "\u007f":
          password = password.slice(0, -1);
          break;
        default:
          password += chunk;
          break;
      }
    };

    stdin.on("data", onData);
  });
}
