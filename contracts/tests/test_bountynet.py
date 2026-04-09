"""BountyNet full integration test — EIP-8004 registries + escrow."""
import boa
import pytest
from eth_utils import keccak


@pytest.fixture
def deployer():
    return boa.env.generate_address()


@pytest.fixture
def staker():
    return boa.env.generate_address()


@pytest.fixture
def solver():
    return boa.env.generate_address()


@pytest.fixture
def oracle():
    return boa.env.generate_address()


@pytest.fixture
def treasury():
    return boa.env.generate_address()


@pytest.fixture
def eurc(deployer):
    with boa.env.prank(deployer):
        return boa.load("src/MockEURC.vy")


@pytest.fixture
def identity(deployer):
    with boa.env.prank(deployer):
        return boa.load("src/IdentityRegistry.vy")


@pytest.fixture
def validation(deployer, identity):
    with boa.env.prank(deployer):
        return boa.load("src/ValidationRegistry.vy", identity.address)


@pytest.fixture
def escrow(deployer, identity, validation, eurc, treasury):
    with boa.env.prank(deployer):
        return boa.load(
            "src/BountyEscrow.vy",
            identity.address,
            validation.address,
            eurc.address,
            treasury,
            7000,  # 70% solver
            3000,  # 30% treasury
        )


@pytest.fixture
def funded_staker(staker, eurc, deployer):
    """Give staker 1000 EURC."""
    with boa.env.prank(deployer):
        eurc.mint(staker, 1000 * 10**6)
    return staker


@pytest.fixture
def registered_solver(solver, identity):
    """Register solver as EIP-8004 agent, returns agent_id."""
    with boa.env.prank(solver):
        agent_id = identity.register("ipfs://solver-agent-registration.json")
    return agent_id


# ── Identity Registry Tests ─────────────────────────────────────

def test_register_agent(identity, solver):
    with boa.env.prank(solver):
        agent_id = identity.register("ipfs://my-agent.json")
    assert agent_id == 1
    assert identity.ownerOf(agent_id) == solver
    assert identity.agent_uri(agent_id) == "ipfs://my-agent.json"
    assert identity.balanceOf(solver) == 1


def test_set_agent_wallet(identity, solver, treasury):
    with boa.env.prank(solver):
        agent_id = identity.register("")
        identity.set_agent_wallet(agent_id, treasury)
    assert identity.get_agent_wallet(agent_id) == treasury


def test_agent_wallet_defaults_to_owner(identity, solver):
    with boa.env.prank(solver):
        agent_id = identity.register("")
    assert identity.get_agent_wallet(agent_id) == solver


def test_set_metadata(identity, solver):
    with boa.env.prank(solver):
        agent_id = identity.register("")
        identity.set_metadata(agent_id, "language", b"\x00" * 31 + b"\x01")
    assert identity.get_metadata(agent_id, "language") == b"\x00" * 31 + b"\x01"


# ── Validation Registry Tests ───────────────────────────────────

def test_validation_flow(validation, oracle, solver, identity):
    with boa.env.prank(solver):
        agent_id = identity.register("")

    req_hash = keccak(b"test-validation-request")

    # Solver requests validation
    with boa.env.prank(solver):
        validation.validation_request(oracle, agent_id, "https://ci.example.com/logs", req_hash)

    status = validation.get_status(req_hash)
    assert status[0] == oracle       # validator
    assert status[1] == agent_id     # agent_id
    assert status[2] == 0            # pending

    # Oracle responds: PASS
    with boa.env.prank(oracle):
        validation.validation_response(req_hash, 100, keccak(b"proof"), "ci-green")

    assert validation.is_validated(req_hash)
    status2 = validation.get_status(req_hash)
    assert status2[2] == 100


def test_only_validator_can_respond(validation, oracle, solver, identity):
    with boa.env.prank(solver):
        agent_id = identity.register("")
    req_hash = keccak(b"test2")
    with boa.env.prank(solver):
        validation.validation_request(oracle, agent_id, "", req_hash)
    # Solver tries to respond (should fail)
    with boa.env.prank(solver):
        with boa.reverts("not validator"):
            validation.validation_response(req_hash, 100, keccak(b"fake"), "")


# ── Escrow Tests ────────────────────────────────────────────────

