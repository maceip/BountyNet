# @version ^0.4.0
# @title EIP-8004 Identity Registry
# @notice ERC-721 agent identity with metadata and agent wallet
# @dev Simplified for hackathon — core register/metadata/wallet interface

# Implements ERC-721 (not using `implements:` to avoid strict param name matching)

# ── Storage ─────────────────────────────────────────────────────

owner: public(address)
next_id: public(uint256)

# ERC-721 core
_owners: HashMap[uint256, address]
_balances: HashMap[address, uint256]
_approvals: HashMap[uint256, address]
_operator_approvals: HashMap[address, HashMap[address, bool]]

# EIP-8004 extensions
agent_uri: public(HashMap[uint256, String[512]])
metadata: HashMap[uint256, HashMap[String[64], bytes32]]
agent_wallet: public(HashMap[uint256, address])

# ── Events ──────────────────────────────────────────────────────

event Transfer:
    sender: indexed(address)
    receiver: indexed(address)
    token_id: indexed(uint256)

event Approval:
    owner: indexed(address)
    approved: indexed(address)
    token_id: indexed(uint256)

event ApprovalForAll:
    owner: indexed(address)
    operator: indexed(address)
    approved: bool

event Registered:
    agent_id: indexed(uint256)
    agent_uri: String[512]
    owner: indexed(address)

event URIUpdated:
    agent_id: indexed(uint256)
    new_uri: String[512]

event MetadataSet:
    agent_id: indexed(uint256)
    key: String[64]
    data: bytes32

event AgentWalletSet:
    agent_id: indexed(uint256)
    wallet: address

# ── Constructor ─────────────────────────────────────────────────

@deploy
def __init__():
    self.owner = msg.sender
    self.next_id = 1

# ── EIP-8004: Register ──────────────────────────────────────────

@external
def register(uri: String[512]) -> uint256:
    """
    @notice Register a new agent identity. Mints an ERC-721 NFT.
    @param uri Agent registration JSON URI (capabilities, services, pricing)
    @return agent_id The minted token ID
    """
    agent_id: uint256 = self.next_id
    self.next_id = agent_id + 1

    # Mint
    self._owners[agent_id] = msg.sender
    self._balances[msg.sender] += 1
    self.agent_uri[agent_id] = uri

    log Transfer(sender=empty(address), receiver=msg.sender, token_id=agent_id)
    log Registered(agent_id=agent_id, agent_uri=uri, owner=msg.sender)
    return agent_id

@external
def set_agent_uri(agent_id: uint256, new_uri: String[512]):
    """@notice Update agent registration URI. Owner only."""
    assert self._owners[agent_id] == msg.sender, "not owner"
    self.agent_uri[agent_id] = new_uri
    log URIUpdated(agent_id=agent_id, new_uri=new_uri)

# ── EIP-8004: Metadata ──────────────────────────────────────────

@external
def set_metadata(agent_id: uint256, key: String[64], val: bytes32):
    """@notice Set arbitrary metadata on an agent identity."""
    assert self._owners[agent_id] == msg.sender, "not owner"
    self.metadata[agent_id][key] = val
    log MetadataSet(agent_id=agent_id, key=key, data=val)

@external
@view
def get_metadata(agent_id: uint256, key: String[64]) -> bytes32:
    return self.metadata[agent_id][key]

# ── EIP-8004: Agent Wallet ───────────────────────────────────────

@external
def set_agent_wallet(agent_id: uint256, wallet: address):
    """@notice Set payment address for this agent. Owner only."""
    assert self._owners[agent_id] == msg.sender, "not owner"
    self.agent_wallet[agent_id] = wallet
    log AgentWalletSet(agent_id=agent_id, wallet=wallet)

@external
@view
def get_agent_wallet(agent_id: uint256) -> address:
    """@notice Returns agent wallet, or owner address if not set."""
    w: address = self.agent_wallet[agent_id]
    if w == empty(address):
        return self._owners[agent_id]
    return w

# ── ERC-721 Implementation ──────────────────────────────────────

@external
@view
def balanceOf(_owner: address) -> uint256:
    return self._balances[_owner]

@external
@view
def ownerOf(token_id: uint256) -> address:
    owner: address = self._owners[token_id]
    assert owner != empty(address), "nonexistent"
    return owner

@external
@view
def getApproved(token_id: uint256) -> address:
    return self._approvals[token_id]

@external
@view
def isApprovedForAll(_owner: address, operator: address) -> bool:
    return self._operator_approvals[_owner][operator]

@external
def approve(to: address, token_id: uint256):
    token_owner: address = self._owners[token_id]
    assert msg.sender == token_owner or self._operator_approvals[token_owner][msg.sender], "not authorized"
    self._approvals[token_id] = to
    log Approval(owner=token_owner, approved=to, token_id=token_id)

@external
def setApprovalForAll(operator: address, approved: bool):
    self._operator_approvals[msg.sender][operator] = approved
    log ApprovalForAll(owner=msg.sender, operator=operator, approved=approved)

@external
def transferFrom(_from: address, _to: address, token_id: uint256):
    assert self._is_approved_or_owner(msg.sender, token_id), "not authorized"
    self._transfer(_from, _to, token_id)

@external
def safeTransferFrom(_from: address, _to: address, token_id: uint256, data: Bytes[1024] = b""):
    assert self._is_approved_or_owner(msg.sender, token_id), "not authorized"
    self._transfer(_from, _to, token_id)

@internal
def _transfer(_from: address, _to: address, token_id: uint256):
    assert self._owners[token_id] == _from, "wrong owner"
    assert _to != empty(address), "zero address"
    self._approvals[token_id] = empty(address)
    self._balances[_from] -= 1
    self._balances[_to] += 1
    self._owners[token_id] = _to
    log Transfer(sender=_from, receiver=_to, token_id=token_id)

@internal
@view
def _is_approved_or_owner(spender: address, token_id: uint256) -> bool:
    token_owner: address = self._owners[token_id]
    return spender == token_owner or self._approvals[token_id] == spender or self._operator_approvals[token_owner][spender]

@external
@view
def supportsInterface(interface_id: bytes4) -> bool:
    # ERC-165 + ERC-721
    return interface_id in [
        0x01ffc9a7,  # ERC-165
        0x80ac58cd,  # ERC-721
    ]

@external
@view
def tokenURI(token_id: uint256) -> String[512]:
    return self.agent_uri[token_id]
