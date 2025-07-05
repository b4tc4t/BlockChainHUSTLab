const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const tokenName = "GiangToken";
    const tokenSymbol = "KHT";
    const initialEthDepositToExchange = ethers.parseUnits("10", "ether");
    const tokensToTransferToExchangeWhole = 50000n;

    console.log(`Deploying contracts with the account: ${deployer.address}`);
    console.log(`Account balance: ${(await ethers.provider.getBalance(deployer.address)).toString()}`);
    console.log("---");

    // 1. Deploy GiangToken
    console.log(`Deploying ${tokenName} (${tokenSymbol})...`);
    const GiangTokenFactory = await ethers.getContractFactory("GiangToken");
    const GiangToken = await GiangTokenFactory.deploy(tokenName, tokenSymbol, deployer.address);
    await GiangToken.waitForDeployment();
    console.log(`${tokenName} deployed to: ${GiangToken.target}`);

    const tokenDecimals = await GiangToken.decimals(); // Fetching decimals from GiangToken
    console.log(`${tokenName} decimals: ${tokenDecimals.toString()}`);
    const deployerTokenBalance = await GiangToken.balanceOf(deployer.address);
    console.log(`Deployer's initial ${tokenName} balance: ${ethers.formatUnits(deployerTokenBalance, tokenDecimals)} ${tokenSymbol}`);
    console.log("---");

    // 2. Deploy UserTokenExchange (from GiangTokenExxchange.sol)
    const exchangeContractName = "UserTokenExchange";
    console.log(`Deploying ${exchangeContractName}...`);
    const UserTokenExchangeFactory = await ethers.getContractFactory(exchangeContractName);
    // Constructor: constructor(address tokenAddress, address initialExchangeOwner, uint8 _tokenDecimals)
    const userTokenExchange = await UserTokenExchangeFactory.deploy(
        GiangToken.target,
        deployer.address,
        tokenDecimals // Pass the fetched tokenDecimals as the third argument
    );
    await userTokenExchange.waitForDeployment();
    console.log(`${exchangeContractName} deployed to: ${userTokenExchange.target}`);
    console.log(`Initial ${exchangeContractName} ETH balance: ${(await ethers.provider.getBalance(userTokenExchange.target)).toString()}`);
    console.log("---");

    // 3. Deployer deposits ETH into UserTokenExchange
    console.log(`Depositing ${ethers.formatEther(initialEthDepositToExchange)} ETH from deployer to ${exchangeContractName}...`);
    const depositTx = await userTokenExchange.connect(deployer).depositEthByOwner({ value: initialEthDepositToExchange });
    await depositTx.wait();
    console.log(`ETH deposited. New ${exchangeContractName} ETH balance: ${(await ethers.provider.getBalance(userTokenExchange.target)).toString()}`);
    console.log("---");

    // 4. Deployer transfers GiangTokens to UserTokenExchange
    const tokensToTransferBaseUnits = tokensToTransferToExchangeWhole * (10n ** tokenDecimals);
    console.log(`Transferring ${tokensToTransferToExchangeWhole.toString()} ${tokenSymbol} (base units: ${tokensToTransferBaseUnits.toString()}) from deployer to ${exchangeContractName}...`);
    const transferTx = await GiangToken.connect(deployer).transfer(userTokenExchange.target, tokensToTransferBaseUnits);
    await transferTx.wait();
    const exchangeTokenBalance = await GiangToken.balanceOf(userTokenExchange.target);
    console.log(`${exchangeContractName} ${tokenSymbol} balance: ${ethers.formatUnits(exchangeTokenBalance, tokenDecimals)} ${tokenSymbol}`);
    const deployerTokenBalanceAfterTransfer = await GiangToken.balanceOf(deployer.address);
    console.log(`Deployer's ${tokenSymbol} balance after transfer: ${ethers.formatUnits(deployerTokenBalanceAfterTransfer, tokenDecimals)} ${tokenSymbol}`);
    console.log("---");

    console.log("Deployment and initial setup complete!");
    console.log(`${tokenName} address: ${GiangToken.target}`);
    console.log(`${exchangeContractName} address: ${userTokenExchange.target}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});