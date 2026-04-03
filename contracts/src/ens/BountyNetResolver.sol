// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title BountyNetResolver — CCIP-Read (EIP-3668) + Wildcard (ENSIP-10) resolver
 * @notice Resolves *.maceip.eth subdomains via off-chain gateway backed by
 *         the EIP-8004 Identity Registry on Arc Testnet.
 * @dev Deploy on mainnet/Sepolia. Set as resolver for maceip.eth.
 *      Gateway URL points to ens-gateway.stare.network.
 */

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}

contract BountyNetResolver is IExtendedResolver {
    /// @dev EIP-3668 OffchainLookup error — triggers CCIP-read in the client
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    address public owner;
    address public signer;    // Gateway's signing key — verifies responses
    string[] public gatewayUrls;

    event SignerUpdated(address indexed newSigner);
    event GatewayUrlUpdated(string url);

    constructor(address _signer, string memory _gatewayUrl) {
        owner = msg.sender;
        signer = _signer;
        gatewayUrls.push(_gatewayUrl);
    }

    /// @notice ENSIP-10 wildcard resolve — triggers CCIP-read for any subdomain
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        override
        returns (bytes memory)
    {
        revert OffchainLookup(
            address(this),
            gatewayUrls,
            data,                              // original ENS query (addr, text, etc.)
            this.resolveWithProof.selector,     // callback
            abi.encode(name, data)              // extra data passed through
        );
    }

    /// @notice Callback after gateway returns — verify signature and return result
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        // response = abi.encode(result, expiry, signature)
        (bytes memory result, uint64 expiry, bytes memory sig) = abi.decode(
            response,
            (bytes, uint64, bytes)
        );

        // Check expiry
        require(block.timestamp <= expiry, "Response expired");

        // Verify gateway signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(result, expiry, extraData))
            )
        );

        address recovered = _recover(messageHash, sig);
        require(recovered == signer, "Invalid signature");

        return result;
    }

    // ── Admin ──────────────────────────────────────────────────────

    function setSigner(address _signer) external {
        require(msg.sender == owner, "not owner");
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    function setGatewayUrl(string calldata _url) external {
        require(msg.sender == owner, "not owner");
        if (gatewayUrls.length == 0) gatewayUrls.push(_url);
        else gatewayUrls[0] = _url;
        emit GatewayUrlUpdated(_url);
    }

    // ── ERC-165 ────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x9061b923  // IExtendedResolver (ENSIP-10 wildcard)
            || interfaceId == 0x01ffc9a7; // ERC-165
    }

    // ── Internal ───────────────────────────────────────────────────

    function _recover(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return ecrecover(hash, v, r, s);
    }
}
