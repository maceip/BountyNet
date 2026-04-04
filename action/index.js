const core = require('@actions/core');
const { createHash } = require('crypto');

async function run() {
  const gateway = core.getInput('gateway');

  // Get GitHub OIDC token — proves repo, actor, sha, run
  let oidc = '';
  try {
    oidc = await core.getIDToken('bountynet');
  } catch (e) {
    core.warning(`OIDC token unavailable: ${e.message}. Attestation will be unverified.`);
  }

  // Build context from GitHub environment
  const context = {
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    actor: process.env.GITHUB_ACTOR,
    ref: process.env.GITHUB_REF,
    run_id: process.env.GITHUB_RUN_ID,
    workflow: process.env.GITHUB_WORKFLOW,
    runner: process.env.RUNNER_ENVIRONMENT || 'unknown',
    job_status: process.env.BOUNTYNET_JOB_STATUS || 'unknown',
  };

  // Context hash — deterministic identifier for this build
  const contextHash = core.getInput('context-hash') ||
    '0x' + createHash('sha256')
      .update(`${context.repository}:${context.sha}:${context.workflow}`)
      .digest('hex');

  // OIDC hash for TEE signing chain
  const oidcHash = oidc
    ? '0x' + createHash('sha256').update(oidc).digest('hex')
    : '';

  // Post attestation to gateway
  const resp = await fetch(`${gateway}/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oidc_token: oidc,
      oidc_hash: oidcHash,
      context,
      context_hash: contextHash,
    }),
  });

  const result = await resp.json();

  core.setOutput('context-hash', contextHash);
  core.setOutput('oidc-hash', oidcHash);
  core.setOutput('attestation-id', result.attestation_id || '');
  core.setOutput('principal', context.actor);

  core.info(`[bountynet] attested: ${context.repository}@${context.sha.slice(0, 8)}`);
  core.info(`[bountynet] context: ${contextHash.slice(0, 18)}...`);
  if (oidcHash) core.info(`[bountynet] oidc: ${oidcHash.slice(0, 18)}...`);
}

run().catch(e => core.setFailed(e.message));
