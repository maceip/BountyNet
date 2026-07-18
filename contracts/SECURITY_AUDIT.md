# BountyNet Security Audit — New Findings

**Audit Date:** 2026-07-18
**Scope:** All contracts in `contracts/src/`, deployment script, and test suite.
**Excludes:** Five previously-reported issues (cross-bounty validation hash reuse, `consume()` access control, NFT transfer agent_wallet, mutable validation responses, resolve/cancel deadline race).

---

## Finding 1 — Unchecked ERC-20 Return Values in BountyEscrow

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Location** | `contracts/src/BountyEscrow.vy` lines 118, 182, 183, 202, 219 |
| **Title** | ERC-20 `transfer`/`transferFrom` return values silently discarded |

**Description:**
All five `extcall` invocations of `IERC20.transfer` and `IERC20.transferFrom` discard the `bool` return value. Vyper 0.4's `extcall` decodes but does not assert the return. ERC-20 tokens that signal failure by returning `false` (instead of reverting) will silently fail.

**Attack Path:**
1. Deploy or configure BountyEscrow with an ERC-20 token that returns `false` on failed transfers (e.g., tokens following the original ERC-20 spec like USDT on some chains).
2. Call `create_bounty` with an amount exceeding allowance or balance. The `transferFrom` at line 118 returns `false`; the bounty is created with no EURC actually deposited.
3. The bounty can be claimed and resolved, paying the solver from other users' deposits held in the contract.

**Evidence:**
```
Line 118: extcall IERC20(self.eurc).transferFrom(msg.sender, self, amount)
Line 182: extcall IERC20(self.eurc).transfer(solver_wallet, solver_payout)
Line 183: extcall IERC20(self.eurc).transfer(self.treasury, treasury_payout)
Line 202: extcall IERC20(self.eurc).transfer(b.creator, b.amount)
Line 219: extcall IERC20(self.eurc).transferFrom(msg.sender, self, additional)
```

**Impact:** Unfunded bounties can drain funds deposited by other users. Resolve/cancel payouts can silently fail, permanently locking funds.

**Remediation:** Capture and assert every return value:
```vyper
success: bool = extcall IERC20(self.eurc).transferFrom(msg.sender, self, amount)
assert success, "transfer failed"
```

---

## Finding 2 — Permissionless Self-Validated Oracle Records in ValidationRegistry

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Location** | `contracts/src/ValidationRegistry.vy` lines 46–73 |
| **Title** | Anyone can create a validation request naming themselves as validator, then self-approve it |

**Description:**
`validation_request` has no access control: it accepts an arbitrary `validator` address and `agent_id` without verifying the caller owns the agent or that the validator is an authorized oracle. An attacker can designate their own address as `validator`, then call `validation_response` as that validator with `response = 100`.

This is distinct from the known cross-bounty hash reuse: even if BountyEscrow were patched to bind validation hashes to context hashes, an attacker can still fabricate a "passing" validation record from scratch.

**Attack Path:**
1. Attacker picks a `request_hash` that encodes the target bounty's context data.
2. Attacker calls `validation_request(validator=ATTACKER, agent_id=ANY, uri="", request_hash=H)`.
3. Attacker calls `validation_response(H, 100, empty_hash, "")` as the validator.
4. `is_validated(H)` now returns `True`.
5. Attacker calls `resolve_bounty(context_hash, H)` on BountyEscrow to drain the bounty.

**Evidence:**
```
Line 46-52: No check that msg.sender owns agent_id or that validator is authorized
Line 78-98: validation_response only checks msg.sender == record.validator (attacker IS the validator)
```

**Impact:** Complete theft of any claimed bounty by fabricating CI validation.

**Remediation:** Verify `msg.sender` owns `agent_id` via the IdentityRegistry, and restrict `validator` to a whitelist of authorized oracle addresses.

---

## Finding 3 — ecrecover Zero-Address Bypass in BountyNetResolver

| Field | Value |
|---|---|
| **Severity** | HIGH |
| **Location** | `contracts/src/ens/BountyNetResolver.sol` lines 78–79, 86–89, 108–119 |
| **Title** | Setting `signer` to `address(0)` allows any invalid signature to pass verification |

