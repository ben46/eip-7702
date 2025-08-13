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

## 📚 相关资源

- [EIP-7702规范](https://eips.ethereum.org/EIPS/eip-7702)
- [Hardhat文档](https://hardhat.org/docs)
- [ethers.js文档](https://docs.ethers.org/)
- [OpenZeppelin合约](https://docs.openzeppelin.com/contracts/)

## 🤝 贡献

欢迎提交issues和pull requests来改进这个实现！