FIVE_EURC = 5 * 10**6
CONTEXT_HASH = keccak(b"example/app:main:abc123:build:error")


def test_create_bounty(escrow, eurc, funded_staker):
    with boa.env.prank(funded_staker):
        eurc.approve(escrow.address, FIVE_EURC)
        escrow.create_bounty(CONTEXT_HASH, FIVE_EURC, 1000, "ipfs://context-payload")

    b = escrow.get_bounty(CONTEXT_HASH)
    assert b[0] == funded_staker   # creator
    assert b[1] == FIVE_EURC       # amount
    assert b[3] == 0               # no solver yet
    assert b[4] is False           # not resolved
    assert escrow.is_claimable(CONTEXT_HASH)


def test_claim_and_resolve(escrow, eurc, identity, validation, funded_staker, solver, oracle, treasury):
    # Setup: create bounty
    with boa.env.prank(funded_staker):
        eurc.approve(escrow.address, FIVE_EURC)
        escrow.create_bounty(CONTEXT_HASH, FIVE_EURC, 1000, "ipfs://ctx")

    # Solver registers identity
    with boa.env.prank(solver):
        agent_id = identity.register("ipfs://solver.json")

    # Solver claims bounty
    with boa.env.prank(solver):
        escrow.claim_intent(CONTEXT_HASH, agent_id)

    assert not escrow.is_claimable(CONTEXT_HASH)
    b = escrow.get_bounty(CONTEXT_HASH)
    assert b[3] == agent_id

    # Solver submits validation request
    val_hash = keccak(b"ci-proof-for-this-bounty")
    with boa.env.prank(solver):
        validation.validation_request(oracle, agent_id, "https://github.com/pr/123", val_hash)

    # Oracle validates (CI green)
    with boa.env.prank(oracle):
        validation.validation_response(val_hash, 100, keccak(b"green"), "ci-pass")

    # Anyone resolves the bounty (permissionless — proof is on-chain)
    escrow.resolve_bounty(CONTEXT_HASH, val_hash)

    # Check payouts: 70% to solver, 30% to treasury
    assert eurc.balanceOf(solver) == FIVE_EURC * 7000 // 10000     # 3.5 EURC
    assert eurc.balanceOf(treasury) == FIVE_EURC * 3000 // 10000   # 1.5 EURC

    b2 = escrow.get_bounty(CONTEXT_HASH)
    assert b2[4] is True  # resolved


def test_cancel_expired_bounty(escrow, eurc, funded_staker):
    with boa.env.prank(funded_staker):
        eurc.approve(escrow.address, FIVE_EURC)
        escrow.create_bounty(CONTEXT_HASH, FIVE_EURC, 10, "")  # 10 block deadline

    # Can't cancel before deadline
    with boa.reverts("not expired"):
        escrow.cancel_bounty(CONTEXT_HASH)

    # Fast-forward past deadline
    boa.env.evm.patch.block_number += 11

    escrow.cancel_bounty(CONTEXT_HASH)
    assert eurc.balanceOf(funded_staker) == 1000 * 10**6  # full refund


def test_escalate_bounty(escrow, eurc, funded_staker, deployer):
    with boa.env.prank(funded_staker):
        eurc.approve(escrow.address, FIVE_EURC)
        escrow.create_bounty(CONTEXT_HASH, FIVE_EURC, 1000, "")

    # Someone else tops it up
    with boa.env.prank(deployer):
        eurc.mint(deployer, 3 * 10**6)
        eurc.approve(escrow.address, 3 * 10**6)
        escrow.escalate_bounty(CONTEXT_HASH, 3 * 10**6)

    b = escrow.get_bounty(CONTEXT_HASH)
    assert b[1] == 8 * 10**6  # 5 + 3


def test_cannot_resolve_without_validation(escrow, eurc, identity, funded_staker, solver):
    with boa.env.prank(funded_staker):
        eurc.approve(escrow.address, FIVE_EURC)
        escrow.create_bounty(CONTEXT_HASH, FIVE_EURC, 1000, "")

    with boa.env.prank(solver):
        agent_id = identity.register("")
        escrow.claim_intent(CONTEXT_HASH, agent_id)

    fake_hash = keccak(b"fake-validation")
    with boa.reverts("not validated"):
        escrow.resolve_bounty(CONTEXT_HASH, fake_hash)
