# @version ^0.4.0
# @title BountyNet Escrow — EURC-settled CI bounty marketplace
# @notice Stakers lock EURC against broken CI. Solvers fix code. CI Oracle releases payment.
# @dev Integrates EIP-8004 Identity + Validation registries.

# ── Interfaces ──────────────────────────────────────────────────

interface IERC20:
    def transferFrom(sender: address, receiver: address, amount: uint256) -> bool: nonpayable
    def transfer(receiver: address, amount: uint256) -> bool: nonpayable
    def balanceOf(account: address) -> uint256: view
    def approve(spender: address, amount: uint256) -> bool: nonpayable

interface IIdentityRegistry:
    def ownerOf(token_id: uint256) -> address: view
    def get_agent_wallet(agent_id: uint256) -> address: view

interface IValidationRegistry:
    def is_validated(request_hash: bytes32) -> bool: view

# ── Storage ─────────────────────────────────────────────────────

owner: public(address)

identity_registry: public(address)
validation_registry: public(address)
eurc: public(address)
treasury: public(address)

# Split basis points (out of 10000)
solver_bps: public(uint256)    # e.g. 7000 = 70%
treasury_bps: public(uint256)  # e.g. 3000 = 30%

struct Bounty:
    creator: address
    amount: uint256
    deadline: uint256         # block number — auto-refund after this
    solver_agent_id: uint256  # 0 = unclaimed
    context_uri: String[512]  # off-chain pointer to context payload
    resolved: bool
    cancelled: bool

bounties: public(HashMap[bytes32, Bounty])
bounty_count: public(uint256)

# Context hash → validation request hash (links bounty to CI proof)
bounty_validation: public(HashMap[bytes32, bytes32])

# ── Events ──────────────────────────────────────────────────────

event BountyCreated:
    context_hash: indexed(bytes32)
    creator: indexed(address)
    amount: uint256
    deadline: uint256
    context_uri: String[512]

event BountyClaimed:
    context_hash: indexed(bytes32)
    solver_agent_id: indexed(uint256)

event BountyResolved:
    context_hash: indexed(bytes32)
    solver_agent_id: indexed(uint256)
    solver_payout: uint256
    treasury_payout: uint256

event BountyCancelled:
    context_hash: indexed(bytes32)
    refunded_to: indexed(address)
    amount: uint256

event BountyEscalated:
    context_hash: indexed(bytes32)
    new_amount: uint256

# ── Constructor ─────────────────────────────────────────────────

@deploy
def __init__(
    id_registry: address,
    val_registry: address,
    eurc_token: address,
    treasury_addr: address,
    solver_split: uint256,
    treasury_split: uint256,
):
    assert solver_split + treasury_split == 10000, "splits must sum to 10000"
    self.owner = msg.sender
    self.identity_registry = id_registry
    self.validation_registry = val_registry
    self.eurc = eurc_token
    self.treasury = treasury_addr
    self.solver_bps = solver_split
    self.treasury_bps = treasury_split

# ── Create Bounty ───────────────────────────────────────────────

@external
def create_bounty(
    context_hash: bytes32,
    amount: uint256,
    deadline_blocks: uint256,
    context_uri: String[512],
):
    """
    @notice Staker locks EURC against a context payload hash.
    @param context_hash keccak256(repo_owner, repo_name, commit_sha, job_id, failure_sig)
    @param amount EURC amount (6 decimals)
    @param deadline_blocks Number of blocks until auto-refundable
    @param context_uri Off-chain URI to the full context payload
    """
    assert amount > 0, "zero amount"
    assert self.bounties[context_hash].amount == 0, "bounty exists"

    # Pull EURC from staker
    assert staticcall IERC20(self.eurc).balanceOf(msg.sender) >= amount, "insufficient balance"
    extcall IERC20(self.eurc).transferFrom(msg.sender, self, amount)

    self.bounties[context_hash] = Bounty(
        creator=msg.sender,
        amount=amount,
        deadline=block.number + deadline_blocks,
        solver_agent_id=0,
        context_uri=context_uri,
        resolved=False,
        cancelled=False,
    )
    self.bounty_count += 1

    log BountyCreated(context_hash=context_hash, creator=msg.sender, amount=amount, deadline=block.number + deadline_blocks, context_uri=context_uri)

# ── Claim Intent ────────────────────────────────────────────────

