async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying Group2 contract...");
    const Group2 = await ethers.getContractFactory("Group2");
    const group2 = await Group2.deploy(ethers.parseUnits("1000", 18)); // 1000 token
    await group2.waitForDeployment();
    console.log("Group2 deployed to:", group2.target);

    console.log("Deploying TokenSale contract...");
    const TokenSale = await ethers.getContractFactory("TokenSale");
    const tokenSale = await TokenSale.deploy(group2.target);
    await tokenSale.waitForDeployment();
    console.log("TokenSale deployed to:", tokenSale.target);

    console.log("Transferring tokens to TokenSale...");
    const totalSupply = await group2.totalSupply();
    const tokensForSale = totalSupply * 50n / 100n;
    await group2.transfer(tokenSale.target, tokensForSale);

    console.log("Initializing TokenSale...");
    await tokenSale.initializeSale();

    console.log("Deployment and initialization complete.");
}
