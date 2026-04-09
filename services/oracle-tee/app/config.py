"""BountyNet CI Oracle TEE extension configuration."""

VERSION = "0.1.0"

# OPType: CI oracle operations
OP_TYPE_ORACLE = "ORACLE"

# OPCommands
OP_COMMAND_VALIDATE = "VALIDATE"   # Sign a CI proof (build passed)
OP_COMMAND_ATTEST = "ATTEST"       # Sign a GitHub OIDC attestation
