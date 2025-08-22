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

// 配置 - BSC主网
const ALICE_PRIVATE_KEY = "0x3bb30d1aa3c71712875c73d5ec90206d798b81e55379ae2f0792600308277d22";
const RELAYER_PRIVATE_KEY = "";
const BATCH_CONTRACT = "0x01CFCFd8FB0C4BF9abB4Fd8a449DdF48c94e86D4";
const ERC20_CONTRACT = "0xD246EbaF9B5d3B28914AA3b20699150CFBE96Bca";

const MINT_AMOUNT = parseEther("1000");
const TRANSFER_AMOUNT = parseEther("500");
const GAS_PRICE = parseGwei('0.11'); // 0.11 gwei

// ERC20 ABI (基础功能)
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view'
    },
    {
        name: 'mint',
        type: 'function',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
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
        name: 'transfer',
        type: 'function',
        inputs: [
            { name: 'to', type: 'address' },
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
    console.log("🚀 Alice EIP-7702 助手 - BSC主网");
    console.log("💡 核心特性: Alice地址变成智能账户，一笔交易完成mint+transfer");
    console.log("⛽ Gas价格: 0.11 gwei (提升版)");
    console.log("✨ 简化版: 无需permit/approve，直接mint+transfer");
    console.log("🔄 智能处理: 自动解决EIP-7702授权冲突");
    console.log("🔁 完整流程: 取消冲突授权→重新授权→执行业务→取消授权");

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

    try {
        // 检查初始状态
        console.log("\n📊 初始状态:");
        const [aliceTokens, RelayerTokens, aliceBnb] = await Promise.all([
            publicClient.readContract({
                address: ERC20_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [alice.address]
            }),
            publicClient.readContract({
                address: ERC20_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [relayer.address]
            }),
            publicClient.getBalance({ address: alice.address })
        ]);

        console.log("Alice代币:", formatEther(aliceTokens));
        console.log("Relayer代币:", formatEther(RelayerTokens));
        console.log("Alice BNB:", formatEther(aliceBnb));

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

        console.log("\n✅ 跳过ERC20 Permit步骤 (智能账户直接transfer，无需授权)");

        // 步骤2: 构建批量调用 (mint + transfer) - 不需要approve！
        console.log("\n🔨 步骤2: 构建批量调用");
        const calls = [
            // 1. Mint代币给Alice
            {
                to: ERC20_CONTRACT,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'mint',
                    args: [alice.address, MINT_AMOUNT]
                })
            },
            // 2. 直接Transfer转账给Relayer (无需approve，因为是自己转给别人)
            {
                to: ERC20_CONTRACT,
                value: 0n,
                data: encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [relayer.address, TRANSFER_AMOUNT]
                })
            }
        ];

        console.log("✅ 批量调用已构建 (2个操作):");
        console.log("   1. Mint 1000 代币给Alice");
        console.log("   2. Transfer 500代币给Relayer (无需授权，直接转账)");

        console.log("\n⏳ 步骤3: 准备批量操作签名 (稍后进行)");

        // 步骤4: Relayer执行EIP-7702授权交易 (如果需要)
        if (!isCorrectContract) {
            console.log("\n📤 步骤4: Relayer发送EIP-7702授权交易");
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

        // 步骤5: Alice签名批量操作 (在确保Alice是正确智能账户后)
        console.log("\n✍️ 步骤5: Alice签名批量操作 (现在Alice是正确的智能账户)");

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

        // 步骤6: Relayer执行批量操作 (一笔交易完成mint+transfer)
        console.log("\n⚡ 步骤6: Relayer执行批量操作");
        console.log("💫 一笔交易完成: mint 1000 + transfer 500");

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
        const [finalAliceTokens, finalRelayerTokens] = await Promise.all([
            publicClient.readContract({
                address: ERC20_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [alice.address]
            }),
            publicClient.readContract({
                address: ERC20_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [relayer.address]
            })
        ]);

        console.log("Alice代币:", formatEther(finalAliceTokens));
        console.log("Relayer代币:", formatEther(finalRelayerTokens));

        const aliceGain = finalAliceTokens - aliceTokens;
        const RelayerGain = finalRelayerTokens - RelayerTokens;

        console.log("\n🎯 变化:");
        console.log("Alice净获得:", formatEther(aliceGain), "代币");
        console.log("Relayer获得:", formatEther(RelayerGain), "代币");

        if (aliceGain === (MINT_AMOUNT - TRANSFER_AMOUNT) && RelayerGain === TRANSFER_AMOUNT) {
            console.log("\n🎉🎉🎉 成功! EIP-7702演示完成!");
            console.log("✨ Alice获得500代币，Relayer获得500代币");
            console.log("✨ Alice全程只签名，无需发送交易");
            console.log("✨ 一笔交易完成mint+transfer");
        }

        console.log(`\n🔍 查看交易: https://bscscan.com/tx/${batchTx}`);

        // 步骤7: 可选的取消授权 (恢复Alice为普通EOA)
        console.log("\n🔄 步骤7: 可选的取消授权 (将Alice恢复为普通EOA)");
        console.log("💡 这样Alice地址可以被重新用于其他EIP-7702授权");

        // Alice签名取消授权
        console.log("\n🚫 步骤7.1: Alice签名取消授权 (离线)");
        const finalCancelAuthorization = await aliceClient.signAuthorization({
            contractAddress: zeroAddress // 授权到零地址 = 取消授权
        });
        console.log("✅ Alice已签名取消授权");

        // Relayer发送取消授权交易
        console.log("\n📤 步骤7.2: Relayer发送取消授权交易");
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
