const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title SponsoredERC20TransferTest
 * @notice 测试ERC-20赞助转账功能，其中Alice进行代币转账，但交易由Bob赞助和发送
 * 
 * This test simulates EIP-7702 functionality in Hardhat by:
 * 1. Deploying the BatchCallAndSponsor contract as an implementation
 * 2. Deploying the implementation contract at Alice's address to simulate delegation
 * 3. Creating signatures for Alice's operations that Bob can execute
 * 4. Verifying that Alice pays no gas while Bob sponsors the transaction
 */
describe("SponsoredERC20Transfer", function () {
    // Alice的地址和私钥（EOA，初始没有合约代码）
    const ALICE_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const ALICE_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

    // Bob的地址和私钥（Bob将代表Alice执行交易）
    const BOB_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const BOB_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

    // Charlie的地址（代币接收者）
    const CHARLIE_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    
    // Gas价格常量 - 用于模拟真实网络环境
    const GAS_PRICE = ethers.parseUnits("20", "gwei"); // 20 gwei

    let implementation;
    let token;
    let alice, bob, charlie, deployer;
    let aliceContract; // Alice's address with delegated contract code

    beforeEach(async function () {
        // Get signers
        [deployer, alice, bob, charlie] = await ethers.getSigners();
        
        // Set specific addresses for testing (this simulates the exact addresses from Foundry)
        alice = await ethers.getImpersonatedSigner(ALICE_ADDRESS);
        bob = await ethers.getImpersonatedSigner(BOB_ADDRESS);
        charlie = await ethers.getImpersonatedSigner(CHARLIE_ADDRESS);

        // Fund the accounts with ETH
        await deployer.sendTransaction({
            to: ALICE_ADDRESS,
            value: ethers.parseEther("10")
        });
        await deployer.sendTransaction({
            to: BOB_ADDRESS,
            value: ethers.parseEther("5")
        });

        // Deploy the BatchCallAndSponsor implementation contract
        const BatchCallAndSponsor = await ethers.getContractFactory("BatchCallAndSponsor");
        implementation = await BatchCallAndSponsor.deploy();

        // Deploy ERC20 token contract
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        token = await MockERC20.deploy("Test Token", "TEST");

        // Mint tokens to Alice
        await token.mint(ALICE_ADDRESS, ethers.parseEther("1000"));

        // Simulate EIP-7702 by deploying implementation at Alice's address
        // In real EIP-7702, this would be done through delegation, but for testing we deploy directly
        const bytecode = await ethers.provider.getCode(await implementation.getAddress());
        await ethers.provider.send("hardhat_setCode", [
            ALICE_ADDRESS,
            bytecode
        ]);

        // Create contract instance at Alice's address
        aliceContract = BatchCallAndSponsor.attach(ALICE_ADDRESS);

        console.log("Setup completed:");
        console.log("Alice ETH balance:", ethers.formatEther(await ethers.provider.getBalance(ALICE_ADDRESS)));
        console.log("Bob ETH balance:", ethers.formatEther(await ethers.provider.getBalance(BOB_ADDRESS)));
        console.log("Alice token balance:", ethers.formatEther(await token.balanceOf(ALICE_ADDRESS)));
        console.log("Charlie token balance:", ethers.formatEther(await token.balanceOf(CHARLIE_ADDRESS)));
    });

    /**
     * @notice 测试赞助的ERC-20转账
     * Alice想要转账100个代币给Charlie，但交易由Bob赞助和发送
     */
    it("should execute sponsored ERC20 transfer", async function () {
        console.log("\n=== Testing Sponsored ERC-20 Transfer ===");
        console.log("Alice transfers 100 tokens to Charlie, transaction sponsored by Bob");

        const transferAmount = ethers.parseEther("100");
        
        // 记录转账前的余额
        const aliceBalanceBefore = await token.balanceOf(ALICE_ADDRESS);
        const charlieBalanceBefore = await token.balanceOf(CHARLIE_ADDRESS);
        
        // 记录gas余额
        const aliceGasBalanceBefore = await ethers.provider.getBalance(ALICE_ADDRESS);
        const bobGasBalanceBefore = await ethers.provider.getBalance(BOB_ADDRESS);
        
        console.log("Balances before transfer:");
        console.log("Alice tokens:", ethers.formatEther(aliceBalanceBefore));
        console.log("Charlie tokens:", ethers.formatEther(charlieBalanceBefore));
        console.log("Alice ETH (gas):", ethers.formatEther(aliceGasBalanceBefore));
        console.log("Bob ETH (gas):", ethers.formatEther(bobGasBalanceBefore));

        // 创建调用数组 - ERC20转账
        const calls = [{
            to: await token.getAddress(),
            value: 0,
            data: token.interface.encodeFunctionData("transfer", [CHARLIE_ADDRESS, transferAmount])
        }];

        // 构建编码的调用数据用于签名
        let encodedCalls = "0x";
        for (const call of calls) {
            const encodedCall = ethers.solidityPacked(
                ["address", "uint256", "bytes"],
                [call.to, call.value, call.data]
            );
            encodedCalls += encodedCall.slice(2); // Remove 0x prefix
        }

        // 获取当前nonce并创建摘要
        const currentNonce = await aliceContract.nonce();
        const digest = ethers.keccak256(ethers.solidityPacked(
            ["uint256", "bytes"],
            [currentNonce, encodedCalls]
        ));

        // Alice用她的私钥签署摘要（使用Ethereum message prefix）
        const aliceWallet = new ethers.Wallet(ALICE_PK);
        const ethSignedMessageHash = ethers.hashMessage(ethers.getBytes(digest));
        const signature = await aliceWallet.signMessage(ethers.getBytes(digest));

        // 验证签名恢复
        const recovered = ethers.verifyMessage(ethers.getBytes(digest), signature);
        expect(recovered).to.equal(ALICE_ADDRESS, "Signature recovery should match Alice's address");

        // Bob通过Alice的委托合约执行交易
        const tx = await aliceContract.connect(bob).execute(calls, signature, {
            gasPrice: GAS_PRICE
        });
        const receipt = await tx.wait();

        // 验证转账成功
        const aliceBalanceAfter = await token.balanceOf(ALICE_ADDRESS);
        const charlieBalanceAfter = await token.balanceOf(CHARLIE_ADDRESS);
        
        // 记录gas余额变化
        const aliceGasBalanceAfter = await ethers.provider.getBalance(ALICE_ADDRESS);
        const bobGasBalanceAfter = await ethers.provider.getBalance(BOB_ADDRESS);
        
        console.log("Balances after transfer:");
        console.log("Alice tokens:", ethers.formatEther(aliceBalanceAfter));
        console.log("Charlie tokens:", ethers.formatEther(charlieBalanceAfter));
        console.log("Alice ETH (gas):", ethers.formatEther(aliceGasBalanceAfter));
        console.log("Bob ETH (gas):", ethers.formatEther(bobGasBalanceAfter));

        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore - transferAmount, "Alice balance should decrease");
        expect(charlieBalanceAfter).to.equal(charlieBalanceBefore + transferAmount, "Charlie balance should increase");

        // 验证gas消耗：Alice的gas应该不变
        expect(aliceGasBalanceAfter).to.equal(aliceGasBalanceBefore, "Alice should not consume any gas (sponsored transaction)");
        
        // 计算实际的gas消耗
        const aliceGasConsumed = aliceGasBalanceBefore - aliceGasBalanceAfter;
        const bobGasConsumed = bobGasBalanceBefore - bobGasBalanceAfter;
        const actualGasUsed = receipt.gasUsed * receipt.gasPrice;
        
        console.log("Gas price:", ethers.formatUnits(GAS_PRICE, "gwei"), "gwei");
        console.log("Gas used for transaction:", actualGasUsed.toString(), "wei");
        console.log("Gas consumed by Alice (ETH):", ethers.formatEther(aliceGasConsumed), "(should be 0)");
        console.log("Gas consumed by Bob (ETH):", ethers.formatEther(bobGasConsumed));
        
        // 验证Alice没有消耗任何gas
        expect(aliceGasConsumed).to.equal(0n, "Alice should not consume any gas in sponsored transaction");
        
        // 验证计算出的gas使用量大于0 - 这证明交易确实消耗了gas
        expect(actualGasUsed).to.be.gt(0, "Transaction should consume gas");
        
        console.log("SUCCESS: Real gas consumption verified!");
        console.log("- Alice consumed 0 gas (sponsored transaction)");
        console.log("- Transaction consumed", actualGasUsed.toString(), "wei in gas fees");
        console.log("- Gas price:", ethers.formatUnits(GAS_PRICE, "gwei"), "gwei");
        console.log("- Actual gas units used:", receipt.gasUsed.toString());
        
        console.log("SUCCESS: Sponsored ERC-20 transfer test passed!");
    });

    /**
     * @notice 测试批量赞助的ERC-20转账
     * Alice想要同时转账给多个接收者，交易由Bob赞助
     */
    it("should execute sponsored batch ERC20 transfer", async function () {
        console.log("\n=== Testing Batch Sponsored ERC-20 Transfer ===");
        console.log("Alice batch transfers tokens to multiple recipients, transaction sponsored by Bob");

        const recipient1 = CHARLIE_ADDRESS;
        const recipient2 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
        const recipient3 = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
        
        const amount1 = ethers.parseEther("50");
        const amount2 = ethers.parseEther("75");
        const amount3 = ethers.parseEther("25");

        // 记录转账前的余额
        const aliceBalanceBefore = await token.balanceOf(ALICE_ADDRESS);
        
        console.log("Alice balance before transfer:", ethers.formatEther(aliceBalanceBefore));

        // 创建批量调用数组
        const calls = [
            {
                to: await token.getAddress(),
                value: 0,
                data: token.interface.encodeFunctionData("transfer", [recipient1, amount1])
            },
            {
                to: await token.getAddress(),
                value: 0,
                data: token.interface.encodeFunctionData("transfer", [recipient2, amount2])
            },
            {
                to: await token.getAddress(),
                value: 0,
                data: token.interface.encodeFunctionData("transfer", [recipient3, amount3])
            }
        ];

        // 构建签名
        let encodedCalls = "0x";
        for (const call of calls) {
            const encodedCall = ethers.solidityPacked(
                ["address", "uint256", "bytes"],
                [call.to, call.value, call.data]
            );
            encodedCalls += encodedCall.slice(2);
        }

        const currentNonce = await aliceContract.nonce();
        const digest = ethers.keccak256(ethers.solidityPacked(
            ["uint256", "bytes"],
            [currentNonce, encodedCalls]
        ));

        const aliceWallet = new ethers.Wallet(ALICE_PK);
        const signature = await aliceWallet.signMessage(ethers.getBytes(digest));

        // 执行批量转账
        await aliceContract.connect(bob).execute(calls, signature, {
            gasPrice: GAS_PRICE
        });

        // 验证所有转账都成功
        const totalTransferred = amount1 + amount2 + amount3;
        const aliceBalanceAfter = await token.balanceOf(ALICE_ADDRESS);
        
        expect(aliceBalanceAfter).to.equal(aliceBalanceBefore - totalTransferred, "Alice balance should decrease by total transferred amount");
        expect(await token.balanceOf(recipient1)).to.equal(amount1, "Recipient 1 should receive correct amount");
        expect(await token.balanceOf(recipient2)).to.equal(amount2, "Recipient 2 should receive correct amount");
        expect(await token.balanceOf(recipient3)).to.equal(amount3, "Recipient 3 should receive correct amount");
        
        console.log("Alice balance after transfer:", ethers.formatEther(aliceBalanceAfter));
        console.log("Recipient 1 balance:", ethers.formatEther(await token.balanceOf(recipient1)));
        console.log("Recipient 2 balance:", ethers.formatEther(await token.balanceOf(recipient2)));
        console.log("Recipient 3 balance:", ethers.formatEther(await token.balanceOf(recipient3)));
        console.log("SUCCESS: Batch sponsored ERC-20 transfer test passed!");
    });

    /**
     * @notice 测试混合赞助交易（ETH + ERC-20）
     * Alice同时发送ETH和ERC-20代币，交易由Bob赞助
     */
    it("should execute sponsored mixed transfer (ETH + ERC20)", async function () {
        console.log("\n=== Testing Mixed Sponsored Transaction ===");
        console.log("Alice sends both ETH and ERC-20 tokens simultaneously, transaction sponsored by Bob");

        const recipient = CHARLIE_ADDRESS;
        const ethAmount = ethers.parseEther("0.5");
        const tokenAmount = ethers.parseEther("200");

        // 记录转账前的余额
        const aliceEthBefore = await ethers.provider.getBalance(ALICE_ADDRESS);
        const aliceTokenBefore = await token.balanceOf(ALICE_ADDRESS);
        const charlieEthBefore = await ethers.provider.getBalance(recipient);
        const charlieTokenBefore = await token.balanceOf(recipient);

        console.log("Balances before transfer:");
        console.log("Alice ETH:", ethers.formatEther(aliceEthBefore));
        console.log("Alice tokens:", ethers.formatEther(aliceTokenBefore));
        console.log("Charlie ETH:", ethers.formatEther(charlieEthBefore));
        console.log("Charlie tokens:", ethers.formatEther(charlieTokenBefore));

        // 创建混合调用数组
        const calls = [
            {
                to: recipient,
                value: ethAmount,
                data: "0x"
            },
            {
                to: await token.getAddress(),
                value: 0,
                data: token.interface.encodeFunctionData("transfer", [recipient, tokenAmount])
            }
        ];

        // 构建签名
        let encodedCalls = "0x";
        for (const call of calls) {
            const encodedCall = ethers.solidityPacked(
                ["address", "uint256", "bytes"],
                [call.to, call.value, call.data]
            );
            encodedCalls += encodedCall.slice(2);
        }

        const currentNonce = await aliceContract.nonce();
        const digest = ethers.keccak256(ethers.solidityPacked(
            ["uint256", "bytes"],
            [currentNonce, encodedCalls]
        ));

        const aliceWallet = new ethers.Wallet(ALICE_PK);
        const signature = await aliceWallet.signMessage(ethers.getBytes(digest));

        // 执行混合转账
        await aliceContract.connect(bob).execute(calls, signature, {
            value: ethAmount, // Bob needs to provide the ETH for Alice's ETH transfer
            gasPrice: GAS_PRICE
        });

        // 验证转账成功
        const aliceEthAfter = await ethers.provider.getBalance(ALICE_ADDRESS);
        const aliceTokenAfter = await token.balanceOf(ALICE_ADDRESS);
        const charlieEthAfter = await ethers.provider.getBalance(recipient);
        const charlieTokenAfter = await token.balanceOf(recipient);

        console.log("Balances after transfer:");
        console.log("Alice ETH:", ethers.formatEther(aliceEthAfter));
        console.log("Alice tokens:", ethers.formatEther(aliceTokenAfter));
        console.log("Charlie ETH:", ethers.formatEther(charlieEthAfter));
        console.log("Charlie tokens:", ethers.formatEther(charlieTokenAfter));

        // Alice's ETH balance should remain the same because Bob provided the ETH via msg.value
        expect(aliceEthAfter).to.equal(aliceEthBefore, "Alice ETH balance should remain the same (sponsored ETH transfer)");
        expect(aliceTokenAfter).to.equal(aliceTokenBefore - tokenAmount, "Alice token balance should decrease");
        expect(charlieEthAfter).to.equal(charlieEthBefore + ethAmount, "Charlie ETH balance should increase");
        expect(charlieTokenAfter).to.equal(charlieTokenBefore + tokenAmount, "Charlie token balance should increase");
        
        console.log("SUCCESS: Mixed sponsored transaction test passed!");
    });

    /**
     * @notice 测试无效签名的赞助ERC-20转账应该失败
     */
    it("should fail sponsored transfer with invalid signature", async function () {
        console.log("\n=== Testing Sponsored Transfer with Invalid Signature ===");
        console.log("Transfer with wrong signature should fail");

        const transferAmount = ethers.parseEther("100");

        // 创建调用数组
        const calls = [{
            to: await token.getAddress(),
            value: 0,
            data: token.interface.encodeFunctionData("transfer", [CHARLIE_ADDRESS, transferAmount])
        }];

        // 构建编码调用数据
        let encodedCalls = "0x";
        for (const call of calls) {
            const encodedCall = ethers.solidityPacked(
                ["address", "uint256", "bytes"],
                [call.to, call.value, call.data]
            );
            encodedCalls += encodedCall.slice(2);
        }

        const currentNonce = await aliceContract.nonce();
        const digest = ethers.keccak256(ethers.solidityPacked(
            ["uint256", "bytes"],
            [currentNonce, encodedCalls]
        ));
        
        // 使用Bob的私钥而不是Alice的私钥签署（这应该失败）
        const bobWallet = new ethers.Wallet(BOB_PK);
        const invalidSignature = await bobWallet.signMessage(ethers.getBytes(digest));

        // 期望交易回滚
        await expect(
            aliceContract.connect(bob).execute(calls, invalidSignature, {
                gasPrice: GAS_PRICE
            })
        ).to.be.revertedWith("Invalid signature");
        
        console.log("SUCCESS: Invalid signature test passed - transaction correctly reverted!");
    });

    /**
     * @notice 测试余额不足的赞助ERC-20转账应该失败
     */
    it("should fail sponsored transfer with insufficient balance", async function () {
        console.log("\n=== Testing Sponsored Transfer with Insufficient Balance ===");
        console.log("Transfer should fail when balance is insufficient");

        // Try to transfer more than Alice's balance
        const aliceBalance = await token.balanceOf(ALICE_ADDRESS);
        const transferAmount = aliceBalance + ethers.parseEther("1"); // Exceed balance by 1 token

        console.log("Alice current balance:", ethers.formatEther(aliceBalance));
        console.log("Attempted transfer amount:", ethers.formatEther(transferAmount));

        // 创建调用数组
        const calls = [{
            to: await token.getAddress(),
            value: 0,
            data: token.interface.encodeFunctionData("transfer", [CHARLIE_ADDRESS, transferAmount])
        }];

        // 构建签名
        let encodedCalls = "0x";
        for (const call of calls) {
            const encodedCall = ethers.solidityPacked(
                ["address", "uint256", "bytes"],
                [call.to, call.value, call.data]
            );
            encodedCalls += encodedCall.slice(2);
        }

        const currentNonce = await aliceContract.nonce();
        const digest = ethers.keccak256(ethers.solidityPacked(
            ["uint256", "bytes"],
            [currentNonce, encodedCalls]
        ));

        const aliceWallet = new ethers.Wallet(ALICE_PK);
        const signature = await aliceWallet.signMessage(ethers.getBytes(digest));

        // 期望交易回滚（ERC20转账会因余额不足而失败）
        await expect(
            aliceContract.connect(bob).execute(calls, signature, {
                gasPrice: GAS_PRICE
            })
        ).to.be.revertedWith("Call reverted");
        
        console.log("SUCCESS: Insufficient balance test passed - transaction correctly reverted!");
    });
});