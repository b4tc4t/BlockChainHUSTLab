const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenSale contract", function () {
  let owner, buyer1, buyer2;
  let token, tokenSale;
  let totalSupplyBaseUnits; // Đổi tên để rõ ràng hơn
  let tokenDecimals;

  beforeEach(async function () {
    [owner, buyer1, buyer2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Group2");
    const initialSupply = ethers.parseUnits("1000", 18); // Đơn vị cơ sở
    token = await Token.deploy(initialSupply);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    tokenDecimals = await token.decimals(); // Lấy số decimals

    const TokenSale = await ethers.getContractFactory("TokenSale");
    tokenSale = await TokenSale.deploy(tokenAddress);
    await tokenSale.waitForDeployment();

    totalSupplyBaseUnits = await token.totalSupply(); // Đơn vị cơ sở

    // Chuyển token cho TokenSale contract (50% of total supply)
    // token.transfer nhận đơn vị cơ sở
    const tokensToTransferToSaleContract = totalSupplyBaseUnits / 2n;
    await token.transfer(await tokenSale.getAddress(), tokensToTransferToSaleContract);
    
    // Gọi initializeSale nếu nó cần thiết và chưa được gọi trong constructor của TokenSale
    // Ví dụ: await tokenSale.connect(owner).initializeSale();
  });

  it("should initialize sale with correct parameters", async function () {
    const totalTokensForSaleFromContract = await tokenSale.totalTokensForSale(); // Trả về số token nguyên
    const firstTierLimitFromContract = await tokenSale.firstTierLimit(); // Trả về số token nguyên

    const totalSupplyWholeTokens = totalSupplyBaseUnits / (10n ** tokenDecimals);
    const expectedTotalForSaleWhole = totalSupplyWholeTokens / 2n;
    const expectedFirstTierWhole = totalSupplyWholeTokens / 4n;

    expect(totalTokensForSaleFromContract).to.equal(expectedTotalForSaleWhole); // Dòng 33
    expect(firstTierLimitFromContract).to.equal(expectedFirstTierWhole);

    // Kiểm tra số dư của TokenSale contract (balanceOf trả về đơn vị cơ sở)
    const balanceInBaseUnits = await token.balanceOf(await tokenSale.getAddress());
    // totalTokensForSaleFromContract là số token nguyên, cần chuyển sang đơn vị cơ sở để so sánh
    expect(balanceInBaseUnits).to.equal(totalTokensForSaleFromContract * (10n ** tokenDecimals));
  });

  it("should allow buying tokens in first tier price", async function () {
    const tokensToBuyWhole = 10n; // Số token nguyên
    const firstTierPrice = await tokenSale.firstTierPrice(); // Giá cho mỗi token nguyên
    const cost = firstTierPrice * tokensToBuyWhole;

    await expect(
      tokenSale.connect(buyer1).buyTokens(tokensToBuyWhole, { value: cost })
    ).to.emit(tokenSale, "TokensPurchased").withArgs(
      await buyer1.getAddress(),
      tokensToBuyWhole, // Contract emit số token nguyên
      cost
    );

    const buyerBalanceBaseUnits = await token.balanceOf(await buyer1.getAddress());
    // So sánh với số token nguyên đã mua, chuyển sang đơn vị cơ sở
    expect(buyerBalanceBaseUnits).to.equal(tokensToBuyWhole * (10n ** tokenDecimals));
  });

  it("should charge correct price when crossing first tier to second tier", async function () {
    const firstTierPrice = ethers.parseEther("5");
    const secondTierPrice = ethers.parseEther("10");

    // Buy 245 tokens at first tier price
    const tokens245 = 245n;
    const cost245 = firstTierPrice * tokens245;
    await tokenSale.connect(buyer1).buyTokens(tokens245, { value: cost245 });

    // Buy 10 tokens crossing tier boundary: 5 tokens first tier, 5 tokens second tier
    const tokens10 = 10n;
    const tokens5 = 5n;
    // Instead of manual calculation, use contract's price calculation to avoid rounding/unit errors
    // const cost10 = await tokenSale.getCurrentPrice(tokens10);
    const cost10 = secondTierPrice * tokens5 + firstTierPrice * tokens5;


    await expect(
      tokenSale.connect(buyer2).buyTokens(tokens10, { value: cost10 })
    ).to.emit(tokenSale, "TokensPurchased").withArgs(
      await buyer2.getAddress(),
      tokens10,
      cost10
    );
  });

  it("should reject buying tokens with incorrect ETH amount", async function () {
    const tokensToBuy = 3n;
    const wrongCost = ethers.parseEther("1"); // too low

    await expect(
      tokenSale.connect(buyer1).buyTokens(tokensToBuy, { value: wrongCost })
    ).to.be.revertedWith("TokenSale: Incorrect ETH amount sent");
  });

  it("should not allow buying tokens after sale ended", async function () {
    const saleEndTime = await tokenSale.saleEndTime();
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(saleEndTime) + 1]);
    await ethers.provider.send("evm_mine");

    await expect(
      tokenSale.connect(buyer1).buyTokens(1n, { value: ethers.parseEther("5") })
    ).to.be.revertedWith("TokenSale: Sale has ended");
  });

  it("should allow owner to end sale and withdraw remaining tokens and ETH", async function () {
    // Send ETH to contract for withdraw test
    await buyer1.sendTransaction({ to: await tokenSale.getAddress(), value: ethers.parseEther("1") });

    const saleEndTime = await tokenSale.saleEndTime();
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(saleEndTime) + 1]);
    await ethers.provider.send("evm_mine");

    await expect(tokenSale.connect(owner).endSale()).to.emit(tokenSale, "SaleEnded");

    const ownerBalanceBefore = await ethers.provider.getBalance(await owner.getAddress());
    const tx = await tokenSale.connect(owner).withdrawETH();
    const receipt = await tx.wait();
    
    // console.log("receipt:", receipt);
    const gasUsed = BigInt(receipt.gasUsed) * BigInt(receipt.gasPrice);
    const ownerBalanceAfter = await ethers.provider.getBalance(await owner.getAddress());

    expect(ownerBalanceAfter > (ownerBalanceBefore - gasUsed)).to.be.true;
  });
});