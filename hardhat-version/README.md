# EIP-7702 赞助交易 - Hardhat版本

这是EIP-7702赞助交易功能的Hardhat测试实现，从Foundry版本转换而来。

## 📁 项目结构

```
hardhat-version/
├── contracts/                 # 智能合约
│   ├── BatchCallAndSponsor.sol
│   └── MockERC20.sol
├── test/                      # 测试文件
│   └── SponsoredERC20Transfer.test.js
├── hardhat.config.js          # Hardhat配置
├── package.json               # 依赖管理
└── README.md                  # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd hardhat-version
npm install
```

### 2. 编译合约

```bash
npm run compile
```

### 3. 运行测试

```bash
# 运行基础测试
npm test

# 运行带gas报告的测试
npm run test:gas
```

## 🎯 主要特性

### Gas配置
- **Gas价格**: 20 gwei (模拟真实网络)
- **区块Gas限制**: 30M gas
- **基础费用**: 7 wei

### 账户配置
- **Alice**: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (10 ETH)
- **Bob**: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (5 ETH)
- **Charlie**: 动态生成的测试地址

## 📊 测试用例

### 1. 基础赞助转账测试
- Alice转账100个代币给Charlie
- 交易由Bob赞助和发送
- 验证gas消耗机制

### 2. 无效签名测试
- 使用错误的签名进行转账
- 验证交易正确回滚

### 3. 余额不足测试
- 尝试转账超过余额的代币
- 验证交易正确失败

## 🔧 配置说明

### Hardhat配置 (`hardhat.config.js`)

```javascript
module.exports = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "prague", // 支持EIP-7702
      viaIR: true
    },
  },
  networks: {
    hardhat: {
      gasPrice: 20000000000, // 20 gwei
      blockGasLimit: 30000000, // 30M gas
      initialBaseFeePerGas: 7, // 7 wei
    },
  }
};
```

## ⚠️ 重要说明

### EIP-7702模拟限制
由于Hardhat目前还不完全支持EIP-7702，这个实现使用了一些workaround来模拟委托功能：

1. **委托模拟**: 通过部署合约到特定地址来模拟账户代码委托
2. **Gas消耗**: 模拟了赞助交易的gas机制
3. **签名验证**: 实现了与EIP-7702相同的签名验证逻辑

### 与Foundry版本的差异
- **测试框架**: 使用Mocha/Chai而不是Forge
- **Gas跟踪**: 使用ethers.js的gas估算和跟踪
- **账户管理**: 使用Hardhat的账户系统

## 📈 示例输出

```
=== 测试赞助的ERC-20转账 ===
Alice转账100个代币给Charlie，交易由Bob赞助和发送

转账前余额:
Alice代币: 1000.0
Charlie代币: 0.0
Alice ETH (gas): 11.0
Bob ETH (gas): 4.998...

签名信息:
当前nonce: 0
摘要: 0x...
签名: 0x...

交易哈希: 0x...
实际gas使用量: 61651
Gas价格: 20.0 gwei
总gas费用: 0.00123302 ETH

转账后余额:
Alice代币: 900.0
Charlie代币: 100.0

✅ 赞助ERC-20转账测试通过!
```

## 🔍 Gas分析

通过 `npm run test:gas` 可以获得详细的gas使用报告：

```
·-----------------------------------------|---------------------------|-------------|-----------------------------·
|           Solc version: 0.8.25         ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 30000000 gas │
··········································|···························|·············|······························
|  Methods                                                                                                         │
·························|················|·············|·············|·············|···············|··············
|  Contract              ·  Method        ·  Min        ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
·························|················|·············|·············|·············|···············|··············
|  BatchCallAndSponsor   ·  execute       ·      61651  ·      85432  ·      73541  ·            4  ·          -  │
·························|················|·············|·············|·············|···············|··············
```

## 🛠️ 扩展功能

### 添加新测试
在 `test/` 目录下创建新的测试文件：

```javascript
describe("新功能测试", function () {
  it("应该...", async function () {
    // 测试逻辑
  });
});
```

### 修改Gas配置
在 `hardhat.config.js` 中调整gas参数：

```javascript
networks: {
  hardhat: {
    gasPrice: 50000000000, // 50 gwei - 高gas价格场景
    blockGasLimit: 15000000, // 15M gas - 较小的区块
  }
}
```

## 链上交互

