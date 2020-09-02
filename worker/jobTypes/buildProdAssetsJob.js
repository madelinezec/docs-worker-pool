const workerUtils = require('../utils/utils');
const S3Publish = require('../jobTypes/S3Publish').S3PublishClass;
const GitHubJob = require('../jobTypes/githubJob').GitHubJobClass;
const GatsbyAdapter = require('../jobTypes/GatsbyAdapter').GatsbyAdapterClass;
const Logger = require('../utils/logger').LoggerClass;



async function startGithubBuild(job, logger) {
  const builder = new GatsbyAdapter(job);
  const buildOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    job.buildRepo(logger, builder, true),
    'Timed out on build',
  );
  // checkout output of build
  if (buildOutput && buildOutput.status === 'success') {
    // only post entire build output to slack if there are warnings
    const buildOutputToSlack = `${buildOutput.stdout}\n\n${buildOutput.stderr}`;
    if (buildOutputToSlack.indexOf('WARNING') !== -1) {
      await logger.sendSlackMsg(buildOutputToSlack);
    }
    return new Promise((resolve) => {
      resolve(true);
    });
  }
  return new Promise((reject) => {
    reject(false);
  });
}


async function tarAssets(publisher, logger) {
  const results = await workerUtils.promiseTimeoutS(
    buildTimeout,
    publisher.tarAssets(logger),
    'Timed out on push to production'
  );
  // checkout output of tar
  if (results && results.status === 'success') {
    await logger.sendSlackMsg(prodOutput.stdout);

    return new Promise((resolve) => {
      resolve(true);
    });
  }
  return new Promise((reject) => {
    reject(false);
  });
}

//need to rename eventually
function safeGithubAssets(currentJob) {
  if (
    !currentJob
    || !currentJob.payload
    || !currentJob.payload.repoName
    || !currentJob.payload.repoOwner
    || !currentJob.payload.branchName
  ) {
    workerUtils.logInMongo(
      currentJob,
      `${'    (sanitize)'.padEnd(15)}failed due to insufficient job definition`
    );
    throw invalidJobDef;
	}
	
  if (
    workerUtils.safeString(currentJob.payload.repoName) &&
    workerUtils.safeString(currentJob.payload.repoOwner) &&
    workerUtils.safeString(currentJob.payload.branchName)
  ) {
    return true;
  }
  throw invalidJobDef;
}
//how to get link from staging?
async function pushToStaging(publisher, logger) {
  const prodOutput = await workerUtils.promiseTimeoutS(
    buildTimeout,
    publisher.pushToStaging(logger),
    'Timed out on push to production'
  );
  // checkout output of build
  if (prodOutput && prodOutput.status === 'success') {
    await logger.sendSlackMsg(prodOutput.stdout);

    return new Promise((resolve) => {
      resolve(true);
    });
  }
  return new Promise((reject) => {
    reject(false);
  });
}

async function runGithubAssetsPush(currentJob) {
	console.log("finally!")
  const ispublishable = await verifyBranchConfiguredForPublish(currentJob);
  const userIsEntitled = await verifyUserEntitlements(currentJob);

  if (!ispublishable) {
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)} You are trying to run in production a branch that is not configured for publishing`)
    throw new Error('entitlement failed');
  }
  if (!userIsEntitled) {
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)} failed, you are not entitled to build or deploy (${currentJob.repoOwner}/${currentJob.repoName}) for master branch`);
    throw new Error('entitlement failed');
  }

  workerUtils.logInMongo(currentJob, ' ** Running github push function');

  if (
    !currentJob
    || !currentJob.payload
    || !currentJob.payload.repoName
    || !currentJob.payload.branchName
  ) {
    workerUtils.logInMongo(currentJob, `${'(BUILD)'.padEnd(15)}failed due to insufficient definition`);
    throw invalidJobDef;
  }

  // instantiate github job class and logging class
  const job = new GitHubJob(currentJob);
  const logger = new Logger(currentJob);
  const publisher = new S3Publish(job);

  await startGithubBuild(job, logger);

	await pushToStaging(publisher, logger);
	
	await tarAssets(publisher, logger);

  const files = workerUtils.getFilesInDir(
    `./${currentJob.payload.repoName}/build/public`,
  );

  return files;
}

module.exports = {
	startGithubBuild,
	safeGithubAssets,
  runGithubAssetsPush,
	pushToStaging,
};