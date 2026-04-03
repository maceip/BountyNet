# @version ^0.4.0
# @title EIP-8004 Validation Registry
# @notice CI Oracle validation — request/response for agent work verification
# @dev The CI Oracle is a "validator" that attests whether a solver's PR passed tests

# ── Storage ─────────────────────────────────────────────────────

identity_registry: public(address)

struct ValidationRecord:
    validator: address
    agent_id: uint256
    response: uint8          # 0=pending, 1-99=partial, 100=passed
    response_hash: bytes32
    tag: String[64]
    last_update: uint256

validations: public(HashMap[bytes32, ValidationRecord])  # request_hash → record
agent_validations: HashMap[uint256, DynArray[bytes32, 1024]]  # agent_id → request hashes
validator_requests: HashMap[address, DynArray[bytes32, 1024]]  # validator → request hashes

# ── Events ──────────────────────────────────────────────────────

event ValidationRequest:
    validator: indexed(address)
    agent_id: indexed(uint256)
    request_hash: indexed(bytes32)
    request_uri: String[512]

event ValidationResponse:
    validator: indexed(address)
    agent_id: indexed(uint256)
    request_hash: indexed(bytes32)
    response: uint8
    tag: String[64]

# ── Constructor ─────────────────────────────────────────────────

@deploy
def __init__(id_registry: address):
    self.identity_registry = id_registry

# ── Validation Request ──────────────────────────────────────────

@external
def validation_request(
    validator: address,
    agent_id: uint256,
    request_uri: String[512],
    request_hash: bytes32
):
    """
    @notice Agent requests validation of their work.
    @param validator Address of the validator contract/EOA (CI Oracle)
    @param agent_id The solver's EIP-8004 identity NFT ID
    @param request_uri Off-chain URI with validation evidence (PR link, test logs)
    @param request_hash Commitment hash of the request data
    """
    assert self.validations[request_hash].last_update == 0, "exists"

    self.validations[request_hash] = ValidationRecord(
        validator=validator,
        agent_id=agent_id,
        response=0,
        response_hash=empty(bytes32),
        tag="",
        last_update=block.number
    )

    self.agent_validations[agent_id].append(request_hash)
    self.validator_requests[validator].append(request_hash)

    log ValidationRequest(validator=validator, agent_id=agent_id, request_hash=request_hash, request_uri=request_uri)

# ── Validation Response ─────────────────────────────────────────

@external
def validation_response(
    request_hash: bytes32,
    response: uint8,
    response_hash: bytes32,
    tag: String[64]
):
    """
    @notice Validator submits outcome. Only the designated validator can respond.
    @param response 0=failed, 100=passed, 1-99=partial
    """
    record: ValidationRecord = self.validations[request_hash]
    assert record.last_update > 0, "not found"
    assert msg.sender == record.validator, "not validator"
    assert response <= 100, "invalid response"

    self.validations[request_hash].response = response
    self.validations[request_hash].response_hash = response_hash
    self.validations[request_hash].tag = tag
    self.validations[request_hash].last_update = block.number

    log ValidationResponse(validator=msg.sender, agent_id=record.agent_id, request_hash=request_hash, response=response, tag=tag)

# ── Views ───────────────────────────────────────────────────────

@external
@view
def get_status(request_hash: bytes32) -> (address, uint256, uint8, uint256):
    """@return (validator, agent_id, response, last_update)"""
    r: ValidationRecord = self.validations[request_hash]
    return (r.validator, r.agent_id, r.response, r.last_update)

@external
@view
def is_validated(request_hash: bytes32) -> bool:
    """@notice Quick check: did this pass validation (response == 100)?"""
    return self.validations[request_hash].response == 100