@external
def claim_intent(context_hash: bytes32, agent_id: uint256):
    """
    @notice Solver agent claims a bounty. Must hold the EIP-8004 identity NFT.
    @param agent_id The solver's identity registry token ID
    """
    b: Bounty = self.bounties[context_hash]
    assert b.amount > 0, "no bounty"
    assert not b.resolved, "resolved"
    assert not b.cancelled, "cancelled"
    assert b.solver_agent_id == 0, "already claimed"
    assert block.number < b.deadline, "expired"

    # Verify solver owns this agent identity
    assert staticcall IIdentityRegistry(self.identity_registry).ownerOf(agent_id) == msg.sender, "not agent owner"

    self.bounties[context_hash].solver_agent_id = agent_id
    log BountyClaimed(context_hash=context_hash, solver_agent_id=agent_id)

# ── Resolve Bounty ──────────────────────────────────────────────

@external
def resolve_bounty(context_hash: bytes32, validation_hash: bytes32):
    """
    @notice Release payment after CI validation passes.
    @dev Anyone can call this — the proof is in the Validation Registry.
    @param validation_hash The request_hash from the Validation Registry that proves CI green
    """
    b: Bounty = self.bounties[context_hash]
    assert b.amount > 0, "no bounty"
    assert not b.resolved, "already resolved"
    assert not b.cancelled, "cancelled"
    assert b.solver_agent_id > 0, "unclaimed"

    # Check the Validation Registry confirms CI passed
    assert staticcall IValidationRegistry(self.validation_registry).is_validated(validation_hash), "not validated"

    # Link this validation to the bounty
    self.bounty_validation[context_hash] = validation_hash
    self.bounties[context_hash].resolved = True

    # Calculate splits
    solver_payout: uint256 = (b.amount * self.solver_bps) // 10000
    treasury_payout: uint256 = b.amount - solver_payout

    # Pay the solver's agent wallet (from identity registry)
    solver_wallet: address = staticcall IIdentityRegistry(self.identity_registry).get_agent_wallet(b.solver_agent_id)
    extcall IERC20(self.eurc).transfer(solver_wallet, solver_payout)
    extcall IERC20(self.eurc).transfer(self.treasury, treasury_payout)

    log BountyResolved(context_hash=context_hash, solver_agent_id=b.solver_agent_id, solver_payout=solver_payout, treasury_payout=treasury_payout)

# ── Cancel / Refund ─────────────────────────────────────────────

@external
def cancel_bounty(context_hash: bytes32):
    """
    @notice Refund staker if bounty expired without resolution.
    @dev Anyone can trigger, but funds always go back to creator.
    """
    b: Bounty = self.bounties[context_hash]
    assert b.amount > 0, "no bounty"
    assert not b.resolved, "resolved"
    assert not b.cancelled, "already cancelled"
    assert block.number >= b.deadline, "not expired"

    self.bounties[context_hash].cancelled = True
    extcall IERC20(self.eurc).transfer(b.creator, b.amount)

    log BountyCancelled(context_hash=context_hash, refunded_to=b.creator, amount=b.amount)

# ── Escalate ────────────────────────────────────────────────────

@external
def escalate_bounty(context_hash: bytes32, additional: uint256):
    """
    @notice Add more EURC to an existing bounty (anyone can top up).
    """
    b: Bounty = self.bounties[context_hash]
    assert b.amount > 0, "no bounty"
    assert not b.resolved, "resolved"
    assert not b.cancelled, "cancelled"
    assert additional > 0, "zero"

    extcall IERC20(self.eurc).transferFrom(msg.sender, self, additional)
    self.bounties[context_hash].amount = b.amount + additional

    log BountyEscalated(context_hash=context_hash, new_amount=b.amount + additional)

# ── Views ───────────────────────────────────────────────────────

@external
@view
def get_bounty(context_hash: bytes32) -> (address, uint256, uint256, uint256, bool, bool):
    """@return (creator, amount, deadline, solver_agent_id, resolved, cancelled)"""
    b: Bounty = self.bounties[context_hash]
    return (b.creator, b.amount, b.deadline, b.solver_agent_id, b.resolved, b.cancelled)

@external
@view
def is_claimable(context_hash: bytes32) -> bool:
    b: Bounty = self.bounties[context_hash]
    return b.amount > 0 and not b.resolved and not b.cancelled and b.solver_agent_id == 0 and block.number < b.deadline