**Description:**
`ecrecover` returns `address(0)` when signature recovery fails (malformed v/r/s). The `setSigner` function has no zero-address guard. If `signer` is set to `address(0)`, the check `recovered == signer` passes for any invalid signature, allowing arbitrary forged CCIP-Read responses.

**Attack Path:**
1. Owner calls `setSigner(address(0))` (accidentally, or via compromised key).
2. Attacker constructs a `resolveWithProof` call with a forged `result`, valid `expiry`, and a garbage 65-byte signature.
3. `ecrecover` fails → returns `address(0)` → matches `signer` → response accepted.
4. ENS clients resolve attacker-controlled addresses for `*.maceip.eth` subdomains.

**Evidence:**
```
Line 86-89: function setSigner(address _signer) external { ... signer = _signer; }
   — No require(_signer != address(0))
Line 78-79: address recovered = _recover(messageHash, sig);
            require(recovered == signer, "Invalid signature");
   — recovered can be address(0) when ecrecover fails
```

**Impact:** Complete ENS resolution hijack — users send funds to attacker-controlled addresses.

**Remediation:**
```solidity
function setSigner(address _signer) external {
    require(msg.sender == owner, "not owner");
    require(_signer != address(0), "zero signer");
    signer = _signer;
}
```
Also add `require(recovered != address(0), "recovery failed")` in `resolveWithProof`.

---

## Finding 4 — Fleet Tracking Desync on NFT Transfer in IdentityRegistry

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `contracts/src/IdentityRegistry.vy` lines 190–197, 25 |
| **Title** | `_transfer` does not update `owner_agents` DynArray, causing stale fleet data |

**Description:**
When an NFT is transferred via `transferFrom` or `safeTransferFrom`, `_transfer` updates `_owners` and `_balances` but never removes the token from `owner_agents[_from]` or adds it to `owner_agents[_to]`.

**Attack Path:**
1. Alice registers agent ID 1 → `owner_agents[Alice] = [1]`.
2. Alice transfers token 1 to Bob.
3. `owner_agents[Alice]` still contains `[1]`; `owner_agents[Bob]` is empty.
4. `get_fleet(Alice)` returns `[1]` (stale — Alice no longer owns it).
5. `get_fleet(Bob)` returns `[]` (wrong — Bob owns token 1).
6. Any off-chain or on-chain system relying on `get_fleet` for authorization or display will make incorrect decisions.

**Evidence:**
```
Line 190-197: _transfer function — no reference to owner_agents
Line 25: owner_agents: public(HashMap[address, DynArray[uint256, 100]])
Line 85: self.owner_agents[msg.sender].append(agent_id)  — only added on mint
```

**Impact:** Incorrect fleet data for authorization decisions, UI display, and fleet-size-gated logic.

**Remediation:** Update `owner_agents` in `_transfer`: remove `token_id` from `owner_agents[_from]` and append to `owner_agents[_to]`.

---

## Finding 5 — safeTransferFrom Missing onERC721Received Callback

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `contracts/src/IdentityRegistry.vy` lines 185–187 |
| **Title** | `safeTransferFrom` does not call `onERC721Received`, violating ERC-721 |

**Description:**
ERC-721 requires `safeTransferFrom` to call `IERC721Receiver.onERC721Received` on the recipient if it is a contract, and revert if the recipient does not return the expected selector. This implementation simply delegates to `_transfer` without any receiver check.

**Attack Path:**
1. User calls `safeTransferFrom` to transfer an agent NFT to a contract address.
2. The receiving contract has no ERC-721 handling logic.
3. The NFT is permanently locked in the receiving contract with no way to recover it.

**Evidence:**
```
Line 185-187:
def safeTransferFrom(_from: address, _to: address, token_id: uint256, data: Bytes[1024] = b""):
    assert self._is_approved_or_owner(msg.sender, token_id), "not authorized"
    self._transfer(_from, _to, token_id)
    # Missing: extcall IERC721Receiver(_to).onERC721Received(...)
```

**Impact:** Permanent loss of agent identity NFTs when transferred to non-ERC-721-aware contracts.

**Remediation:** After `_transfer`, check if `_to` is a contract and call `onERC721Received`. Revert if the return value is not `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`.

---

## Finding 6 — DynArray DoS via Spam in ValidationRegistry

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `contracts/src/ValidationRegistry.vy` lines 19–20, 70–71 |
| **Title** | Permissionless `validation_request` enables DynArray capacity exhaustion DoS |

