// Usage: npm run hash-password
// Reads one line from stdin so the password never lands in shell history,
// prints the value to paste into APP_PASSWORD_HASH.
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/server/session";

async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password: ");
  rl.close();
  if (!password) {
    console.error("no password given");
    process.exitCode = 1;
    return;
  }
  console.log(hashPassword(password));
}

void main();
