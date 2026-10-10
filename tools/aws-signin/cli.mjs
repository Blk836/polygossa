export const ACCOUNT_TIMEOUT_MS = 30_000;
export const LOGIN_TIMEOUT_MS = 5 * 60_000;

export function awsCli({ cliPath, profile, spawnSync, existsSync }) {
  return {
    cliExists: () => existsSync(cliPath),
    account: async () => {
      const r = spawnSync(cliPath, ["sts", "get-caller-identity", "--profile", profile, "--query", "Account",
        "--output", "text"], { encoding: "utf8", timeout: ACCOUNT_TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] });
      if (r.error?.code === "ETIMEDOUT") return { timedOut: true };
      const account = (r.stdout ?? "").trim();
      return r.status === 0 && /^\d{12}$/.test(account) ? { account } : { failed: true };
    },
    login: async () => {
      const r = spawnSync(cliPath, ["login", "--profile", profile],
        { encoding: "utf8", timeout: LOGIN_TIMEOUT_MS, input: "n\n", stdio: ["pipe", "inherit", "inherit"] });
      if (r.error?.code === "ETIMEDOUT") return { timedOut: true };
      return { code: r.status ?? 1 };
    },
  };
}
