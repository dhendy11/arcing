// Usage: npm run hash-password
// Reads one line from stdin so the password never lands in shell history,
// prints the value to paste into APP_PASSWORD_HASH.
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { hashPassword } from "../src/server/session";

async function main(): Promise<void> {
  // The echo is muted rather than written to stdout: readline sends the
  // prompt AND every keystroke to its output stream, so the one password
  // would otherwise sit in terminal scrollback for the rest of the session.
  // terminal: true is what makes readline take the input over in raw mode,
  // which is what stops the terminal's own echo; without it the keystrokes
  // appear whatever this stream does with them. The prompt goes to stderr by
  // hand, leaving stdout carrying nothing but the hash so it can be piped.
  const muted = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stderr.write("Password: ");
  const password = await rl.question("");
  rl.close();
  process.stderr.write("\n");
  if (!password) {
    console.error("no password given");
    process.exitCode = 1;
    return;
  }
  console.log(hashPassword(password));
}

void main();
