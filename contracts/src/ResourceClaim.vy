# @version ^0.4.0
# @title Resource Claim NFT
# @notice ERC-721 representing staked compute resources (XL instances, API keys)
# @dev Stakers mint when they deposit infra. Solvers consume against it.

# ── Storage ─────────────────────────────────────────────────────

owner: public(address)
next_id: public(uint256)

# ERC-721 core
_owners: HashMap[uint256, address]
_balances: HashMap[address, uint256]

# Resource metadata
struct Resource:
    staker: address
    resource_type: uint8      # 0=api_key, 1=xl_instance, 2=gpu
    provider: String[32]      # "anthropic", "openai", "aws", "azure", "gcp"
    spec: String[64]          # "c6i.8xlarge", "r6i.8xlarge", "sk-ant-..."
    cores: uint256            # 0 for API keys, 32/64/128 for instances
    memory_gb: uint256        # 0 for API keys, 256/512 for instances
    token_budget: uint256     # total tokens staked
    tokens_used: uint256      # consumed by solvers
    created_at: uint256
    expires_at: uint256
    active: bool

resources: public(HashMap[uint256, Resource])
staker_resources: public(HashMap[address, DynArray[uint256, 50]])

# ── Events ──────────────────────────────────────────────────────

event Transfer:
    sender: indexed(address)
    receiver: indexed(address)
    token_id: indexed(uint256)

event ResourceStaked:
    token_id: indexed(uint256)
    staker: indexed(address)
    resource_type: uint8
    provider: String[32]
    spec: String[64]
    cores: uint256
    token_budget: uint256

event ResourceConsumed:
    token_id: indexed(uint256)
    solver_agent_id: uint256
    tokens_used: uint256

event ResourceExpired:
    token_id: indexed(uint256)

# ── Constructor ─────────────────────────────────────────────────

@deploy
def __init__():
    self.owner = msg.sender
    self.next_id = 1

# ── Stake ───────────────────────────────────────────────────────

@external
def stake(
    resource_type: uint8,
    provider: String[32],
    spec: String[64],
    cores: uint256,
    memory_gb: uint256,
    token_budget: uint256,
    duration_hours: uint256,
) -> uint256:
    """
    @notice Stake compute resources. Mints a Resource Claim NFT.
    @param resource_type 0=api_key, 1=xl_instance, 2=gpu
    @param provider Cloud/API provider name
    @param spec Instance type or key prefix
    @param cores vCPU count (0 for API keys)
    @param memory_gb RAM in GB (0 for API keys)
    @param token_budget Total inference tokens available
    @param duration_hours How long the resource is available
    @return token_id The minted NFT ID
    """
    token_id: uint256 = self.next_id
    self.next_id = token_id + 1

    assert resource_type <= 2, "invalid type"
    if resource_type == 1:
        assert cores >= 32, "xl instances require >= 32 cores"

    self._owners[token_id] = msg.sender
    self._balances[msg.sender] += 1

    self.resources[token_id] = Resource(
        staker=msg.sender,
        resource_type=resource_type,
        provider=provider,
        spec=spec,
        cores=cores,
        memory_gb=memory_gb,
        token_budget=token_budget,
        tokens_used=0,
        created_at=block.timestamp,
        expires_at=block.timestamp + (duration_hours * 3600),
        active=True,
    )

    self.staker_resources[msg.sender].append(token_id)

    log Transfer(sender=empty(address), receiver=msg.sender, token_id=token_id)
    log ResourceStaked(
        token_id=token_id,
        staker=msg.sender,
        resource_type=resource_type,
        provider=provider,
        spec=spec,
        cores=cores,
        token_budget=token_budget,
    )

    return token_id

# ── Consume (called by escrow/oracle on bounty resolution) ─────

@external
def consume(token_id: uint256, solver_agent_id: uint256, tokens: uint256):
    """
    @notice Record token consumption against a staked resource.
    @dev Called by the bounty escrow or oracle after successful resolution.
    """
    r: Resource = self.resources[token_id]
    assert r.active, "resource not active"
    assert r.tokens_used + tokens <= r.token_budget, "budget exceeded"
    assert block.timestamp <= r.expires_at, "resource expired"

    self.resources[token_id].tokens_used = r.tokens_used + tokens

    log ResourceConsumed(token_id=token_id, solver_agent_id=solver_agent_id, tokens_used=tokens)

# ── Expire ──────────────────────────────────────────────────────

@external
def expire(token_id: uint256):
    """@notice Mark a resource as expired. Anyone can call after expiry."""
    r: Resource = self.resources[token_id]
    assert block.timestamp > r.expires_at, "not expired yet"
    assert r.active, "already expired"

    self.resources[token_id].active = False
    log ResourceExpired(token_id=token_id)

# ── Views ───────────────────────────────────────────────────────

@external
@view
def get_resource(token_id: uint256) -> (address, uint8, String[32], String[64], uint256, uint256, uint256, uint256, uint256, uint256, bool):
    """@return (staker, type, provider, spec, cores, memory, budget, used, created, expires, active)"""
    r: Resource = self.resources[token_id]
    return (r.staker, r.resource_type, r.provider, r.spec, r.cores, r.memory_gb, r.token_budget, r.tokens_used, r.created_at, r.expires_at, r.active)

@external
@view
def remaining(token_id: uint256) -> uint256:
    """@return tokens remaining on this resource claim"""
    r: Resource = self.resources[token_id]
    if not r.active:
        return 0
    if block.timestamp > r.expires_at:
        return 0
    return r.token_budget - r.tokens_used

@external
@view
def get_staker_resources(staker: address) -> DynArray[uint256, 50]:
    return self.staker_resources[staker]

@external
@view
def resource_count() -> uint256:
    return self.next_id - 1

# ── ERC-721 minimal ────────────────────────────────────────────

@external
@view
def balanceOf(_owner: address) -> uint256:
    return self._balances[_owner]

@external
@view
def ownerOf(token_id: uint256) -> address:
    o: address = self._owners[token_id]
    assert o != empty(address), "nonexistent"
    return o

@external
@view
def supportsInterface(interface_id: bytes4) -> bool:
    return interface_id in [0x01ffc9a7, 0x80ac58cd]
