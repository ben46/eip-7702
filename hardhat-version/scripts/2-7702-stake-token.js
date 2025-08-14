import {
    createWalletClient,
    createPublicClient,
    http,
    parseEther,
    formatEther,
    encodeFunctionData,
    encodePacked,
    keccak256,
    parseGwei,
    toHex,
    zeroAddress
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';

// 配置 - BSC主网 (TierStake质押版本)
const ALICE_PRIVATE_KEY = "0xaf8d3571cefcdeb7aeb829ca8110cc3d758b386d54ad37660174dc428d7bef31"; // 请填入Alice的私钥
const RELAYER_PRIVATE_KEY = ""; // 请填入Relayer的私钥
const BATCH_CONTRACT = "0x01CFCFd8FB0C4BF9abB4Fd8a449DdF48c94e86D4";
const STAKING_TOKEN_CONTRACT = "0xfdffb411c4a70aa7c95d5c981a6fb4da867e1111"; // stakingToken (支持ERC20Permit)
const TIERSTAKE_CONTRACT = "0x8AF99B0092650d77EBf470A2d7e935dC1093073d"; // TierStake合约地址 (需要填入已部署的地址)

const STAKE_AMOUNT = parseEther("0.0000001"); // Alice质押数量
const WITHDRAW_AMOUNT = parseEther("0.0000001"); // Alice提取数量
const GAS_PRICE = parseGwei('0.11'); // 0.11 gwei

// ERC20 ABI (包含Permit功能)
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
    },
    {
        name: 'transferFrom',
        type: 'function',
        inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
    },
    {
        name: 'permit',
        type: 'function',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'v', type: 'uint8' },
            { name: 'r', type: 'bytes32' },
            { name: 's', type: 'bytes32' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'nonces',
        type: 'function',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'DOMAIN_SEPARATOR',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }],
        stateMutability: 'view'
    }
];

// TierStake ABI (质押合约功能)
const TIERSTAKE_ABI = [
    {
        name: 'stake',
        type: 'function',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'withdraw',
        type: 'function',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'claim',
        type: 'function',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable'
    },
    {
        name: 'getUserInfo',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{
            name: '',
            type: 'tuple',
            components: [
                { name: 'stakedAmount', type: 'uint256' },
                { name: 'claimedAmount', type: 'uint256' },
                { name: 'pendingWithdrawAmount', type: 'uint256' },
                { name: 'nextClaimTime', type: 'uint256' }
            ]
        }],
        stateMutability: 'view'
    },
    {
        name: 'canClaim',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view'
    },
    {
        name: 'totalStaked',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'stakingToken',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view'
    }
];

const BATCH_ABI = [
    {
        name: 'execute',
        type: 'function',
        inputs: [
            {
                name: 'calls',
                type: 'tuple[]',
                components: [
                    { name: 'to', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'data', type: 'bytes' }
                ]
            },
            { name: 'signature', type: 'bytes' }
        ],
        outputs: [],
        stateMutability: 'payable'
    },
    {
        name: 'nonce',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    }
];

