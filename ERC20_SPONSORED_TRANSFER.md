# ERC-20 赞助转账示例

这个示例展示了如何使用EIP-7702账户抽象来实现ERC-20代币的赞助转账功能。

## 文件结构

- `src/MockERC20.sol` - 用于测试的ERC-20代币合约
- `test/SponsoredERC20Transfer.t.sol` - 包含各种赞助转账场景的测试用例

## 核心概念

### 赞助转账是什么？

赞助转账允许用户Alice发起ERC-20代币转账，但由另一个用户Bob来支付交易的gas费用。这在以下场景中非常有用：

1. 新用户没有ETH来支付gas费
2. 企业希望为用户支付交易成本
3. 代币持有者想要使用代币而不是ETH支付费用

### 工作原理

1. **委托设置**: Alice使用EIP-7702将她的EOA委托给`BatchCallAndSponsor`合约
2. **签名授权**: Alice签署一个包含转账详细信息的消息
3. **赞助执行**: Bob提交交易，附带Alice的签名，代表Alice执行转账
4. **Gas支付**: Bob支付所有的gas费用

## 测试用例

### 1. `testSponsoredERC20Transfer`
基本的赞助ERC-20转账测试：
- Alice转账100个代币给Charlie
- 交易由Bob发送和赞助
- 验证余额变化正确

### 2. `testSponsoredBatchERC20Transfer`
批量赞助ERC-20转账测试：
- Alice同时转账给3个不同的接收者
- 单个交易中执行多个转账
- Bob赞助整个批量操作

### 3. `testSponsoredMixedTransfer`
混合资产转账测试：
- Alice同时发送ETH和ERC-20代币
- 演示在单个交易中处理多种资产类型
- Bob赞助包含不同调用类型的复杂交易

### 4. `testSponsoredERC20TransferWithInvalidSignature`
安全性测试：
- 使用错误的签名尝试转账
- 验证交易正确失败并回滚

### 5. `testSponsoredERC20TransferWithInsufficientBalance`
余额检查测试：
- 尝试转账超过Alice余额的代币
- 验证交易因余额不足而失败

## 运行测试

```bash
# 运行所有ERC-20赞助转账测试
forge test --match-contract SponsoredERC20TransferTest -vv

# 运行特定测试
forge test --match-test testSponsoredERC20Transfer -vvv

# 运行所有测试（包括原有的测试）
forge test -vv
```

## 关键特性

1. **无Gas用户体验**: 用户可以转账代币而无需持有ETH
2. **安全签名**: 使用ECDSA签名确保只有Alice可以授权她的转账
3. **防重放攻击**: 使用nonce机制防止签名被重复使用
4. **批量操作**: 支持在单个交易中执行多个操作
5. **灵活性**: 支持ETH和ERC-20代币的混合转账

## 实际应用场景

1. **DeFi入门**: 让新用户无需先获得ETH就能开始使用DeFi
2. **企业钱包**: 公司可以为员工的代币转账支付gas费
3. **游戏代币**: 游戏内代币转账可以由游戏公司赞助
4. **社交支付**: 让朋友之间的代币转账更加便利

这个示例展示了EIP-7702如何为Web3用户体验带来革命性的改进。
