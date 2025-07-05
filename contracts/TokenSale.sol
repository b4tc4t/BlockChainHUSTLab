// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.20;

import "./Group2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenSale is Ownable, ReentrancyGuard {
    Group2 public token;
    uint256 public tokensSold; // Sẽ lưu số lượng token NGUYÊN đã bán
    uint256 public saleEndTime;

    uint256 public constant TOTAL_SALE_PERCENTAGE = 50; // 50% of total supply for sale
    uint256 public constant FIRST_TIER_PERCENTAGE = 25; // First 25% of total supply

    uint256 public firstTierPrice = 5 ether; // 5 ETH per token
    uint256 public secondTierPrice = 10 ether; // 10 ETH per token

    uint256 public totalTokensForSale; // Sẽ lưu tổng số token NGUYÊN để bán
    uint256 public firstTierLimit;     // Sẽ lưu giới hạn của Tier 1 bằng số token NGUYÊN

    event TokensPurchased(address indexed buyer, uint256 amountOfWholeTokens, uint256 cost);
    event SaleEnded(uint256 totalSoldWholeTokens, uint256 time);

    modifier saleActive() {
        require(block.timestamp < saleEndTime, "TokenSale: Sale has ended");
        require(tokensSold < totalTokensForSale, "TokenSale: All tokens for sale have been sold");
        _;
    }

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = Group2(tokenAddress);
        saleEndTime = block.timestamp + 30 days;

        uint256 _tokenDecimals = token.decimals();
        uint256 _totalSupplyBaseUnits = token.totalSupply();
        
        // Chuyển tổng cung sang đơn vị token nguyên để tính toán
        uint256 _totalSupplyWholeTokens = _totalSupplyBaseUnits / (10**_tokenDecimals);

        totalTokensForSale = (_totalSupplyWholeTokens * TOTAL_SALE_PERCENTAGE) / 100;
        firstTierLimit = (_totalSupplyWholeTokens * FIRST_TIER_PERCENTAGE) / 100;

        require(totalTokensForSale > 0, "TokenSale: No tokens available for sale");
    }

    function initializeSale() public onlyOwner {
        // totalTokensForSale giờ là số token nguyên, cần nhân với 10**decimals để so sánh với balance (đơn vị cơ sở)
        require(token.balanceOf(address(this)) >= (totalTokensForSale * (10**token.decimals())), "TokenSale: Insufficient token balance in sale contract");
    }

    // numberOfWholeTokens: là số lượng token nguyên mà người dùng muốn mua
    function buyTokens(uint256 numberOfWholeTokens) public payable saleActive nonReentrant {
        require(numberOfWholeTokens > 0, "TokenSale: Must buy at least one token");
        // tokensSold và totalTokensForSale giờ cùng đơn vị (token nguyên)
        require(tokensSold + numberOfWholeTokens <= totalTokensForSale, "TokenSale: Not enough tokens left for this purchase");

        uint256 cost;
        uint256 tokensInFirstTier = 0; // Số token nguyên ở tier 1
        uint256 tokensInSecondTier = 0; // Số token nguyên ở tier 2

        // tokensSold và firstTierLimit giờ cùng đơn vị (token nguyên)
        if (tokensSold < firstTierLimit) {
            if (tokensSold + numberOfWholeTokens <= firstTierLimit) {
                tokensInFirstTier = numberOfWholeTokens;
            } else {
                tokensInFirstTier = firstTierLimit - tokensSold;
                tokensInSecondTier = numberOfWholeTokens - tokensInFirstTier;
            }
        } else {
            tokensInSecondTier = numberOfWholeTokens;
        }

        // firstTierPrice và secondTierPrice là giá cho mỗi token NGUYÊN
        cost = (tokensInFirstTier * firstTierPrice) + (tokensInSecondTier * secondTierPrice);
        require(msg.value == cost, "TokenSale: Incorrect ETH amount sent"); // Dòng 70 (hoặc tương tự)

        tokensSold += numberOfWholeTokens; // Cập nhật số token NGUYÊN đã bán
        
        // Chuyển số token nguyên sang đơn vị cơ sở trước khi transfer
        token.transfer(msg.sender, numberOfWholeTokens * (10 ** token.decimals()));

        emit TokensPurchased(msg.sender, numberOfWholeTokens, msg.value);
    }

    // numberOfWholeTokens: là số lượng token nguyên muốn kiểm tra giá
    function getCurrentPrice(uint256 numberOfWholeTokens) public view returns (uint256) {
        if (block.timestamp >= saleEndTime || tokensSold >= totalTokensForSale) {
            return 0; // Sale not active or all tokens sold
        }
        // tokensSold và totalTokensForSale giờ cùng đơn vị (token nguyên)
        if (tokensSold + numberOfWholeTokens > totalTokensForSale) {
             // Không thể trả về lỗi ở view function, có thể trả về giá trị max hoặc 0 để báo hiệu
            return type(uint256).max; // Hoặc một cách báo lỗi khác phù hợp
        }


        uint256 cost;
        uint256 tokensInFirstTier = 0; // Số token nguyên ở tier 1
        uint256 tokensInSecondTier = 0; // Số token nguyên ở tier 2
        uint256 currentTokensSold = tokensSold; // Đã là số token nguyên

        // currentTokensSold và firstTierLimit giờ cùng đơn vị (token nguyên)
        if (currentTokensSold < firstTierLimit) {
            if (currentTokensSold + numberOfWholeTokens <= firstTierLimit) {
                tokensInFirstTier = numberOfWholeTokens;
            } else {
                tokensInFirstTier = firstTierLimit - currentTokensSold;
                tokensInSecondTier = numberOfWholeTokens - tokensInFirstTier;
            }
        } else {
            tokensInSecondTier = numberOfWholeTokens;
        }
        cost = (tokensInFirstTier * firstTierPrice) + (tokensInSecondTier * secondTierPrice);
        return cost;
    }

    function endSale() public onlyOwner {
        require(block.timestamp >= saleEndTime || tokensSold >= totalTokensForSale, "TokenSale: Sale cannot be ended yet");

        uint256 remainingTokensBaseUnits = token.balanceOf(address(this));
        if (remainingTokensBaseUnits > 0) {
            token.transfer(owner(), remainingTokensBaseUnits);
        }

        emit SaleEnded(tokensSold, block.timestamp); // tokensSold là số token nguyên

        // selfdestruct deprecated – simply end without it
    }

    function withdrawETH() public onlyOwner nonReentrant {
        payable(owner()).transfer(address(this).balance);
    }

    // Fallback function to receive ETH
    receive() external payable {}
}