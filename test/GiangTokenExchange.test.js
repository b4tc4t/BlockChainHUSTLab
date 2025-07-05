const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UserTokenExchange Contract", function () {
    let GiangToken, GiangToken, UserTokenExchange, userTokenExchange;
    let owner, addr1, addr2;
    let tokenDecimals; // To be populated in beforeEach

    // Constants for test setup and contract interaction
    const tokenName = "GiangToken";
    const tokenSymbol = "KHT";
    const INITIAL_PRICE_ETH_PER_TOKEN = 5n; // 5 ETH, contract uses this as base for wei conversion
    const RATE_BASE_DENOMINATOR = 100000n;   // Denominator for interest rate calculation in contract
    const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

    // Setup common to all tests in this suite: Deploy contracts
    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        GiangToken = await ethers.getContractFactory("GiangToken");
        GiangToken = await GiangToken.deploy(tokenName, tokenSymbol, owner.address);
        await GiangToken.waitForDeployment();
        tokenDecimals = await GiangToken.decimals(); // Fetch and store token decimals for calculations

        UserTokenExchange = await ethers.getContractFactory("UserTokenExchange");
        // Deploy exchange, providing token address, owner, and fetched token decimals
        userTokenExchange = await UserTokenExchange.deploy(GiangToken.target, owner.address, tokenDecimals);
        await userTokenExchange.waitForDeployment();
    });

    describe("Deployment and Initial Setup", function () {
        it("Should set the correct token address and owner for the exchange", async function () {
            expect(await userTokenExchange.GiangToken()).to.equal(GiangToken.target);
            expect(await userTokenExchange.owner()).to.equal(owner.address);
        });

        it("Should initialize with the correct starting price", async function () {
            const expectedPriceInWei = INITIAL_PRICE_ETH_PER_TOKEN * (10n ** 18n);
            expect(await userTokenExchange.currentTokenPrice()).to.equal(expectedPriceInWei);
        });

        it("Owner should be able to deposit ETH into the exchange", async function () {
            const depositAmount = ethers.parseEther("10");
            await expect(userTokenExchange.connect(owner).depositEthByOwner({ value: depositAmount }))
                .to.emit(userTokenExchange, "EthDepositedByOwner")
                .withArgs(owner.address, depositAmount);
            expect(await ethers.provider.getBalance(userTokenExchange.target)).to.equal(depositAmount);
        });

        it("Owner should be able to transfer tokens to the exchange", async function () {
            const amountToTransferWhole = 50000n;
            const amountToTransferBase = amountToTransferWhole * (10n ** tokenDecimals);
            
            await GiangToken.connect(owner).transfer(userTokenExchange.target, amountToTransferBase);
            expect(await GiangToken.balanceOf(userTokenExchange.target)).to.equal(amountToTransferBase);
        });
    });

    describe("Price Calculation", function () {
        // Setup for price calculation tests: Pre-fund exchange with ETH
        beforeEach(async function() {
            await userTokenExchange.connect(owner).depositEthByOwner({ value: ethers.parseEther("100") }); // 100 ETH for rate base
        });

        it("Should return current price if no time has passed", async function () {
            const price = await userTokenExchange.getCurrentCalculatedPrice();
            const expectedInitialPriceInWei = INITIAL_PRICE_ETH_PER_TOKEN * (10n ** 18n);
            expect(price).to.equal(expectedInitialPriceInWei);
        });

        it("Should calculate increased price after one day", async function () {
            const P0_wei = await userTokenExchange.currentTokenPrice(); 
            const B0_balance_wei = await ethers.provider.getBalance(userTokenExchange.target); 
            const B0_units = B0_balance_wei / (10n**18n); 

            const R_const = RATE_BASE_DENOMINATOR;
            const E_const = 10n**18n; // 1 Ether in wei
            const tokensToTriggerUpdateWhole = 1n;

            // Simulate passage of one day
            await ethers.provider.send("evm_increaseTime", [ONE_DAY_IN_SECONDS]);
            await ethers.provider.send("evm_mine");
            
            // Iteratively determine the correct ETH amount (costForTrigger) to send.
            // This is needed because the contract's price update logic uses `address(this).balance`,
            // which includes the `msg.value` of the current transaction.
            let preliminaryExpectedNewPrice = (P0_wei * (R_const + B0_units)) / R_const;
            let costForTrigger = tokensToTriggerUpdateWhole * preliminaryExpectedNewPrice;
            let finalConvergedPrice;

            for (let i = 0; i < 5; i++) { // Iterate to find a stable cost
                const ethBalanceForRateWithGuess = B0_balance_wei + costForTrigger;
                const ethUnitsWithGuess = ethBalanceForRateWithGuess / E_const; 
                
                finalConvergedPrice = (P0_wei * (R_const + ethUnitsWithGuess)) / R_const;
                const nextCostGuess = tokensToTriggerUpdateWhole * finalConvergedPrice;

                if (nextCostGuess === costForTrigger) {
                    break; // Cost has converged
                }
                costForTrigger = nextCostGuess;
                if (i === 4) { // Log if convergence is not perfect after max iterations
                    console.warn("Cost iteration for price test did not converge perfectly, using last value.");
                }
            }
            
            // Ensure the exchange has tokens for the buy attempt that triggers the price update
            const tokensToTriggerUpdateBase = tokensToTriggerUpdateWhole * (10n ** tokenDecimals);
            await GiangToken.connect(owner).transfer(userTokenExchange.target, tokensToTriggerUpdateBase);

            // Perform the buy operation, which will internally call _updatePrice
            await userTokenExchange.connect(addr1).buyTokens(tokensToTriggerUpdateWhole, {value: costForTrigger });
            
            // Verify that the contract's stored currentTokenPrice matches the converged price
            expect(await userTokenExchange.currentTokenPrice()).to.equal(finalConvergedPrice);
        });
    });

    describe("Buying Tokens", function () {
        const tokensForSaleWhole = 100n;
        let tokensForSaleBase; 
        const initialExchangeEth = ethers.parseEther("20"); 

        // Setup for buying tests: Fund exchange with ETH and tokens
        beforeEach(async function () {
            tokensForSaleBase = tokensForSaleWhole * (10n ** tokenDecimals);

            await userTokenExchange.connect(owner).depositEthByOwner({ value: initialExchangeEth });
            await GiangToken.connect(owner).transfer(userTokenExchange.target, tokensForSaleBase);
        });

        it("Should allow a user to buy tokens", async function () {
            const tokensToBuyWhole = 2n;
            const currentPrice = await userTokenExchange.currentTokenPrice();
            const cost = tokensToBuyWhole * currentPrice;

            const initialBuyerEthBalance = await ethers.provider.getBalance(addr1.address);
            const initialExchangeTokenBalance = await GiangToken.balanceOf(userTokenExchange.target);

            await expect(userTokenExchange.connect(addr1).buyTokens(tokensToBuyWhole, { value: cost }))
                .to.emit(userTokenExchange, "TokensBought")
                .withArgs(addr1.address, tokensToBuyWhole, cost);

            expect(await GiangToken.balanceOf(addr1.address)).to.equal(tokensToBuyWhole * (10n ** tokenDecimals));
            expect(await GiangToken.balanceOf(userTokenExchange.target)).to.equal(initialExchangeTokenBalance - (tokensToBuyWhole * (10n ** tokenDecimals)));
            expect(await ethers.provider.getBalance(userTokenExchange.target)).to.equal(initialExchangeEth + cost);
            // Buyer's ETH balance check, accounting for gas costs
            expect(await ethers.provider.getBalance(addr1.address)).to.be.closeTo(initialBuyerEthBalance - cost, ethers.parseEther("0.01"));
        });

        it("Should fail if incorrect ETH amount is sent", async function () {
            const tokensToBuyWhole = 1n;
            const wrongCost = ethers.parseEther("1"); // Intentionally incorrect amount
            await expect(
                userTokenExchange.connect(addr1).buyTokens(tokensToBuyWhole, { value: wrongCost })
            ).to.be.revertedWith("Incorrect ETH sent for purchase");
        });

        it("Should fail if exchange is out of tokens", async function () {
            const tokensToBuyWhole = tokensForSaleWhole + 1n; // Attempt to buy more than available
            const currentPrice = await userTokenExchange.currentTokenPrice();
            const cost = tokensToBuyWhole * currentPrice;
            await expect(
                userTokenExchange.connect(addr1).buyTokens(tokensToBuyWhole, { value: cost })
            ).to.be.revertedWith("Exchange out of tokens");
        });
    });

    describe("Selling Tokens", function () {
        const tokensToSellWhole = 2n;
        let tokensToSellBase; 
        const buyerInitialTokensWhole = 5n; // Tokens addr1 will buy first to then sell
        let buyerInitialTokensBase; 
        const exchangeInitialEth = ethers.parseEther("50"); // Sufficient ETH for buyback

        // Setup for selling tests:
        // 1. Fund exchange with ETH.
        // 2. Provide exchange with tokens.
        // 3. Have addr1 buy tokens from the exchange.
        // 4. addr1 approves the exchange to spend these tokens.
        beforeEach(async function () {
            tokensToSellBase = tokensToSellWhole * (10n ** tokenDecimals);
            buyerInitialTokensBase = buyerInitialTokensWhole * (10n ** tokenDecimals);

            await userTokenExchange.connect(owner).depositEthByOwner({ value: exchangeInitialEth });
            await GiangToken.connect(owner).transfer(userTokenExchange.target, buyerInitialTokensBase);
            
            const price = await userTokenExchange.currentTokenPrice();
            const costForBuyer = buyerInitialTokensWhole * price;
            await userTokenExchange.connect(addr1).buyTokens(buyerInitialTokensWhole, { value: costForBuyer });
            
            await GiangToken.connect(addr1).approve(userTokenExchange.target, tokensToSellBase);
        });

        it("Should allow a user to sell tokens", async function () {
            // Price might have been updated by addr1's earlier buy operation
            const currentPrice = await userTokenExchange.currentTokenPrice(); 
            const ethToReceive = tokensToSellWhole * currentPrice;

            const initialSellerEthBalance = await ethers.provider.getBalance(addr1.address);
            const initialExchangeTokenBalance = await GiangToken.balanceOf(userTokenExchange.target);
            const initialSellerTokenBalance = await GiangToken.balanceOf(addr1.address);

            await expect(userTokenExchange.connect(addr1).sellTokens(tokensToSellWhole))
                .to.emit(userTokenExchange, "TokensSold")
                .withArgs(addr1.address, tokensToSellWhole, ethToReceive);

            expect(await GiangToken.balanceOf(addr1.address)).to.equal(initialSellerTokenBalance - tokensToSellBase);
            expect(await GiangToken.balanceOf(userTokenExchange.target)).to.equal(initialExchangeTokenBalance + tokensToSellBase);
            expect(await ethers.provider.getBalance(addr1.address)).to.be.closeTo(initialSellerEthBalance + ethToReceive, ethers.parseEther("0.01"));
            // Exchange ETH balance reflects: initial ETH - ETH paid for this sell + ETH received from addr1's initial buy
            const ethFromAddr1InitialBuy = buyerInitialTokensWhole * (await userTokenExchange.currentTokenPrice()); // Price might have changed again
            expect(await ethers.provider.getBalance(userTokenExchange.target)).to.equal(exchangeInitialEth - ethToReceive + ethFromAddr1InitialBuy);
        });

        it("Should fail if user has not approved tokens", async function () {
            // addr2 attempts to sell tokens without prior approval
            await GiangToken.connect(owner).transfer(addr2.address, tokensToSellBase); // Give addr2 tokens
            await expect(
                userTokenExchange.connect(addr2).sellTokens(tokensToSellWhole)
            ).to.be.reverted; // Expected ERC20: insufficient allowance
        });

        it("Should fail if exchange has insufficient ETH for buyback", async function () {
            // Owner withdraws most ETH, leaving insufficient funds for buyback
            const currentExchangeEth = await ethers.provider.getBalance(userTokenExchange.target);
            if (currentExchangeEth > 0) { 
                const amountToLeave = ethers.parseUnits("1", "gwei"); // Leave a negligible amount
                if (currentExchangeEth > amountToLeave) {
                    await userTokenExchange.connect(owner).withdrawEthByOwner(currentExchangeEth - amountToLeave);
                }
            }
            
            // Ensure addr1 still has tokens and approval (though they might have sold some already if tests run in sequence without clean state)
            // For robustness, re-ensure addr1 has tokens and approval for this specific test case.
            const freshTokensForAddr1 = tokensToSellWhole * (10n ** tokenDecimals);
            await GiangToken.connect(owner).transfer(addr1.address, freshTokensForAddr1); 
            await GiangToken.connect(addr1).approve(userTokenExchange.target, freshTokensForAddr1);

            await expect(
                userTokenExchange.connect(addr1).sellTokens(tokensToSellWhole)
            ).to.be.revertedWith("Exchange has insufficient ETH for buyback");
        });
    });

    describe("Owner Functions", function () {
        it("Should allow owner to withdraw ETH", async function () {
            const depositAmount = ethers.parseEther("5");
            await userTokenExchange.connect(owner).depositEthByOwner({ value: depositAmount });

            const ownerInitialEth = await ethers.provider.getBalance(owner.address);
            const withdrawAmount = ethers.parseEther("2");

            const tx = await userTokenExchange.connect(owner).withdrawEthByOwner(withdrawAmount);
            await expect(tx).to.emit(userTokenExchange, "EthWithdrawnByOwner").withArgs(owner.address, withdrawAmount);
            
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;

            expect(await ethers.provider.getBalance(userTokenExchange.target)).to.equal(depositAmount - withdrawAmount);
            expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerInitialEth - gasUsed + withdrawAmount);
        });

        it("Should not allow non-owner to withdraw ETH", async function () {
            const depositAmount = ethers.parseEther("5");
            await userTokenExchange.connect(owner).depositEthByOwner({ value: depositAmount });
            await expect(
                userTokenExchange.connect(addr1).withdrawEthByOwner(ethers.parseEther("1"))
            ).to.be.revertedWithCustomError(userTokenExchange, "OwnableUnauthorizedAccount").withArgs(addr1.address);
        });
    });
});