async function main() {
    console.log("🚀 Alice EIP-7702 助手 - BSC主网 (TierStake质押版)");
    console.log("💡 核心特性: Alice通过EIP-7702进行gasless质押操作");
    console.log("⛽ Gas价格: 0.11 gwei");
    console.log("🏦 质押场景: approve授权 + stake操作，Alice零gas体验");
    console.log("🔄 智能处理: 自动解决EIP-7702授权冲突");
    console.log("🔁 完整流程: 取消冲突授权→重新授权→执行质押→取消授权");

    // 检查私钥配置
    if (!ALICE_PRIVATE_KEY || !RELAYER_PRIVATE_KEY) {
        console.error("\n❌ 错误: 请在脚本中填入私钥");
        console.error("请设置:");
        console.error("- ALICE_PRIVATE_KEY: Alice的私钥");
        console.error("- RELAYER_PRIVATE_KEY: Relayer的私钥");
        console.error("- TIERSTAKE_CONTRACT: TierStake合约地址");
        process.exit(1);
    }

    if (!TIERSTAKE_CONTRACT) {
        console.error("\n❌ 错误: 请填入TierStake合约地址");
        console.error("请设置 TIERSTAKE_CONTRACT 变量");
        process.exit(1);
    }

    // 创建客户端
    const publicClient = createPublicClient({
        chain: bsc,
        transport: http()
    });

    const alice = privateKeyToAccount(ALICE_PRIVATE_KEY);
    const relayer = privateKeyToAccount(RELAYER_PRIVATE_KEY);

    const aliceClient = createWalletClient({
        account: alice,
        chain: bsc,
        transport: http()
    });

    const relayerClient = createWalletClient({
        account: relayer,
        chain: bsc,
        transport: http()
    });

    console.log("\n👥 参与者:");
    console.log("Alice:", alice.address);
    console.log("Relayer:", relayer.address);
    console.log("BatchContract:", BATCH_CONTRACT);
    console.log("StakingToken:", STAKING_TOKEN_CONTRACT);
    console.log("TierStake:", TIERSTAKE_CONTRACT);

    try {
        // 检查初始状态
        console.log("\n📊 初始状态:");
        const [aliceTokens, aliceBnb, aliceStakeInfo, totalStaked] = await Promise.all([
            publicClient.readContract({
                address: STAKING_TOKEN_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [alice.address]
            }),
            publicClient.getBalance({ address: alice.address }),
            publicClient.readContract({
                address: TIERSTAKE_CONTRACT,
                abi: TIERSTAKE_ABI,
                functionName: 'getUserInfo',
                args: [alice.address]
            }),
            publicClient.readContract({
                address: TIERSTAKE_CONTRACT,
                abi: TIERSTAKE_ABI,
                functionName: 'totalStaked',
                args: []
            })
        ]);

        console.log("Alice持有Token:", formatEther(aliceTokens));
        console.log("Alice已质押:", formatEther(aliceStakeInfo.stakedAmount));
        console.log("Alice待提取:", formatEther(aliceStakeInfo.pendingWithdrawAmount));
        console.log("Alice BNB:", formatEther(aliceBnb));
        console.log("合约总质押:", formatEther(totalStaked));

        // 检查Alice是否已经是智能账户
        const aliceCode = await publicClient.getCode({ address: alice.address });
        console.log("Alice代码长度:", aliceCode ? aliceCode.length : 0);
        console.log("Alice代码:", aliceCode || '0x');
        const isSmartAccount = aliceCode && aliceCode !== '0x';

        // 获取BatchCallAndSponsor合约的代码
        const batchCode = await publicClient.getCode({ address: BATCH_CONTRACT });
        console.log("Batch代码长度:", batchCode ? batchCode.length : 0);

        // 检查Alice的代码是否包含BatchCallAndSponsor合约地址（全小写比较）
        // EIP-7702格式: 0xef01 + 00 + 合约地址 (去掉0x前缀)
        const expectedCode = ('0xef0100' + BATCH_CONTRACT.slice(2)).toLowerCase();
        const actualCode = (aliceCode || '0x').toLowerCase();
        const isCorrectContract = actualCode === expectedCode;

        console.log("期望的EIP-7702代码:", expectedCode);
        console.log("Alice实际代码:", actualCode);
        console.log("代码匹配:", isCorrectContract);

        console.log("Alice是智能账户:", isSmartAccount);
        if (isSmartAccount) {
            console.log("Alice代码是BatchCallAndSponsor:", isCorrectContract);
            if (!isCorrectContract) {
                console.log("⚠️  Alice当前代码不是BatchCallAndSponsor，需要重新授权");
            }
        }

        // 步骤1: 处理EIP-7702授权冲突和重新授权
        let authorization;
        if (!isCorrectContract) {
            if (isSmartAccount) {
                console.log("\n🔄 步骤1: Alice被授权给其他合约，需要先取消再重新授权");
                console.log("   当前授权:", actualCode);
                console.log("   期望授权:", expectedCode);

                // 子步骤1.1: Alice签名取消授权
                console.log("\n🚫 步骤1.1: Alice签名取消当前授权 (离线)");
                const cancelAuthorization = await aliceClient.signAuthorization({
                    contractAddress: zeroAddress // 授权到零地址 = 取消授权
                });
                console.log("✅ Alice已签名取消授权");

                // 子步骤1.2: Relayer发送取消授权交易
                console.log("\n📤 步骤1.2: Relayer发送取消授权交易");
                const cancelTx = await relayerClient.sendTransaction({
                    account: relayer,
                    to: alice.address,
                    value: 0n,
                    data: '0x',
                    authorizationList: [cancelAuthorization],
                    gas: 100000n,
                    maxFeePerGas: GAS_PRICE,
                    maxPriorityFeePerGas: GAS_PRICE
                });
                console.log("✅ 取消授权交易已发送:", cancelTx);

                // 等待取消授权交易确认
                await publicClient.waitForTransactionReceipt({ hash: cancelTx });
                console.log("✅ Alice授权已取消，恢复为普通EOA");
            } else {
                console.log("\n🔐 步骤1: Alice首次EIP-7702授权");
            }

            // 重新授权到BatchCallAndSponsor
            console.log("\n🔐 步骤1.3: Alice签名新的EIP-7702授权 (离线)");
            authorization = await aliceClient.signAuthorization({
                contractAddress: BATCH_CONTRACT
            });
            console.log("✅ Alice已签名EIP-7702授权");
            console.log("   目标合约地址:", BATCH_CONTRACT);
        } else {
            console.log("\n✅ Alice已经是正确的智能账户，跳过授权步骤");
        }

        // 步骤2: 跳过Permit，智能账户直接approve
        console.log("\n✅ 步骤2: 跳过ERC20 Permit");
        console.log("💡 Alice现在是智能账户，可以直接approve，无需permit签名");

        // 步骤3: 构建批量调用 (approve + stake)
        console.log("\n🔨 步骤3: 构建批量调用");
        const calls = [
            // 1. 直接Approve授权TierStake合约使用Alice的代币
            {
                to: STAKING_TOKEN_CONTRACT,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [TIERSTAKE_CONTRACT, STAKE_AMOUNT]
                })
            },
            // 2. 质押代币到TierStake合约
            {
                to: TIERSTAKE_CONTRACT,
                value: 0n,
                data: encodeFunctionData({
                    abi: TIERSTAKE_ABI,
                    functionName: 'stake',
                    args: [STAKE_AMOUNT]
                })
            }
        ];

        console.log("✅ 批量调用已构建 (2个操作):");
        console.log("   1. Approve授权TierStake使用", formatEther(STAKE_AMOUNT), "代币");
        console.log("   2. Stake质押", formatEther(STAKE_AMOUNT), "代币到TierStake合约");

        console.log("\n⏳ 步骤4: 准备批量操作签名 (稍后进行)");

        // 步骤5: Relayer执行EIP-7702授权交易 (如果需要)
        if (!isCorrectContract) {
            console.log("\n📤 步骤5: Relayer发送EIP-7702授权交易");
            console.log("💡 这将使Alice地址变成BatchCallAndSponsor智能账户");

            const authTx = await relayerClient.sendTransaction({
                account: relayer,
                to: alice.address,
                value: 0n,
                data: '0x',
                authorizationList: [authorization],
                gas: 100000n,
                maxFeePerGas: GAS_PRICE,
                maxPriorityFeePerGas: GAS_PRICE
            });

            console.log("✅ EIP-7702授权交易已发送:", authTx);

            // 等待交易确认
            const authReceipt = await publicClient.waitForTransactionReceipt({
                hash: authTx
            });
            console.log("✅ Alice地址现在是BatchCallAndSponsor智能账户!");
        } else {
            console.log("\n✅ Alice已经是正确的智能账户，跳过EIP-7702授权交易");
        }

        // 步骤6: Alice签名批量操作 (在确保Alice是正确智能账户后)
        console.log("\n✍️ 步骤6: Alice签名批量操作 (现在Alice是正确的智能账户)");

        // 对于EIP-7702新授权的地址，nonce应该从0开始
        let batchNonce = 0n;
        console.log("   使用初始nonce: 0 (新的EIP-7702智能账户)");

        // 构建批量操作的digest
        let encodedCalls = '0x';
        for (const call of calls) {
            const packed = encodePacked(
                ['address', 'uint256', 'bytes'],
                [call.to, call.value, call.data]
            );
            encodedCalls += packed.slice(2);
        }

        const digest = keccak256(
            encodePacked(['uint256', 'bytes'], [batchNonce, encodedCalls])
        );

        const batchSignature = await aliceClient.signMessage({
            message: { raw: digest }
        });

        console.log("✅ Alice已签名批量操作 (使用正确的nonce)");

        // 步骤7: Relayer执行批量操作 (一笔交易完成approve+stake)
        console.log("\n⚡ 步骤7: Relayer执行批量操作");
        console.log("💫 一笔交易完成: approve授权 + stake质押", formatEther(STAKE_AMOUNT), "代币");

        // 最终检查Alice是否是正确的智能账户（使用一致的小写比较）
        const finalAliceCode = await publicClient.getCode({ address: alice.address });
        console.log("finalAliceCode:", finalAliceCode);
        const finalExpectedCode = expectedCode; // 重用之前计算的expectedCode
        const finalActualCode = (finalAliceCode || '0x').toLowerCase();
        const finalIsCorrectContract = finalActualCode === finalExpectedCode;



        const { request } = await publicClient.simulateContract({
            address: alice.address, // 现在Alice地址是合约地址
            abi: BATCH_ABI,
            functionName: 'execute',
            args: [calls, batchSignature],
            account: relayer
        });

        const batchTx = await relayerClient.writeContract({
            ...request,
            maxFeePerGas: GAS_PRICE, // 0.11 gwei max fee
            maxPriorityFeePerGas: GAS_PRICE // 0.11 gwei priority fee
        });

        console.log("✅ 批量操作已发送:", batchTx);

        // 等待交易确认
        const batchReceipt = await publicClient.waitForTransactionReceipt({
            hash: batchTx
        });

        console.log("🎉 批量操作完成! Gas使用:", batchReceipt.gasUsed.toString());

        // 验证最终结果
        console.log("\n📊 最终结果:");
        const [finalAliceTokens, finalAliceStakeInfo, finalTotalStaked] = await Promise.all([
            publicClient.readContract({
                address: STAKING_TOKEN_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [alice.address]
            }),
            publicClient.readContract({
                address: TIERSTAKE_CONTRACT,
                abi: TIERSTAKE_ABI,
                functionName: 'getUserInfo',
                args: [alice.address]
            }),
            publicClient.readContract({
                address: TIERSTAKE_CONTRACT,
                abi: TIERSTAKE_ABI,
                functionName: 'totalStaked',
                args: []
            })
        ]);

        console.log("Alice剩余Token:", formatEther(finalAliceTokens));
        console.log("Alice已质押:", formatEther(finalAliceStakeInfo.stakedAmount));
        console.log("Alice待提取:", formatEther(finalAliceStakeInfo.pendingWithdrawAmount));
        console.log("合约总质押:", formatEther(finalTotalStaked));

        const aliceTokenChange = finalAliceTokens - aliceTokens;
        const aliceStakeChange = finalAliceStakeInfo.stakedAmount - aliceStakeInfo.stakedAmount;

        console.log("\n🎯 变化:");
        console.log("Alice代币变化:", formatEther(aliceTokenChange));
        console.log("Alice质押增加:", formatEther(aliceStakeChange));

        if (aliceStakeChange === STAKE_AMOUNT && aliceTokenChange === -STAKE_AMOUNT) {
            console.log("\n🎉🎉🎉 成功! EIP-7702质押演示完成!");
            console.log("✨ Alice成功质押", formatEther(STAKE_AMOUNT), "代币");
            console.log("✨ Alice全程只签名，无需发送交易");
            console.log("✨ 一笔交易完成approve+stake");
        }

        console.log(`\n🔍 查看交易: https://bscscan.com/tx/${batchTx}`);

        // 步骤8: 可选的取消授权 (恢复Alice为普通EOA)
        console.log("\n🔄 步骤8: 可选的取消授权 (将Alice恢复为普通EOA)");
        console.log("💡 这样Alice地址可以被重新用于其他EIP-7702授权");

        // Alice签名取消授权
        console.log("\n🚫 步骤8.1: Alice签名取消授权 (离线)");
        const finalCancelAuthorization = await aliceClient.signAuthorization({
            contractAddress: zeroAddress // 授权到零地址 = 取消授权
        });
        console.log("✅ Alice已签名取消授权");

        // Relayer发送取消授权交易
        console.log("\n📤 步骤8.2: Relayer发送取消授权交易");
        const finalCancelTx = await relayerClient.sendTransaction({
            account: relayer,
            to: alice.address,
            value: 0n,
            data: '0x',
            authorizationList: [finalCancelAuthorization],
            gas: 100000n,
            maxFeePerGas: GAS_PRICE,
            maxPriorityFeePerGas: GAS_PRICE
        });
        console.log("✅ 最终取消授权交易已发送:", finalCancelTx);

        // 等待取消授权交易确认
        await publicClient.waitForTransactionReceipt({ hash: finalCancelTx });

        // 验证Alice恢复为普通EOA
        const veryFinalCode = await publicClient.getCode({ address: alice.address });
        const isNowEOA = !veryFinalCode || veryFinalCode === '0x';

        console.log("\n📊 最终授权状态:");
        console.log("Alice代码:", veryFinalCode || '0x');
        console.log("Alice是普通EOA:", isNowEOA);

        if (isNowEOA) {
            console.log("✅ Alice已成功恢复为普通EOA，可用于下次EIP-7702授权");
        } else {
            console.log("⚠️  Alice仍是智能账户，取消授权可能失败");
        }

        console.log(`\n🔍 查看取消授权交易: https://bscscan.com/tx/${finalCancelTx}`);

    } catch (error) {
        console.error("\n❌ 操作失败:", error.message);

        if (error.message.includes('authorization')) {
            console.log("💡 可能原因: BSC主网可能还不完全支持EIP-7702");
            console.log("💡 建议: 等待BSC正式支持EIP-7702后再试");
        }

        if (error.message.includes('insufficient funds')) {
            console.log("💡 建议: 确保账户有足够的BNB支付gas费");
        }
    }
}

// Alice助手完成！

main().catch(console.error);
