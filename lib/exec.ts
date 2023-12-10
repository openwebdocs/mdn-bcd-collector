//
// mdn-bcd-collector: lib/exec.ts
// Execute a command
//
// Gooborg Studios
// See the LICENSE file for copyright details
//

import childProcess from "node:child_process";

/**
 * Executes a command in the terminal.
 * @param cmd - The command to execute.
 * @param env - The environment variables to use during execution, extending to the current process environment.
 * @param pipe - Whether to pipe the command output. Defaults to true.
 * @returns A promise that resolves with the output of the command.
 */
const exec = async (cmd: string, env?: any, pipe = true): Promise<string> => {
  env = {...process.env, ...env};
  /* c8 ignore start */
  if (!pipe) {
    console.log(`> ${cmd}`);
  }
  /* c8 ignore stop */
  const output = childProcess.execSync(cmd, {
    env,
    stdio: pipe ? "pipe" : "inherit",
  });
  return String(output);
};

export default exec;
