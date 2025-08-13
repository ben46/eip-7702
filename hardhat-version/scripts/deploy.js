const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 开始部署EIP-7702赞助交易合约...\n");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);
  console.log("部署者余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // 部署BatchCallAndSponsor合约
  console.log("\n📋 部署BatchCallAndSponsor合约...");
  const BatchCallAndSponsor = await ethers.getContractFactory("BatchCallAndSponsor");
  const batchCallAndSponsor = await BatchCallAndSponsor.deploy();
  await batchCallAndSponsor.waitForDeployment();

  const batchAddress = await batchCallAndSponsor.getAddress();
  console.log("✅ BatchCallAndSponsor部署成功:", batchAddress);

  // 部署MockERC20代币合约
  console.log("\n🪙 部署MockERC20代币合约...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy("Test Token", "TEST");
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("✅ MockERC20部署成功:", tokenAddress);

  // 验证合约部署
  console.log("\n🔍 验证合约部署...");
  const tokenName = await token.name();
  const tokenSymbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  const batchNonce = await batchCallAndSponsor.nonce();

  console.log("代币名称:", tokenName);
  console.log("代币符号:", tokenSymbol);
  console.log("初始供应量:", ethers.formatEther(totalSupply));
  console.log("BatchCall初始nonce:", batchNonce.toString());

  // 输出部署总结
  console.log("\n📊 部署总结:");
  console.log("================================");
  console.log("BatchCallAndSponsor:", batchAddress);
  console.log("MockERC20:", tokenAddress);
  console.log("网络:", (await ethers.provider.getNetwork()).name);
  console.log("区块号:", await ethers.provider.getBlockNumber());
  console.log("================================");

  // 保存部署地址到文件
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    contracts: {
      BatchCallAndSponsor: batchAddress,
      MockERC20: tokenAddress
    },
    deployer: deployer.address
  };

  // 注意：在实际项目中，您可能想要将这些地址保存到JSON文件
  console.log("\n💾 部署信息:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 部署完成!");
  console.log("现在可以运行测试: npm test");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });
