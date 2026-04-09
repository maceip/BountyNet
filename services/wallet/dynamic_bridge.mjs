/**
 * Dynamic Node SDK bridge — headless wallet creation.
 *
 * Called from Python (subprocess) or directly via Node.
 *
 * Usage:
 *   node dynamic_bridge.mjs create-user <externalId>
 *   node dynamic_bridge.mjs get-user <externalId>
 *   node dynamic_bridge.mjs create-wallet <userId>
 *
 * Env:
 *   DYNAMIC_ENV_ID   — Dynamic environment ID
 *   DYNAMIC_API_KEY  — Dynamic API key (Bearer token)
 *
 * External IDs:
 *   Staker:  "github:<github_user_id>"
 *   Solver:  "machine:<machine_id_hash>"
 */

const ENV_ID = process.env.DYNAMIC_ENV_ID || process.env.DYNAMIC_ENVIRONMENT_ID;
const API_KEY = process.env.DYNAMIC_API_KEY;
const BASE_URL = `https://app.dynamic.xyz/api/v0/environments/${ENV_ID}`;

if (!ENV_ID || !API_KEY) {
  console.error(JSON.stringify({ error: "DYNAMIC_ENV_ID and DYNAMIC_API_KEY required" }));
  process.exit(1);
}

const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

async function createOrGetUser(externalId) {
  // Try to find existing user by externalId
  const searchRes = await fetch(`${BASE_URL}/users?filter[externalId]=${externalId}`, { headers });
  const searchData = await searchRes.json();

  if (searchData.users && searchData.users.length > 0) {
    return searchData.users[0];
  }

  // Create new user
  const createRes = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ externalId }),
  });
  return await createRes.json();
}

async function createWallet(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/wallets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      chain: "EVM",
      // Dynamic creates an embedded wallet — no private key leaves their infra
    }),
  });
  return await res.json();
}

async function getUserWallets(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/wallets`, { headers });
  return await res.json();
}

// ── CLI ────────────────────────────────────────────────────────

const [cmd, arg] = process.argv.slice(2);

try {
  let result;

  switch (cmd) {
    case "create-user": {
      const user = await createOrGetUser(arg);
      result = { userId: user.id, externalId: arg, email: user.email };
      break;
    }
    case "get-user": {
      const user = await createOrGetUser(arg);
      const wallets = await getUserWallets(user.id);
      result = {
        userId: user.id,
        externalId: arg,
        wallets: (wallets.wallets || []).map(w => ({
          address: w.publicKey || w.address,
          chain: w.chain,
          id: w.id,
        })),
      };
      break;
    }
    case "create-wallet": {
      const wallet = await createWallet(arg);
      result = { wallet };
      break;
    }
    default:
      result = { error: `Unknown command: ${cmd}. Use: create-user, get-user, create-wallet` };
  }

  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
}
