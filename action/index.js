const core = require('@actions/core');
const { createHash } = require('crypto');

async function run() {
  const gateway = core.getInput('gateway');

  // Get GitHub OIDC token — proves repo, actor, sha, run
  const oidc = await core.getIDToken('bountynet');

  // Build context from GitHub environment
  const context = {
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    actor: process.env.GITHUB_ACTOR,
    ref: process.env.GITHUB_REF,
    run_id: process.env.GITHUB_RUN_ID,
    workflow: process.env.GITHUB_WORKFLOW,
    runner: process.env.RUNNER_ENVIRONMENT || 'unknown',
  };

  // Context hash — deterministic identifier for this build
  const contextHash = core.getInput('context-hash') ||
    '0x' + createHash('sha256')
      .update(`${context.repository}:${context.sha}:${context.workflow}`)
      .digest('hex');

  // Post attestation to gateway
  const resp = await fetch(`${gateway}/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oidc_token: oidc,
      context,
      context_hash: contextHash,
    }),
  });

  const result = await resp.json();

  core.setOutput('context-hash', contextHash);
  core.setOutput('attestation-id', result.attestation_id || '');
  core.setOutput('principal', context.actor);

  core.info(`[bountynet] attested: ${context.repository}@${context.sha.slice(0, 8)}`);
  core.info(`[bountynet] actor: ${context.actor}`);
  core.info(`[bountynet] context: ${contextHash.slice(0, 18)}...`);
}

run().catch(e => core.setFailed(e.message));
