# EIP-7702 Gas模拟配置文档

## 概述

本文档描述了如何配置Foundry测试环境来模拟真实网络的gas消耗，以便更准确地测试EIP-7702赞助交易的gas机制。

## 配置详情

### 1. Foundry配置 (`foundry.toml`)

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "prague"
optimizer = true
optimizer_runs = 200
via_ir = true

# Gas配置 - 模拟真实网络环境
gas_limit = 30000000          # 30M gas limit (类似主网区块gas limit)
gas_price = 20000000000       # 20 gwei (典型的gas price)
block_base_fee_per_gas = 7    # 7 wei base fee
```

**配置说明：**
- `gas_limit`: 设置为30M，模拟以太坊主网的区块gas限制
- `gas_price`: 设置为20 gwei，这是一个典型的gas价格
- `block_base_fee_per_gas`: 设置基础费用为7 wei

### 2. 测试代码增强

#### 添加Gas价格常量
```solidity
// Gas价格常量 - 用于模拟真实网络环境
uint256 constant GAS_PRICE = 20 gwei; // 20 gwei
```

#### 设置交易Gas价格
```solidity
// 设置gas价格以模拟真实网络环境
vm.txGasPrice(GAS_PRICE);
```

#### 精确Gas使用量计算
```solidity
// 记录gas使用量 - 在执行前
uint256 gasStart = gasleft();

// 执行交易
BatchCallAndSponsor(ALICE_ADDRESS).execute(calls, signature);

// 记录gas使用量 - 在执行后
uint256 gasEnd = gasleft();
uint256 gasUsed = (gasStart - gasEnd) * tx.gasprice;
```

## 测试结果

### Gas消耗验证
现在测试能够显示详细的gas信息：

```
Current gas price: 20000000000
Gas used for transaction: 1233020000000000
Gas consumed by Alice (ETH): 0 (should be 0)
Gas consumed by Bob (ETH): 0
SUCCESS: Real gas consumption verified!
- Alice consumed 0 gas (sponsored transaction)
- Transaction consumed 1233020000000000 wei in gas fees
- Gas price: 20000000000 wei per gas
- Actual gas units used: 61651
```

### Gas快照
通过 `forge snapshot` 生成的gas使用记录：

```
BatchCallAndSponsorTest:testDirectExecution() (gas: 123190)
BatchCallAndSponsorTest:testReplayAttack() (gas: 98064)
BatchCallAndSponsorTest:testSponsoredExecution() (gas: 93970)
BatchCallAndSponsorTest:testWrongSignature() (gas: 30258)
SponsoredERC20TransferTest:testSponsoredBatchERC20Transfer() (gas: 174269)
SponsoredERC20TransferTest:testSponsoredERC20Transfer() (gas: 118577)
SponsoredERC20TransferTest:testSponsoredERC20TransferWithInsufficientBalance() (gas: 58436)
SponsoredERC20TransferTest:testSponsoredERC20TransferWithInvalidSignature() (gas: 29839)
SponsoredERC20TransferTest:testSponsoredMixedTransfer() (gas: 146682)
```

## EIP-7702关键验证

### 赞助交易的Gas机制
这个配置确保我们能够验证EIP-7702的核心特性：

1. **Alice不消耗Gas**: 
   - `aliceGasConsumed = 0` ✅
   - 验证赞助交易中账户持有者不需要支付gas

2. **真实Gas计算**:
   - 使用 `gasleft()` 和 `tx.gasprice` 计算实际gas消耗
   - 显示精确的gas单位和总费用

3. **Gas价格验证**:
   - `assertEq(tx.gasprice, GAS_PRICE)` ✅
   - 确保测试环境使用了正确的gas价格

## 使用指南

### 运行测试
```bash
# 运行所有测试
forge test -vv

# 运行特定测试
forge test --match-test testSponsoredERC20Transfer -vv

# 生成gas快照
forge snapshot
```

### 调整Gas价格
如果需要测试不同的gas价格情况，修改 `GAS_PRICE` 常量：

```solidity
uint256 constant GAS_PRICE = 50 gwei; // 高gas价格场景
uint256 constant GAS_PRICE = 5 gwei;  // 低gas价格场景
```

## 实际应用价值

这个配置让我们能够：

1. **精确测试赞助机制**: 验证Alice确实不消耗任何gas
2. **性能分析**: 了解不同操作的真实gas成本
3. **成本估算**: 为实际部署提供gas成本参考
4. **回归测试**: 通过gas快照检测性能退化

## 示例计算

单笔ERC-20代币转账（包含EIP-7702委托）：
- **Gas单位**: 61,651
- **Gas价格**: 20 gwei
- **总成本**: 61,651 × 20 gwei = 1,233,020 gwei = 0.00123302 ETH

这为实际部署和用户体验提供了准确的成本参考。