**Description:**
`agent_validations` and `validator_requests` are `DynArray[bytes32, 1024]`. Since `validation_request` is permissionless, an attacker can spam 1024 requests for any `agent_id` or `validator` address, filling the array to capacity. Subsequent legitimate requests for that agent or validator will revert with a DynArray overflow.

**Attack Path:**
1. Attacker identifies a high-value validator oracle address.
2. Attacker sends 1024 `validation_request` calls with `validator = oracle_address`.
3. `validator_requests[oracle_address]` reaches capacity (1024 elements).
4. Any legitimate `validation_request` targeting that oracle reverts.
5. No bounties can be validated through that oracle, halting the protocol.

**Evidence:**
```
Line 19: agent_validations: HashMap[uint256, DynArray[bytes32, 1024]]
Line 20: validator_requests: HashMap[address, DynArray[bytes32, 1024]]
Line 70: self.agent_validations[agent_id].append(request_hash)
Line 71: self.validator_requests[validator].append(request_hash)
```

**Impact:** Permanent denial of service for targeted agents or validators.

**Remediation:** Add access control to `validation_request` (require caller to own the `agent_id`). Consider removing the unbounded append pattern or increasing the array capacity.

---

## Finding 7 — ECDSA Signature Malleability in BountyNetResolver

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `contracts/src/ens/BountyNetResolver.sol` lines 108–119 |
| **Title** | `_recover` does not enforce low-s normalization (EIP-2) |

**Description:**
The `_recover` function uses raw `ecrecover` without checking that `s <= secp256k1n/2`. For every valid signature `(v, r, s)`, a second valid signature `(v', r, secp256k1n - s)` exists that recovers to the same address. While this resolver doesn't track used signatures (so replay isn't a direct concern), it violates best practice and can cause issues if signature uniqueness assumptions are added later or if downstream caches key on signature bytes.

**Evidence:**
```
Line 108-119: _recover function — no check on s value range
```

**Impact:** Signature malleability; potential for cache-poisoning or confusion in downstream systems.

**Remediation:** Add `require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "invalid s")` or use OpenZeppelin's `ECDSA.recover`.

---

## Finding 8 — MockEURC mint() Has No Access Control

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `contracts/src/MockEURC.vy` lines 28–31 |
| **Title** | Unrestricted `mint` function allows anyone to create unlimited tokens |

**Description:**
`MockEURC.mint()` has no `onlyOwner` or any access control. If this contract is deployed to testnet (or accidentally to mainnet alongside BountyEscrow), anyone can mint unlimited EURC, create bounties for free, and drain legitimate funds via the escrow split mechanism.

**Attack Path:**
1. MockEURC is deployed as the EURC token for BountyEscrow (as done in tests and deployment script default).
2. Attacker calls `eurc.mint(attacker, 1_000_000e6)` — instant unlimited supply.
3. Attacker creates bounties with minted tokens, claims them via a second account, self-validates (Finding 2), and resolves — converting minted tokens into "real" protocol payouts.

**Evidence:**
```
Line 28-31:
@external
def mint(to: address, amount: uint256):
    self.balanceOf[to] += amount
    self.totalSupply += amount
```

**Impact:** Total protocol insolvency if MockEURC is used in any non-test environment.

**Remediation:** Add an `owner`-only guard: `assert msg.sender == self.owner, "not owner"`. Better: ensure deployment scripts never use MockEURC outside of test environments.

---

## Finding 9 — claim_intent Front-Running via Mempool Observation

| Field | Value |
|---|---|
| **Severity** | MEDIUM |
| **Location** | `contracts/src/BountyEscrow.vy` lines 136–152 |
| **Title** | Solver's `claim_intent` can be front-run by MEV bots |

**Description:**
`claim_intent` is first-come-first-served with no commit-reveal scheme. An attacker monitoring the mempool can see a solver's `claim_intent` transaction, front-run it with their own agent ID, and steal the bounty opportunity. The original solver's transaction reverts with "already claimed".

**Attack Path:**
1. Solver broadcasts `claim_intent(context_hash, solver_agent_id)`.
2. MEV bot sees the pending transaction, calls `claim_intent(context_hash, bot_agent_id)` with higher gas.
3. Bot's transaction mines first; solver's reverts.
4. Bot now controls the bounty claim and receives payout upon resolution.

