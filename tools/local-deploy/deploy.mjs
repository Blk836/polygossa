// A deploy of production from this PC (docs/acceptance/local-deploy.feature): check AWS sign-in and Docker, take the
// PC's turn, deploy the latest main from the deploy copy unless it is already live, check the site answers, and mark
// main's commit on GitHub.

const USAGE = "Usage: node tools/local-deploy.mjs [--again]";
const PROBE_TRIES = 20; // 15 s apart, as GitHub's deploy waited: new containers take a few minutes to start

/** @returns {Promise<number>} the exit code */
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

/** Whether AWS sign-in and Docker are there, saying what to do when they aren't. */
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
  const { problem, siteUrl } = await deployAndCheck(sha, deps);
  const took = `${Math.round((deps.now() - start) / 60_000)}m`;
  if (problem) {
    await mark(sha, "failure", problem, deps);
    deps.log(`\nDeploy FAILED after ${took}: ${problem}.`);
    return 1;
  }
  await mark(sha, "success", "Deployed from the PC; the site answers", deps);
  deps.log(`\nDeployed main (${sha}) to production in ${took}: ${siteUrl} answers.`);
  return 0;
}

/** Deploys, then checks the site; `problem` says what went wrong, if anything. */
async function deployAndCheck(sha, deps) {
  if (!(await deps.prepare(sha))) return { problem: "the deploy copy of main could not be prepared" };
  const { ok, siteUrl } = await deps.deploy();
  if (!ok) return { problem: "cdk deploy failed (CloudFormation rolls production back by itself)" };
  if (!(await probe(`${siteUrl}/login`, () => true, deps))) return { problem: "the sign-in page never answered" };
  const languages = (body) => body.includes('"code"');
  if (!(await probe(`${siteUrl}/api/languages`, languages, deps))) {
    return { problem: "the backend never answered through the site (the languages list)" };
  }
  return { siteUrl };
}

/** Asks `url` until it answers OK with a body passing `check`, up to PROBE_TRIES times. */
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
