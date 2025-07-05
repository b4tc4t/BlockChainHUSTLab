# Project: ERC20 Token (GiangToken) and Exchange (UserTokenExchange) - Lab 3

## Project Description

This project involves the creation of a custom ERC20-compliant token named `GiangToken` (symbol `KHT`) and a separate Smart Contract, `UserTokenExchange`, to facilitate the buying and selling of `GiangToken` using ETH.

*   The token contract ([`contracts/GiangToken.sol`](contracts/GiangToken.sol)) adheres to the [ERC-20 Token Standard (EIP-20)](https://eips.ethereum.org/EIPS/eip-20).
*   The exchange contract ([`contracts/GiangTokenExchange.sol`](contracts/GiangTokenExchange.sol), which defines `UserTokenExchange`) allows users to buy `GiangToken` by sending ETH and sell their `GiangToken` back to the exchange to receive ETH. The price of the token is dynamic and updates based on a predefined interest rate mechanism.

## Key Information

### 1. ERC20 Token: `GiangToken.sol`

*   **Token Name**: `GiangToken` (configurable in deployment script, e.g., "GiangToken")
*   **Token Symbol**: `KHT` (configurable in deployment script, e.g., "KHT")
*   **Total Supply**: 100,000 whole tokens (10^5). The actual amount minted includes decimals.
*   **Owner**: The Ethereum address deploying the [`GiangToken`](contracts/GiangToken.sol) contract becomes the initial owner and receives the total supply.
*   **Decimals**: 18 (standard for ERC20 tokens).

### 2. Token Exchange Contract: `UserTokenExchange` (defined in `GiangTokenExchange.sol`)

*   **Token Traded**: `GiangToken`.
*   **Pricing Mechanism**:
    *   **Initial Price**: 5 ETH per `GiangToken`.
    *   **Price Update**: The price of `GiangToken` increases daily. The rate of increase is calculated as:
        `InterestRate = Current ETH in exchange wallet (in whole ETH units) / RATE_BASE_DENOMINATOR`
        Where `RATE_BASE_DENOMINATOR` is a constant (e.g., 100,000).
        The new price is `CurrentPrice * (1 + InterestRate)`. This calculation is performed for each day that has passed since the last price update.
*   **Buying Tokens**: Users can buy `GiangToken` by sending the required amount of ETH to the [`buyTokens`](test/GiangTokenExchange.test.js) function.
*   **Selling Tokens**: Users can sell their `GiangToken` back to the exchange by first approving the exchange contract to spend their tokens, and then calling the [`sellTokens`](test/GiangTokenExchange.test.js) function. They will receive ETH based on the current token price.
*   **Owner Functions**:
    *   [`depositEthByOwner()`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json): Allows the owner of the exchange contract to deposit ETH, providing liquidity.
    *   [`withdrawEthByOwner(uint256 amountInWei)`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json): Allows the owner to withdraw a specified amount of ETH from the exchange contract.
*   **Reentrancy Guard**: Functions involving ETH transfers are protected against reentrancy attacks.

### 3. Directory Structure and Key Files

*   [`contracts/GiangToken.sol`](contracts/GiangToken.sol): Solidity source code for the `GiangToken` ERC20 token.
*   [`contracts/GiangTokenExchange.sol`](contracts/GiangTokenExchange.sol): Solidity source code for the `UserTokenExchange` contract.
*   [`scripts/deployGiangToken.js`](scripts/deployGiangToken.js): Hardhat script to deploy both `GiangToken` and `UserTokenExchange` contracts and perform initial setup.
*   [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js): Hardhat tests for the `UserTokenExchange` contract.
*   [`hardhat.config.js`](hardhat.config.js): Hardhat configuration file.
*   [`.env`](.env): File for environment variables. **Not committed to Git.**
*   [`package.json`](package.json): Project dependencies and scripts.
*   `artifacts/`: Compiled contract ABIs and bytecodes.
*   `cache/`: Hardhat's cache.

## Setup, Running, and Deployment Guide

### 1. Prerequisites

*   **Node.js**: Version 16.x or higher.
*   **npm (Node Package Manager)**.

### 2. Install Dependencies

```sh
npm install
```

### 3. Configure Environment Variables (Optional for Local Development)

Create a [`.env`](.env) file in the project root:
```
// filepath: .env
PRIVATE_KEY=YOUR_ETHEREUM_ACCOUNT_PRIVATE_KEY
SEPOLIA_RPC_URL=YOUR_SEPOLIA_RPC_ENDPOINT_URL
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

### 4. Running a Local Hardhat Node

```sh
npx hardhat node
```

### 5. Deploying Contracts

**a. Deploying to Hardhat Local Network:**
```sh
npx hardhat run scripts/deployGiangToken.js --network localhost
```
Or if not running a separate node:
```sh
npx hardhat run scripts/deployGiangToken.js
```

**b. Deploying to a Public Testnet (e.g., Sepolia):**
```sh
npx hardhat run scripts/deployGiangToken.js --network sepolia
```

## Testing the `UserTokenExchange` Contract

The tests for the `UserTokenExchange` contract are located in [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js). These tests cover various functionalities of the exchange.

**To run all tests for the `UserTokenExchange` contract:**
```sh
npx hardhat test test/GiangTokenExchange.test.js
```

Below is an explanation of what each test suite does:

### 1. Deployment and Initial Setup

*   **What it tests**: Verifies the correct deployment and initialization of the [`UserTokenExchange`](test/GiangTokenExchange.test.js) contract.
*   **Actions & Expected Changes**:
    *   **Test**: "Should set the correct token address and owner for the exchange"
        *   **Action**: Checks the stored [`GiangToken`](test/GiangTokenExchange.test.js) address and the [`owner`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) of the exchange contract after deployment.
        *   **Changes**: Asserts that `userTokenExchange.GiangToken()` equals the deployed [`GiangToken`](scripts/deployGiangToken.js) address and `userTokenExchange.owner()` equals the deployer's address.
    *   **Test**: "Should initialize with the correct starting price"
        *   **Action**: Checks the [`currentTokenPrice`](test/GiangTokenExchange.test.js) immediately after deployment.
        *   **Changes**: Asserts that `userTokenExchange.currentTokenPrice()` is 5 ETH (converted to wei).
    *   **Test**: "Owner should be able to deposit ETH into the exchange"
        *   **Action**: The owner calls [`depositEthByOwner()`](test/GiangTokenExchange.test.js) with a specific ETH amount.
        *   **Changes**:
            *   [`EthDepositedByOwner`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) event is emitted with the owner's address and the deposited amount.
            *   The ETH balance of the [`userTokenExchange`](test/GiangTokenExchange.test.js) contract increases by the deposited amount.
    *   **Test**: "Owner should be able to transfer tokens to the exchange"
        *   **Action**: The owner (who also owns all [`GiangToken`](test/GiangTokenExchange.test.js)s initially) transfers a specified amount of [`GiangToken`](test/GiangTokenExchange.test.js)s to the [`userTokenExchange`](test/GiangTokenExchange.test.js) contract.
        *   **Changes**: The [`GiangToken`](test/GiangTokenExchange.test.js) balance of the [`userTokenExchange`](test/GiangTokenExchange.test.js) contract increases by the transferred amount.

### 2. Price Calculation

*   **What it tests**: Verifies the dynamic price calculation mechanism.
*   **Setup**: Before these tests, the exchange is pre-funded with 100 ETH by the owner (as seen in [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js)) to ensure the interest rate calculation has a non-zero ETH balance.
*   **Actions & Expected Changes**:
    *   **Test**: "Should return current price if no time has passed"
        *   **Action**: Calls [`getCurrentCalculatedPrice()`](test/GiangTokenExchange.test.js) immediately after setup (no time advanced).
        *   **Changes**: Asserts that the returned price is still the initial price (5 ETH in wei).
    *   **Test**: "Should calculate increased price after one day"
        *   **Action**:
            1.  Advances blockchain time by one day using `ethers.provider.send("evm_increaseTime", ...)`.
            2.  An iterative calculation in the test determines the `costForTrigger` for a [`buyTokens`](test/GiangTokenExchange.test.js) call. This iterative step is necessary because the contract's `_updatePrice` function uses `address(this).balance` (which includes the `msg.value` of the current transaction) for its calculation.
            3.  `addr1` calls [`buyTokens(tokensToTriggerUpdateWhole, {value: costForTrigger })`](test/GiangTokenExchange.test.js) to trigger the internal `_updatePrice()` function.
        *   **Changes**:
            *   The `finalConvergedPrice` (calculated iteratively in the test to match the contract's internal logic) is the new expected price.
            *   After the [`buyTokens`](test/GiangTokenExchange.test.js) call, `userTokenExchange.currentTokenPrice()` (the stored price) updates to this `finalConvergedPrice`.
            *   [`PriceUpdated`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) event is emitted by the `_updatePrice` function.

### 3. Buying Tokens

*   **What it tests**: Verifies the token purchasing functionality.
*   **Setup**: Before these tests (in [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js)), the owner deposits ETH (e.g., 20 ETH) and transfers [`GiangToken`](test/GiangTokenExchange.test.js)s (e.g., 100 whole tokens) to the exchange.
*   **Actions & Expected Changes**:
    *   **Test**: "Should allow a user to buy tokens"
        *   **Action**: `addr1` calls [`buyTokens()`](test/GiangTokenExchange.test.js) with the correct amount of ETH for a specified number of tokens.
        *   **Changes**:
            *   [`TokensBought`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) event is emitted with `addr1`'s address, the number of whole tokens bought, and the ETH cost.
            *   `addr1`'s [`GiangToken`](test/GiangTokenExchange.test.js) balance increases.
            *   [`userTokenExchange`](test/GiangTokenExchange.test.js)'s [`GiangToken`](test/GiangTokenExchange.test.js) balance decreases.
            *   [`userTokenExchange`](test/GiangTokenExchange.test.js)'s ETH balance increases by the cost.
            *   `addr1`'s ETH balance decreases by the cost (plus gas).
    *   **Test**: "Should fail if incorrect ETH amount is sent"
        *   **Action**: `addr1` calls [`buyTokens()`](test/GiangTokenExchange.test.js) but sends an ETH amount different from the required cost.
        *   **Changes**: The transaction reverts with the error "Incorrect ETH sent for purchase".
    *   **Test**: "Should fail if exchange is out of tokens"
        *   **Action**: `addr1` attempts to buy more tokens than the exchange holds.
        *   **Changes**: The transaction reverts with the error "Exchange out of tokens".

### 4. Selling Tokens

*   **What it tests**: Verifies the token selling functionality.
*   **Setup**: As detailed in [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js):
    1.  The exchange is funded with ETH by the owner (e.g., 50 ETH, as seen with `exchangeInitialEth` in the tests).
    2.  The owner transfers [`GiangToken`](test/GiangTokenExchange.test.js)s to the exchange (e.g., `buyerInitialTokensBase`, which `addr1` will subsequently buy).
    3.  `addr1` buys some [`GiangToken`](test/GiangTokenExchange.test.js)s from the exchange to have tokens to sell (e.g., `buyerInitialTokensWhole`).
    4.  `addr1` approves the [`userTokenExchange`](test/GiangTokenExchange.test.js) contract to spend a specific amount of their [`GiangToken`](test/GiangTokenExchange.test.js)s (e.g., `tokensToSellBase`, corresponding to `tokensToSellWhole` which is 2 whole tokens in the test setup).
*   **Actions & Expected Changes**:
    *   **Test**: "Should allow a user to sell tokens"
        *   **Action**: `addr1` calls [`sellTokens()`](test/GiangTokenExchange.test.js) for the specified number of their approved tokens (`tokensToSellWhole`).
        *   **Changes**:
            *   [`TokensSold`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) event is emitted with `addr1`'s address, the number of whole tokens sold, and the ETH received.
            *   `addr1`'s [`GiangToken`](test/GiangTokenExchange.test.js) balance decreases by the amount sold.
            *   [`userTokenExchange`](test/GiangTokenExchange.test.js)'s [`GiangToken`](test/GiangTokenExchange.test.js) balance increases by the amount sold.
            *   [`userTokenExchange`](test/GiangTokenExchange.test.js)'s ETH balance decreases by the ETH paid out.
            *   `addr1`'s ETH balance increases by the ETH received (minus gas costs).
    *   **Test**: "Should fail if user has not approved tokens" (as seen in `test/GiangTokenExchange.test.js`)
        *   **Action**: `addr2` (who is given tokens but has made no prior approval) attempts to call [`sellTokens()`](test/GiangTokenExchange.test.js).
        *   **Changes**: The transaction reverts, typically with an "ERC20: insufficient allowance" error from the token contract (as `transferFrom` would fail due to lack of allowance).
    *   **Test**: "Should fail if exchange has insufficient ETH for buyback"
        *   **Action**: `addr1` attempts to sell tokens, but the exchange does not have enough ETH to cover the sale (e.g., after the owner withdraws most ETH).
        *   **Changes**: The transaction reverts with the error "Exchange has insufficient ETH for buyback" (as seen in [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js)).

### 5. Owner Functions

*   **What it tests**: Verifies owner-specific functionalities like depositing and withdrawing ETH.
*   **Actions & Expected Changes**:
    *   **Test**: "Should allow owner to withdraw ETH"
        *   **Setup**: Owner deposits ETH into the exchange (e.g., 5 ETH).
        *   **Action**: Owner calls [`withdrawEthByOwner(amount)`](test/GiangTokenExchange.test.js) to withdraw a portion of the deposited ETH (e.g., 2 ETH).
        *   **Changes**:
            *   [`EthWithdrawnByOwner`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) event is emitted with the owner's address and the withdrawn amount.
            *   The ETH balance of the [`userTokenExchange`](test/GiangTokenExchange.test.js) contract decreases by the withdrawn amount.
            *   The owner's ETH balance increases by the withdrawn amount (minus gas costs).
    *   **Test**: "Should not allow non-owner to withdraw ETH" (test name from `test/GiangTokenExchange.test.js`)
        *   **Action**: `addr1` (a non-owner) attempts to call [`withdrawEthByOwner()`](test/GiangTokenExchange.test.js).
        *   **Changes**: The transaction reverts with the custom error `OwnableUnauthorizedAccount` (from OpenZeppelin's Ownable contract), with `addr1.address` as the argument.
    *   **Test**: "Owner should be able to deposit ETH into the exchange" (This is covered in the "Deployment and Initial Setup" tests in [`test/GiangTokenExchange.test.js`](test/GiangTokenExchange.test.js) and can be re-verified here if needed)
        *   **Action**: The owner calls [`depositEthByOwner()`](test/GiangTokenExchange.test.js) with a specific ETH amount.
        *   **Changes**:
            *   [`EthDepositedByOwner`](artifacts/contracts/GiangTokenExchange.sol/UserTokenExchange.json) event is emitted.
            *   The ETH balance of the [`userTokenExchange`](test/GiangTokenExchange.test.js) contract increases.
    *   **Test**: "Should fail if non-owner tries to deposit ETH via owner function"
        *   **Action**: `addr1` (a non-owner) attempts to call [`depositEthByOwner()`](test/GiangTokenExchange.test.js).
        *   **Changes**: The transaction reverts.

### 6. Reentrancy Attack Prevention (Conceptual)

*   **What it tests**: While direct reentrancy attack tests can be complex to perfectly simulate in unit tests without specific malicious contracts, the presence and correct usage of OpenZeppelin's `ReentrancyGuard` (or a similar mechanism) in functions like `buyTokens` and `sellTokens` is the primary check.
*   **Verification**:
    *   Code review confirms that state changes (e.g., balance updates) happen *before* external calls (ETH transfers).
    *   Functions performing external calls are marked with the `nonReentrant` modifier.
    *   Tests for `buyTokens` and `sellTokens` implicitly cover non-reentrant behavior under normal conditions. If a reentrancy vulnerability existed and was easily triggerable, these standard tests might fail unexpectedly or allow inconsistent states.