### 转账运行
```angular2html
 ts-node scripts/1-7702-mint-transfer.js 
(node:93249) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/mark/Dev/self/eip-7702/hardhat-version/scripts/1-7702-mint-transfer.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/mark/Dev/self/eip-7702/hardhat-version/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
🚀 Alice EIP-7702 助手 - BSC主网
💡 核心特性: Alice地址变成智能账户，一笔交易完成mint+transfer
⛽ Gas价格: 0.11 gwei (提升版)
✨ 简化版: 无需permit/approve，直接mint+transfer
🔄 智能处理: 自动解决EIP-7702授权冲突
🔁 完整流程: 取消冲突授权→重新授权→执行业务→取消授权

👥 参与者:
Alice: 0x28984635f3adaf50C9cAD16bb3e444ceECC57dEA
Relayer: 0x8E4F1a52C38A9A26Fa78e5Eb5127c098cFc3e2db
BatchContract: 0x01CFCFd8FB0C4BF9abB4Fd8a449DdF48c94e86D4

📊 初始状态:
Alice代币: 0
Relayer代币: 1002000
Alice BNB: 0
Alice代码长度: 0
Alice代码: 0x
Batch代码长度: 3936
期望的EIP-7702代码: 0xef010001cfcfd8fb0c4bf9abb4fd8a449ddf48c94e86d4
Alice实际代码: 0x
代码匹配: false
Alice是智能账户: undefined

🔐 步骤1: Alice首次EIP-7702授权

🔐 步骤1.3: Alice签名新的EIP-7702授权 (离线)
✅ Alice已签名EIP-7702授权
   目标合约地址: 0x01CFCFd8FB0C4BF9abB4Fd8a449DdF48c94e86D4

✅ 跳过ERC20 Permit步骤 (智能账户直接transfer，无需授权)

🔨 步骤2: 构建批量调用
✅ 批量调用已构建 (2个操作):
   1. Mint 1000 代币给Alice
   2. Transfer 500代币给Relayer (无需授权，直接转账)

⏳ 步骤3: 准备批量操作签名 (稍后进行)

📤 步骤4: Relayer发送EIP-7702授权交易
💡 这将使Alice地址变成BatchCallAndSponsor智能账户
✅ EIP-7702授权交易已发送: 0x51dbbce2e4362565d04244c4ce85c594ac37985468948ffda3ad7c26892e3008
✅ Alice地址现在是BatchCallAndSponsor智能账户!

✍️ 步骤5: Alice签名批量操作 (现在Alice是正确的智能账户)
   使用初始nonce: 0 (新的EIP-7702智能账户)
✅ Alice已签名批量操作 (使用正确的nonce)

⚡ 步骤6: Relayer执行批量操作
💫 一笔交易完成: mint 1000 + transfer 500
finalAliceCode: 0xef010001cfcfd8fb0c4bf9abb4fd8a449ddf48c94e86d4
✅ 批量操作已发送: 0x91b0375c64bd765a4e7d8dee1c042c3be949f7fe769b0083cfe2166ddfc03865
🎉 批量操作完成! Gas使用: 110172

📊 最终结果:
Alice代币: 500
Relayer代币: 1002500

🎯 变化:
Alice净获得: 500 代币
Relayer获得: 500 代币

🎉🎉🎉 成功! EIP-7702演示完成!
✨ Alice获得500代币，Relayer获得500代币
✨ Alice全程只签名，无需发送交易
✨ 一笔交易完成mint+transfer

🔍 查看交易: https://bscscan.com/tx/0x91b0375c64bd765a4e7d8dee1c042c3be949f7fe769b0083cfe2166ddfc03865

🔄 步骤7: 可选的取消授权 (将Alice恢复为普通EOA)
💡 这样Alice地址可以被重新用于其他EIP-7702授权

🚫 步骤7.1: Alice签名取消授权 (离线)
✅ Alice已签名取消授权

📤 步骤7.2: Relayer发送取消授权交易
✅ 最终取消授权交易已发送: 0xd2be58649292841e607a3f4cc84d88de11507235e07ea2dd0628cacf0b56aef0

📊 最终授权状态:
Alice代码: 0x
Alice是普通EOA: true
✅ Alice已成功恢复为普通EOA，可用于下次EIP-7702授权

🔍 查看取消授权交易: https://bscscan.com/tx/0xd2be58649292841e607a3f4cc84d88de11507235e07ea2dd0628cacf0b56aef0

```

## 📚 相关资源

- [EIP-7702规范](https://eips.ethereum.org/EIPS/eip-7702)
- [Hardhat文档](https://hardhat.org/docs)
- [ethers.js文档](https://docs.ethers.org/)
- [OpenZeppelin合约](https://docs.openzeppelin.com/contracts/)

## 🤝 贡献

欢迎提交issues和pull requests来改进这个实现！
