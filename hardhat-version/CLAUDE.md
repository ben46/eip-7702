# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is an EIP-7702 sponsored transaction implementation using Hardhat, demonstrating account abstraction where users can delegate code execution to smart contracts while having transactions sponsored by third parties.

## Architecture Structure

### Core Components
- **BatchCallAndSponsor.sol**: The main contract that handles delegated execution of batched calls with signature verification and nonce-based replay protection
- **MockERC20.sol**: A simple ERC20 token contract for testing sponsored transfers
- **SponsoredERC20Transfer.test.js**: Comprehensive test suite simulating EIP-7702 delegation and sponsored transactions

### Key Architectural Patterns
- **Signature-based Authorization**: Uses ECDSA signature recovery to verify that the original account holder authorized the transaction
- **Nonce-based Replay Protection**: Incremental nonce system prevents replay attacks
- **Batch Call Execution**: Single transaction can execute multiple operations atomically
- **Sponsored Transaction Model**: Third parties can pay gas fees while users maintain control over their operations

## Development Commands

### Build and Compilation
```bash
npm run compile        # Compiles smart contracts using Hardhat
```

### Testing
```bash
npm test              # Runs all tests using Mocha/Chai
npm run test:gas      # Runs tests with detailed gas reporting enabled
```

### Local Development
```bash
npm run node          # Starts local Hardhat network
npm run deploy        # Deploys contracts to configured network
```

## Smart Contract Architecture

### BatchCallAndSponsor Contract
- **Signature Verification**: Recovers signer from ECDSA signature of keccak256(nonce + encodedCalls)
- **Call Structure**: Each call contains (address to, uint256 value, bytes data)
- **Execution Flow**: Validates signature → increments nonce → executes batch → emits events
- **Two Execution Modes**: 
  - Signature-based: Anyone can execute with valid signature
  - Direct: Contract itself can execute without signature

### EIP-7702 Simulation
Since Hardhat doesn't fully support EIP-7702, the implementation uses workarounds:
- Deploys implementation contract and attaches to specific address
- Simulates account delegation through contract interaction patterns
- Maintains same signature verification logic as real EIP-7702

## Testing Framework

### Test Structure
- **Environment Setup**: Creates wallets with predefined private keys for consistent testing
- **Gas Simulation**: Uses 20 gwei gas price to simulate mainnet conditions
- **Multi-scenario Coverage**: Valid transfers, invalid signatures, insufficient balance, batch operations
- **Detailed Logging**: Comprehensive console output for gas analysis and transaction flow

### Key Test Cases
1. **Sponsored ERC20 Transfer**: Alice transfers tokens, Bob pays gas
2. **Invalid Signature Rejection**: Ensures wrong signatures are rejected
3. **Insufficient Balance Handling**: Proper reversion on insufficient funds
4. **Batch Operations**: Multiple calls in single transaction

## Configuration Details

### Hardhat Network Settings
- **EVM Version**: Prague (enables EIP-7702 features)
- **Gas Configuration**: 20 gwei price, 30M gas limit, 7 wei base fee
- **Optimizer**: Enabled with 200 runs for gas efficiency
- **Account Setup**: Predefined private keys for Alice and Bob with specific ETH balances

### Gas Reporting
- Enable with `REPORT_GAS=true` environment variable
- Provides detailed breakdown of gas consumption per contract method
- Useful for optimizing transaction costs in sponsored scenarios

## Development Notes

### Signature Generation Process
1. Encode calls as: `abi.encodePacked(address, uint256, bytes)` for each call
2. Create digest: `keccak256(abi.encodePacked(nonce, encodedCalls))`
3. Sign with Ethereum message prefix using account's private key
4. Submit signature with calls for execution

### Testing Patterns
- Always check both token balances and ETH balances to verify sponsorship
- Use consistent gas price across tests for comparable results
- Verify nonce incrementation to ensure replay protection
- Test both success and failure scenarios comprehensively

## Important Limitations

### EIP-7702 Simulation Constraints
- This is a Hardhat simulation, not true EIP-7702 implementation
- Real EIP-7702 would involve account code delegation at protocol level
- Gas estimation may differ from actual EIP-7702 implementation
- Cross-chain considerations not addressed in this educational example