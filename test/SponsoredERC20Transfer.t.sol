// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {BatchCallAndSponsor} from "../src/BatchCallAndSponsor.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SponsoredERC20TransferTest
 * @notice 测试ERC-20赞助转账功能，其中Alice进行代币转账，但交易由Bob赞助和发送
 */
contract SponsoredERC20TransferTest is Test {
    // Alice的地址和私钥（EOA，初始没有合约代码）
    address payable constant ALICE_ADDRESS = payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    uint256 constant ALICE_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    // Bob的地址和私钥（Bob将代表Alice执行交易）
    address constant BOB_ADDRESS = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    uint256 constant BOB_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    // Charlie的地址（代币接收者）
    address constant CHARLIE_ADDRESS = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    
    // Gas价格常量 - 用于模拟真实网络环境
    uint256 constant GAS_PRICE = 20 gwei; // 20 gwei

    // Alice将委托执行给这个合约
    BatchCallAndSponsor public implementation;

    // 用于测试的ERC-20代币合约
    MockERC20 public token;

    // 事件定义
    event CallExecuted(address indexed sender, address indexed to, uint256 value, bytes data);
    event BatchExecuted(uint256 indexed nonce, BatchCallAndSponsor.Call[] calls);

    function setUp() public {
        // 部署委托合约（Alice将委托调用给这个合约）
        implementation = new BatchCallAndSponsor();

        // 部署ERC-20代币合约
        token = new MockERC20("Test Token", "TEST");

        // 为账户提供资金
        vm.deal(ALICE_ADDRESS, 10 ether);
        vm.deal(BOB_ADDRESS, 5 ether);
        
        // 给Alice铸造一些代币
        token.mint(ALICE_ADDRESS, 1000e18);
        
        console2.log("Setup completed:");
        console2.log("Alice ETH balance:", ALICE_ADDRESS.balance);
        console2.log("Bob ETH balance:", BOB_ADDRESS.balance);
        console2.log("Alice token balance:", token.balanceOf(ALICE_ADDRESS));
        console2.log("Charlie token balance:", token.balanceOf(CHARLIE_ADDRESS));
    }

    /**
     * @notice 测试赞助的ERC-20转账
     * Alice想要转账100个代币给Charlie，但交易由Bob赞助和发送
     */
    function testSponsoredERC20Transfer() public {
        console2.log("\n=== Testing Sponsored ERC-20 Transfer ===");
        console2.log("Alice transfers 100 tokens to Charlie, transaction sponsored by Bob");

        uint256 transferAmount = 100e18;
        
        // 记录转账前的余额
        uint256 aliceBalanceBefore = token.balanceOf(ALICE_ADDRESS);
        uint256 charlieBalanceBefore = token.balanceOf(CHARLIE_ADDRESS);
        
        // 记录gas余额
        uint256 aliceGasBalanceBefore = ALICE_ADDRESS.balance;
        uint256 bobGasBalanceBefore = BOB_ADDRESS.balance;
        
        console2.log("Balances before transfer:");
        console2.log("Alice tokens:", aliceBalanceBefore);
        console2.log("Charlie tokens:", charlieBalanceBefore);
        console2.log("Alice ETH (gas):", aliceGasBalanceBefore);
        console2.log("Bob ETH (gas):", bobGasBalanceBefore);

        // 创建调用数组 - ERC20转账
        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](1);
        calls[0] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (CHARLIE_ADDRESS, transferAmount))
        });

        // Alice签署委托，允许`implementation`代表她执行交易
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(implementation), ALICE_PK);

        // 设置gas价格以模拟真实网络环境
        vm.txGasPrice(GAS_PRICE);
        
        // Bob附加Alice的签名委托并广播
        // 这行代码做了以下事情：
        // ✅ 指定Bob作为交易发送者
        // ✅ 使用Bob的私钥签名交易
        // ✅ Bob支付所有gas费用
        // ✅ 实际向区块链网络广播交易
        vm.startBroadcast(BOB_PK);

        // 附加Alice的委托签名到即将发送的交易中
        // 告诉EVM这个交易包含一个委托授权，Alice授权某个合约代表她执行操作
        // 不发送交易: 这只是为交易添加委托信息，本身不发送交易
        vm.attachDelegation(signedDelegation);
    
        // 验证Alice的账户现在临时表现为智能合约
        bytes memory code = address(ALICE_ADDRESS).code;
        require(code.length > 0, "No code written to Alice account");

        // 构建编码的调用数据用于签名
        bytes memory encodedCalls = "";
        for (uint256 i = 0; i < calls.length; i++) {
            encodedCalls = abi.encodePacked(encodedCalls, calls[i].to, calls[i].value, calls[i].data);
        }

        // 获取当前nonce并创建摘要
        uint256 currentNonce = BatchCallAndSponsor(ALICE_ADDRESS).nonce();
        bytes32 digest = keccak256(abi.encodePacked(currentNonce, encodedCalls));

        // Alice用她的私钥签署摘要
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, MessageHashUtils.toEthSignedMessageHash(digest));
        bytes memory signature = abi.encodePacked(r, s, v);

        // 期望事件被触发
        vm.expectEmit(true, true, true, true);
        emit BatchCallAndSponsor.CallExecuted(BOB_ADDRESS, calls[0].to, calls[0].value, calls[0].data);

        // 记录gas使用量 - 在执行前
        uint256 gasStart = gasleft();
        
        // Bob通过Alice的临时分配合约执行交易
        BatchCallAndSponsor(ALICE_ADDRESS).execute(calls, signature);
        
        // 记录gas使用量 - 在执行后
        uint256 gasEnd = gasleft();
        uint256 gasUsed = (gasStart - gasEnd) * tx.gasprice;

        vm.stopBroadcast();

        // 验证转账成功
        uint256 aliceBalanceAfter = token.balanceOf(ALICE_ADDRESS);
        uint256 charlieBalanceAfter = token.balanceOf(CHARLIE_ADDRESS);
        
        // 记录gas余额变化
        uint256 aliceGasBalanceAfter = ALICE_ADDRESS.balance;
        uint256 bobGasBalanceAfter = BOB_ADDRESS.balance;
        
        console2.log("Balances after transfer:");
        console2.log("Alice tokens:", aliceBalanceAfter);
        console2.log("Charlie tokens:", charlieBalanceAfter);
        console2.log("Alice ETH (gas):", aliceGasBalanceAfter);
        console2.log("Bob ETH (gas):", bobGasBalanceAfter);

        assertEq(aliceBalanceAfter, aliceBalanceBefore - transferAmount, "Alice balance should decrease");
        assertEq(charlieBalanceAfter, charlieBalanceBefore + transferAmount, "Charlie balance should increase");

        // 验证gas消耗：Alice的gas应该不变
        assertEq(aliceGasBalanceAfter, aliceGasBalanceBefore, "Alice should not consume any gas (sponsored transaction)");
        
        // 计算实际的gas消耗
        uint256 aliceGasConsumed = aliceGasBalanceBefore - aliceGasBalanceAfter;
        uint256 bobGasConsumed = bobGasBalanceBefore - bobGasBalanceAfter;
        
        console2.log("Current gas price:", tx.gasprice);
        console2.log("Gas used for transaction:", gasUsed);
        console2.log("Gas consumed by Alice (ETH):", aliceGasConsumed, "(should be 0)");
        console2.log("Gas consumed by Bob (ETH):", bobGasConsumed);
        
        // 验证Alice没有消耗任何gas
        assertEq(aliceGasConsumed, 0, "Alice should not consume any gas in sponsored transaction");
        
        // 验证计算出的gas使用量大于0 - 这证明交易确实消耗了gas
        assertTrue(gasUsed > 0, "Transaction should consume gas");
        
        // 验证gas价格设置正确
        assertEq(tx.gasprice, GAS_PRICE, "Gas price should be set to our configured value");
        
        console2.log("SUCCESS: Real gas consumption verified!");
        console2.log("- Alice consumed 0 gas (sponsored transaction)");
        console2.log("- Transaction consumed", gasUsed, "wei in gas fees");
        console2.log("- Gas price:", tx.gasprice, "wei per gas");
        console2.log("- Actual gas units used:", gasUsed / tx.gasprice);
        
        console2.log("SUCCESS: Sponsored ERC-20 transfer test passed!");
    }

    /**
     * @notice 测试批量赞助的ERC-20转账
     * Alice想要同时转账给多个接收者，交易由Bob赞助
     */
    function testSponsoredBatchERC20Transfer() public {
        console2.log("\n=== Testing Batch Sponsored ERC-20 Transfer ===");
        console2.log("Alice batch transfers tokens to multiple recipients, transaction sponsored by Bob");

        address recipient1 = CHARLIE_ADDRESS;
        address recipient2 = makeAddr("recipient2");
        address recipient3 = makeAddr("recipient3");
        
        uint256 amount1 = 50e18;
        uint256 amount2 = 75e18;
        uint256 amount3 = 25e18;

        // 记录转账前的余额
        uint256 aliceBalanceBefore = token.balanceOf(ALICE_ADDRESS);
        
        console2.log("Alice balance before transfer:", aliceBalanceBefore);

        // 创建批量调用数组
        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](3);
        calls[0] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (recipient1, amount1))
        });
        calls[1] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (recipient2, amount2))
        });
        calls[2] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (recipient3, amount3))
        });

        // Alice签署委托
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(implementation), ALICE_PK);

        // 设置gas价格以模拟真实网络环境
        vm.txGasPrice(GAS_PRICE);
        
        // Bob执行赞助交易
        vm.startBroadcast(BOB_PK);
        vm.attachDelegation(signedDelegation);

        // 构建签名
        bytes memory encodedCalls = "";
        for (uint256 i = 0; i < calls.length; i++) {
            encodedCalls = abi.encodePacked(encodedCalls, calls[i].to, calls[i].value, calls[i].data);
        }

        uint256 currentNonce = BatchCallAndSponsor(ALICE_ADDRESS).nonce();
        bytes32 digest = keccak256(abi.encodePacked(currentNonce, encodedCalls));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, MessageHashUtils.toEthSignedMessageHash(digest));
        bytes memory signature = abi.encodePacked(r, s, v);

        // 执行批量转账
        BatchCallAndSponsor(ALICE_ADDRESS).execute(calls, signature);

        vm.stopBroadcast();

        // 验证所有转账都成功
        uint256 totalTransferred = amount1 + amount2 + amount3;
        uint256 aliceBalanceAfter = token.balanceOf(ALICE_ADDRESS);
        
        assertEq(aliceBalanceAfter, aliceBalanceBefore - totalTransferred, "Alice balance should decrease by total transferred amount");
        assertEq(token.balanceOf(recipient1), amount1, "Recipient 1 should receive correct amount");
        assertEq(token.balanceOf(recipient2), amount2, "Recipient 2 should receive correct amount");
        assertEq(token.balanceOf(recipient3), amount3, "Recipient 3 should receive correct amount");
        
        console2.log("Alice balance after transfer:", aliceBalanceAfter);
        console2.log("Recipient 1 balance:", token.balanceOf(recipient1));
        console2.log("Recipient 2 balance:", token.balanceOf(recipient2));
        console2.log("Recipient 3 balance:", token.balanceOf(recipient3));
        console2.log("SUCCESS: Batch sponsored ERC-20 transfer test passed!");
    }

    /**
     * @notice 测试混合赞助交易（ETH + ERC-20）
     * Alice同时发送ETH和ERC-20代币，交易由Bob赞助
     */
    function testSponsoredMixedTransfer() public {
        console2.log("\n=== Testing Mixed Sponsored Transaction ===");
        console2.log("Alice sends both ETH and ERC-20 tokens simultaneously, transaction sponsored by Bob");

        address recipient = CHARLIE_ADDRESS;
        uint256 ethAmount = 0.5 ether;
        uint256 tokenAmount = 200e18;

        // 记录转账前的余额
        uint256 aliceEthBefore = ALICE_ADDRESS.balance;
        uint256 aliceTokenBefore = token.balanceOf(ALICE_ADDRESS);
        uint256 charlieEthBefore = recipient.balance;
        uint256 charlieTokenBefore = token.balanceOf(recipient);

        console2.log("Balances before transfer:");
        console2.log("Alice ETH:", aliceEthBefore);
        console2.log("Alice tokens:", aliceTokenBefore);
        console2.log("Charlie ETH:", charlieEthBefore);
        console2.log("Charlie tokens:", charlieTokenBefore);

        // 创建混合调用数组
        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](2);
        
        // ETH转账
        calls[0] = BatchCallAndSponsor.Call({
            to: recipient,
            value: ethAmount,
            data: ""
        });
        
        // ERC-20转账
        calls[1] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (recipient, tokenAmount))
        });

        // Alice签署委托
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(implementation), ALICE_PK);

        // 设置gas价格以模拟真实网络环境
        vm.txGasPrice(GAS_PRICE);
        
        // Bob执行赞助交易
        vm.startBroadcast(BOB_PK);
        vm.attachDelegation(signedDelegation);

        // 构建签名
        bytes memory encodedCalls = "";
        for (uint256 i = 0; i < calls.length; i++) {
            encodedCalls = abi.encodePacked(encodedCalls, calls[i].to, calls[i].value, calls[i].data);
        }

        uint256 currentNonce = BatchCallAndSponsor(ALICE_ADDRESS).nonce();
        bytes32 digest = keccak256(abi.encodePacked(currentNonce, encodedCalls));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, MessageHashUtils.toEthSignedMessageHash(digest));
        bytes memory signature = abi.encodePacked(r, s, v);

        // 执行混合转账
        BatchCallAndSponsor(ALICE_ADDRESS).execute(calls, signature);

        vm.stopBroadcast();

        // 验证转账成功
        uint256 aliceEthAfter = ALICE_ADDRESS.balance;
        uint256 aliceTokenAfter = token.balanceOf(ALICE_ADDRESS);
        uint256 charlieEthAfter = recipient.balance;
        uint256 charlieTokenAfter = token.balanceOf(recipient);

        console2.log("Balances after transfer:");
        console2.log("Alice ETH:", aliceEthAfter);
        console2.log("Alice tokens:", aliceTokenAfter);
        console2.log("Charlie ETH:", charlieEthAfter);
        console2.log("Charlie tokens:", charlieTokenAfter);

        assertEq(aliceEthAfter, aliceEthBefore - ethAmount, "Alice ETH balance should decrease");
        assertEq(aliceTokenAfter, aliceTokenBefore - tokenAmount, "Alice token balance should decrease");
        assertEq(charlieEthAfter, charlieEthBefore + ethAmount, "Charlie ETH balance should increase");
        assertEq(charlieTokenAfter, charlieTokenBefore + tokenAmount, "Charlie token balance should increase");
        
        console2.log("SUCCESS: Mixed sponsored transaction test passed!");
    }

    /**
     * @notice 测试无效签名的赞助ERC-20转账应该失败
     */
    function testSponsoredERC20TransferWithInvalidSignature() public {
        console2.log("\n=== Testing Sponsored Transfer with Invalid Signature ===");
        console2.log("Transfer with wrong signature should fail");

        uint256 transferAmount = 100e18;

        // 创建调用数组
        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](1);
        calls[0] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (CHARLIE_ADDRESS, transferAmount))
        });

        // Alice签署委托
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(implementation), ALICE_PK);

        // 设置gas价格以模拟真实网络环境
        vm.txGasPrice(GAS_PRICE);
        
        // Bob执行赞助交易
        vm.startBroadcast(BOB_PK);
        vm.attachDelegation(signedDelegation);

        // 构建编码调用数据
        bytes memory encodedCalls = "";
        for (uint256 i = 0; i < calls.length; i++) {
            encodedCalls = abi.encodePacked(encodedCalls, calls[i].to, calls[i].value, calls[i].data);
        }

        uint256 currentNonce = BatchCallAndSponsor(ALICE_ADDRESS).nonce();
        bytes32 digest = keccak256(abi.encodePacked(currentNonce, encodedCalls));
        
        // 使用Bob的私钥而不是Alice的私钥签署（这应该失败）
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(BOB_PK, MessageHashUtils.toEthSignedMessageHash(digest));
        bytes memory invalidSignature = abi.encodePacked(r, s, v);

        // 期望交易回滚
        vm.expectRevert("Invalid signature");
        BatchCallAndSponsor(ALICE_ADDRESS).execute(calls, invalidSignature);

        vm.stopBroadcast();
        
        console2.log("SUCCESS: Invalid signature test passed - transaction correctly reverted!");
    }

    /**
     * @notice 测试余额不足的赞助ERC-20转账应该失败
     */
    function testSponsoredERC20TransferWithInsufficientBalance() public {
        console2.log("\n=== Testing Sponsored Transfer with Insufficient Balance ===");
        console2.log("Transfer should fail when balance is insufficient");

        // Try to transfer more than Alice's balance
        uint256 aliceBalance = token.balanceOf(ALICE_ADDRESS);
        uint256 transferAmount = aliceBalance + 1e18; // Exceed balance by 1 token

        console2.log("Alice current balance:", aliceBalance);
        console2.log("Attempted transfer amount:", transferAmount);

        // 创建调用数组
        BatchCallAndSponsor.Call[] memory calls = new BatchCallAndSponsor.Call[](1);
        calls[0] = BatchCallAndSponsor.Call({
            to: address(token),
            value: 0,
            data: abi.encodeCall(IERC20.transfer, (CHARLIE_ADDRESS, transferAmount))
        });

        // Alice签署委托
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(implementation), ALICE_PK);

        // 设置gas价格以模拟真实网络环境
        vm.txGasPrice(GAS_PRICE);
        
        // Bob执行赞助交易
        vm.startBroadcast(BOB_PK);
        vm.attachDelegation(signedDelegation);

        // 构建签名
        bytes memory encodedCalls = "";
        for (uint256 i = 0; i < calls.length; i++) {
            encodedCalls = abi.encodePacked(encodedCalls, calls[i].to, calls[i].value, calls[i].data);
        }

        uint256 currentNonce = BatchCallAndSponsor(ALICE_ADDRESS).nonce();
        bytes32 digest = keccak256(abi.encodePacked(currentNonce, encodedCalls));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, MessageHashUtils.toEthSignedMessageHash(digest));
        bytes memory signature = abi.encodePacked(r, s, v);

        // 期望交易回滚（ERC20转账会因余额不足而失败）
        vm.expectRevert("Call reverted");
        BatchCallAndSponsor(ALICE_ADDRESS).execute(calls, signature);

        vm.stopBroadcast();
        
        console2.log("SUCCESS: Insufficient balance test passed - transaction correctly reverted!");
    }
}
