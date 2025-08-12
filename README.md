```mermaid
sequenceDiagram
    participant Alice as "Alice (EOA)<br/>0x7099...79C8"
    participant Bob as "Bob (Sponsor)<br/>0x3C44...293BC"
    participant Implementation as "BatchCallAndSponsor<br/>Contract"
    participant Recipient as "Recipient Address<br/>makeAddr(recipient)"
    participant Blockchain as "EIP-7702<br/>Blockchain"

    Note over Alice, Blockchain: 赞助执行流程 (testSponsoredExecution)
    
    rect rgb(230, 250, 230)
        Note over Alice, Recipient: 1. 初始设置
        Alice->>Alice: 持有 10 ETH
        Note over Implementation: BatchCallAndSponsor 合约已部署
    end

    rect rgb(250, 240, 230)
        Note over Alice, Bob: 2. 准备批量调用
        Bob->>Bob: 创建 Call 结构体<br/>to: recipient<br/>value: 1 ether<br/>data: ""
        Bob->>Bob: 编码调用数据<br/>encodedCalls = abi.encodePacked(...)
    end

    rect rgb(240, 230, 250)
        Note over Alice, Implementation: 3. Alice 签名委托
        Alice->>Alice: 使用私钥签名委托<br/>vm.signDelegation(implementation, ALICE_PK)
        Alice-->>Bob: 返回 SignedDelegation
    end

    rect rgb(230, 240, 250)
        Note over Bob, Blockchain: 4. Bob 开始赞助执行
        Bob->>Blockchain: vm.startBroadcast(BOB_PK)
        Bob->>Blockchain: vm.attachDelegation(signedDelegation)
        Note over Alice: Alice 地址现在临时变成智能合约
        Alice->>Alice: 验证合约代码存在<br/>require(code.length > 0)
    end

    rect rgb(250, 230, 240)
        Note over Alice, Bob: 5. Alice 为执行签名
        Bob->>Alice: 获取当前 nonce
        Alice-->>Bob: 返回 nonce
        Bob->>Bob: 计算摘要<br/>digest = keccak256(nonce + encodedCalls)
        Alice->>Alice: 使用私钥签名摘要<br/>vm.sign(ALICE_PK, ethSignedMessageHash)
        Alice-->>Bob: 返回签名 (v, r, s)
        Bob->>Bob: 打包签名<br/>signature = abi.encodePacked(r, s, v)
    end

    rect rgb(240, 250, 240)
        Note over Bob, Recipient: 6. Bob 执行交易
        Bob->>Implementation: execute(calls, signature)
        
        Implementation->>Implementation: 重建编码调用数据
        Implementation->>Implementation: 计算摘要 = keccak256(nonce + encodedCalls)
        Implementation->>Implementation: 恢复签名者地址<br/>recovered = ECDSA.recover(ethSignedMessageHash, signature)
        Implementation->>Implementation: 验证签名者 == address(this) (Alice)
        
        Implementation->>Implementation: _executeBatch(calls)
        Implementation->>Implementation: currentNonce = nonce<br/>nonce++ (防重放攻击)
        
        loop 对每个调用
            Implementation->>Implementation: _executeCall(call)
            Implementation->>Recipient: call{value: 1 ether}("")
            Recipient->>Recipient: 接收 1 ETH
            Implementation->>Implementation: emit CallExecuted(BOB_ADDRESS, recipient, 1 ether, "")
        end
        
        Implementation->>Implementation: emit BatchExecuted(currentNonce, calls)
    end

    rect rgb(230, 250, 250)
        Note over Bob, Recipient: 7. 验证执行结果
        Bob->>Blockchain: vm.stopBroadcast()
        Bob->>Recipient: 检查余额
        Recipient-->>Bob: 确认收到 1 ETH
        Note over Alice, Recipient: ✅ 赞助执行成功完成!
    end

    Note over Alice, Blockchain: 关键特性:<br/>• Alice 授权但 Bob 支付 gas<br/>• 使用 nonce 防重放攻击<br/>• EIP-7702 临时代码委托<br/>• 签名验证确保安全性
```


# BatchCallAndSponsor

An educational project demonstrating account abstraction and sponsored transaction execution using EIP-7702. This project uses Foundry for deployment, scripting, and testing.

## Overview

The `BatchCallAndSponsor` contract enables batch execution of calls by verifying signatures over a nonce and batched call data. It supports:
- **Direct execution**: by the smart account itself.
- **Sponsored execution**: via an off-chain signature (by a sponsor).

Replay protection is provided by an internal nonce that increments after each batch execution.

## Features

- Batch transaction execution
- Off-chain signature verification using ECDSA
- Replay protection through nonce incrementation
- Support for both ETH and ERC-20 token transfers

## Prerequisites

- [Foundry](https://github.com/foundry-rs/foundry)
- Solidity ^0.8.20

## Running the Project

### Step 1: Install Foundry

```sh
curl -L https://foundry.paradigm.xyz | bash
git clone https://github.com/quiknode-labs/qn-guide-examples.git
cd qn-guide-examples/ethereum/eip-7702
```

### Step 2: Install Packages and Create the Remappings File

```sh
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
forge remappings > remappings.txt
```

### Step 3: Run a Local Network

Run the following command on your terminal to start a local network with the Prague hardfork. 

```bash
anvil --hardfork prague
```

### Step 4: Build the Contract

On another terminal, run the following command to build the contract.

```bash
forge build
```

### Step 5: Run the Test Cases

After building the contract, run the following command to run the test cases. If you want to display stack traces for all tests, use `-vvvv` flag instead of `-vvv`.

```bash
forge test -vvv
```

The output should look like this:

```bash
Ran 4 tests for test/BatchCallAndSponsor.t.sol:BatchCallAndSponsorTest
[PASS] testDirectExecution() (gas: 128386)
Logs:
  Sending 1 ETH from Alice to Bob and transferring 100 tokens to Bob in a single transaction

[PASS] testReplayAttack() (gas: 114337)
Logs:
  Test replay attack: Reusing the same signature should revert.

[PASS] testSponsoredExecution() (gas: 110461)
Logs:
  Sending 1 ETH from Alice to a random address while the transaction is sponsored by Bob

[PASS] testWrongSignature() (gas: 37077)
Logs:
  Test wrong signature: Execution should revert with 'Invalid signature'.

Suite result: ok. 4 passed; 0 failed; 0 skipped;
```

#### Step 6: Run the Script

Now that you’ve set up the project, it’s time to run the deployment script. This script deploys the contract, mints tokens, and tests both batch execution and sponsored execution features.

We use the following command:
- **`--broadcast`**: Broadcasts the transactions to your local network.
- **`--rpc-url 127.0.0.1:8545`**: Connects to your local network.
- **`--tc BatchCallAndSponsorScript`**: Specifies the target contract for the script.

```bash
forge script ./script/BatchCallAndSponsor.s.sol --tc BatchCallAndSponsorScript --broadcast --rpc-url 127.0.0.1:8545
```