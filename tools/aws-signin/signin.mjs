export async function checkSignIn({ cliPath, cliExists, account, login, expectedAccount, profile, log }) {
  if (!cliExists()) {
    log(`AWS CLI not found at ${cliPath}. Install AWS CLI v2, then start Backend again.`);
    return 1;
  }
  const first = await account();
  if (first.timedOut) {
    log(`The AWS sign-in check timed out: the AWS CLI didn't answer within 30 seconds.`);
    return 1;
  }
  if (first.account) return verdict(first.account, { expectedAccount, profile, log });

  log(`AWS sign-in for profile "${profile}" is missing or expired.`);
  log(`Opening the AWS sign-in in your browser: pick the account "polygossa-app" (${expectedAccount}).`);
  const signedIn = await login();
  const second = signedIn.timedOut ? {} : await account();
  if (second.account) return verdict(second.account, { expectedAccount, profile, log });
  log(`The AWS sign-in didn't complete${signedIn.timedOut ? " within 5 minutes" : ""}. Start Backend again to retry,`);
  log(`or run: aws login --profile ${profile}   and pick "polygossa-app" (${expectedAccount}).`);
  return 1;
}

function verdict(found, { expectedAccount, profile, log }) {
  if (found !== expectedAccount) {
    log(`AWS profile "${profile}" is signed in to account ${found}, not ${expectedAccount} ("polygossa-app").`);
    log(`Run: aws login --profile ${profile}   and pick "polygossa-app"; answer n if asked to switch accounts.`);
    return 1;
  }
  log(`AWS sign-in OK: profile "${profile}" is signed in to account ${found}.`);
  return 0;
}
