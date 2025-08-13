require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26", // 使用更新的编译器版本
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun", // Use a stable EVM version for testing
      viaIR: true
    },
  },
  networks: {
    hardhat: {
      hardfork: "prague", // 确保网络也支持EIP-7702

      gasPrice: 20000000000, // 20 gwei
      blockGasLimit: 30000000, // 30M gas
      initialBaseFeePerGas: 7, // 7 wei
      accounts: [
        {
          privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
          balance: "100000000000000000000" // 100 ETH for Alice
        },
        {
          privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
          balance: "100000000000000000000"  // 100 ETH for Bob
        }
      ],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    gasPrice: 20, // gwei
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