**Evidence:**
```
Line 145: assert b.solver_agent_id == 0, "already claimed"
   — First successful claim wins; no preference for legitimate solvers
```

**Impact:** Solvers who invest effort in fixing code can be denied bounty rewards by front-runners who haven't done the work (though they'd still need the validation to pass).

**Remediation:** Implement a commit-reveal scheme for claim_intent, or add a creator-confirmation step where the bounty creator approves the solver.

---

## Finding 10 — ResourceClaim NFTs Are Non-Transferable (Missing ERC-721 Transfer Functions)

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Location** | `contracts/src/ResourceClaim.vy` (entire contract) |
| **Title** | No `transferFrom`, `approve`, or `safeTransferFrom` despite claiming ERC-721 via `supportsInterface` |

**Description:**
ResourceClaim reports `supportsInterface(0x80ac58cd) = True` (ERC-721), but implements no transfer, approval, or safe-transfer functions. Any system or marketplace that trusts `supportsInterface` will believe these NFTs are transferable, then fail when attempting transfers.

**Evidence:**
```
Line 200-201: return interface_id in [0x01ffc9a7, 0x80ac58cd]
   — Claims ERC-721 compliance
   — No transferFrom, approve, setApprovalForAll, safeTransferFrom, getApproved, or isApprovedForAll
```

**Impact:** False ERC-721 compliance; integration failures with wallets, marketplaces, and any contract expecting standard ERC-721 transfers.

**Remediation:** Either implement the full ERC-721 interface or remove `0x80ac58cd` from `supportsInterface`.

---

## Finding 11 — Deployment Script Defaults Treasury to Deployer EOA

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Location** | `contracts/script/deploy.py` line 20 |
| **Title** | Missing `TREASURY_ADDRESS` silently defaults to deployer, sending all protocol fees to an EOA |

**Description:**
If `TREASURY_ADDRESS` is not set in the environment, the deploy script defaults to `deployer.address`. This is an EOA that may not be a multisig or governed treasury, meaning 30% of all bounty payouts silently flow to the deployer's personal address.

**Evidence:**
```
Line 20: treasury = os.environ.get("TREASURY_ADDRESS", deployer.address)
```

**Impact:** Protocol fees directed to an uncontrolled EOA; no governance over treasury funds.

**Remediation:** Remove the default and require `TREASURY_ADDRESS` explicitly:
```python
treasury = os.environ.get("TREASURY_ADDRESS")
if not treasury:
    raise ValueError("Set TREASURY_ADDRESS in .env")
```

---

## Finding 12 — ResourceClaim Not Deployed by Deployment Script

| Field | Value |
|---|---|
| **Severity** | LOW |
| **Location** | `contracts/script/deploy.py` |
| **Title** | `ResourceClaim.vy` is never deployed despite being part of the protocol |

**Description:**
The deployment script deploys IdentityRegistry, ValidationRegistry, and BountyEscrow, but omits ResourceClaim. If ResourceClaim is needed for the compute-staking flow, it must be deployed separately (undocumented) or is missing entirely from the on-chain deployment.

**Evidence:**
```
Lines 28-46: Only 3 contracts deployed — no reference to ResourceClaim.vy
```

**Impact:** Incomplete protocol deployment; compute-staking features unavailable.

**Remediation:** Add ResourceClaim deployment as step 4 in the deploy script.

---

## Test Coverage Gaps

The following untested paths represent attack surface with zero automated coverage:

| Gap | Risk |
|---|---|
| **ERC-721 transfer functions** (`transferFrom`, `safeTransferFrom`, `approve`, `setApprovalForAll`) in IdentityRegistry | Bugs in transfer logic undetected |
| **ResourceClaim contract** — zero test coverage | All stake/consume/expire logic untested |
| **`escalate_bounty` on resolved or cancelled bounty** | Missing negative-path assertion |
| **`create_bounty` with zero `deadline_blocks`** | Instantly-expired bounties untested |
| **`validation_request` from non-agent-owner** | Permissionless creation (Finding 2) undetected |
| **`resolve_bounty` with self-fabricated validation** | Core exploit path (Finding 2) undetected |
| **`bounty_count` never decremented** | Counter inaccuracy after cancel/resolve |
| **Multiple bounty lifecycle edge cases** | Escalate-then-cancel, escalate-then-resolve ordering |
