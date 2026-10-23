const USAGE = "Usage: node tools/local-deploy.mjs [--again]";
const PROBE_TRIES = 20;

export async function runDeploy(args, deps) {
  if (args.some((arg) => arg !== "--again")) {
    deps.log(`${USAGE}\n  (--again deploys main even if it is already live)`);
    return 2;
  }
  if (!(await ready(deps))) return 2;
  const release = await deps.lock({ pid: deps.pid, branch: deps.branch, folder: deps.folder, started: deps.started });
  try {
    return await deployMain(args.includes("--again"), deps);
  } finally {
    release();
  }
}

async function ready(deps) {
  const account = await deps.account();
  if (!account) {
    deps.log("Not signed in to AWS (the sign-in lasts 12 hours). Run: aws login --profile polygossa");
    return false;
  }
  if (deps.expectedAccount && account !== deps.expectedAccount) {
    deps.log(`Refusing: the polygossa profile is signed in to AWS account ${account}, but the app's account is`
      + ` ${deps.expectedAccount}.`);
    return false;
  }
  if (!(await deps.ownerEmail())) {
    deps.log('No owner email for production\'s alerts and admin: add "owner-email" to the "context" in ~/.cdk.json,'
      + ' e.g. { "context": { "owner-email": "you@example.com" } }, then run this again.');
    return false;
  }
  if (!(await deps.dockerRunning())) {
    deps.log("Docker isn't running: start Docker Desktop (the deploy builds the app's images), then run this again.");
    return false;
  }
  return true;
}

async function deployMain(again, deps) {
  const sha = await deps.mainSha();
  if (!again && (await deps.deployState(sha)) === "success") {
    deps.log(`Main (${sha}) is already live in production; nothing to deploy. (--again deploys it anyway.)`);
    return 0;
  }
  const start = deps.now();
  await mark(sha, "pending", "Deploying from the PC", deps);
  deps.log(`Deploying main (${sha}) to production.`);
  const { problem, siteUrl, paused } = await deployAndCheck(sha, deps);
  const took = `${Math.round((deps.now() - start) / 60_000)}m`;
  if (problem) {
    await mark(sha, "failure", problem, deps);
    deps.log(`\nDeploy FAILED after ${took}: ${problem}.`);
    return 1;
  }
  const what = paused ? "the coming-soon page" : "the site";
  await mark(sha, "success", `Deployed from the PC; ${what} answers`, deps);
  deps.log(`\nDeployed main (${sha}) to production in ${took}: ${what} at ${siteUrl} answers.`);
  return 0;
}

async function deployAndCheck(sha, deps) {
  if (!(await deps.prepare(sha))) return { problem: "the deploy copy of main could not be prepared" };
  const unsafe = unsafeDatabaseChange(await deps.liveState(), await deps.plannedState());
  if (unsafe) return { problem: `${unsafe}; production wasn't touched` };
  if (!(await deps.liveChecks())) {
    return { problem: "the live checks against AWS (Translate, S3) failed; production wasn't touched" };
  }
  const { ok, siteUrl, paused } = await deps.deploy();
  if (!ok) return { problem: "cdk deploy failed (CloudFormation rolls production back by itself)" };
  if (paused) {
    const comingSoon = (body) => /coming soon/i.test(body);
    if (!(await probe(`${siteUrl}/`, comingSoon, deps))) return { problem: "the coming-soon page never answered" };
    return { siteUrl, paused };
  }
  if (!(await probe(`${siteUrl}/login`, () => true, deps))) return { problem: "the sign-in page never answered" };
  const languages = (body) => body.includes('"code"');
  if (!(await probe(`${siteUrl}/api/languages`, languages, deps))) {
    return { problem: "the backend never answered through the site (the languages list)" };
  }
  return { siteUrl };
}

function unsafeDatabaseChange(live, planned) {
  if (!live || planned.paused) return null;
  if (live.paused && planned.databaseSnapshot === "none") {
    return "unpausing without \"database-snapshot\" in infra/cdk.json would make a new, empty database"
      + " (name the final snapshot taken when pausing)";
  }
  if (live.paused && planned.databaseSnapshot === live.databaseSnapshot) {
    return `unpausing from ${live.databaseSnapshot} would bring back the older snapshot it ran from before pausing`
      + " (name the final snapshot taken when pausing)";
  }
  if (!live.paused && planned.databaseSnapshot !== live.databaseSnapshot) {
    return `the running database came from ${live.databaseSnapshot}; naming ${planned.databaseSnapshot} would`
      + " have it replaced";
  }
  return null;
}

async function probe(url, check, deps) {
  for (let attempt = 1; attempt <= PROBE_TRIES; attempt++) {
    if (await answers(url, check, deps)) return true;
    if (attempt < PROBE_TRIES) await deps.sleep();
  }
  return false;
}

async function answers(url, check, deps) {
  try {
    const response = await deps.fetch(url);
    return response.ok && check(await response.text());
  } catch {
    return false;
  }
}

async function mark(sha, state, description, deps) {
  const error = await deps.postStatus(sha, state, description);
  if (error) deps.log(`(The "deploy production" mark could not be recorded on GitHub: ${error}.)`);
}
