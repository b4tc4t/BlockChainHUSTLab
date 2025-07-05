// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UserTokenExchange is Ownable, ReentrancyGuard {
    IERC20 public immutable GiangToken;
    uint8 public immutable tokenDecimals; // Decimals of the GiangToken
    uint256 public currentTokenPrice; // Price in wei per whole GiangToken
    uint256 public lastPriceUpdateTime; // Timestamp of the last price update

    // Configuration constants for token pricing
    uint256 private constant INITIAL_PRICE_ETH_PER_TOKEN = 5; // Initial price: 5 ETH per token
    uint256 private constant RATE_BASE_DENOMINATOR = 100000;  // Denominator for daily interest rate calculation
    uint256 private constant ONE_ETHER = 1 ether;             // Utility constant for 1 ETH in wei
    uint256 private constant ONE_DAY_IN_SECONDS = 1 days;     // Utility constant for one day

    // Events
    event TokensBought(address indexed buyer, uint256 amountWholeTokens, uint256 costInWei);
    event TokensSold(address indexed seller, uint256 amountWholeTokens, uint256 ethReceivedInWei);
    event EthDepositedByOwner(address indexed owner, uint256 amountInWei);
    event EthWithdrawnByOwner(address indexed owner, uint256 amountInWei);
    event PriceUpdated(uint256 newPriceInWei, uint256 timestamp);

    constructor(address tokenAddress, address initialExchangeOwner, uint8 _tokenDecimals) Ownable(initialExchangeOwner) {
        GiangToken = IERC20(tokenAddress);
        tokenDecimals = _tokenDecimals;
        currentTokenPrice = INITIAL_PRICE_ETH_PER_TOKEN * ONE_ETHER;
        lastPriceUpdateTime = block.timestamp;
        emit PriceUpdated(currentTokenPrice, lastPriceUpdateTime);
    }

    function _updatePrice() internal returns (uint256) {
        uint256 daysPassed = (block.timestamp - lastPriceUpdateTime) / ONE_DAY_IN_SECONDS;

        if (daysPassed > 0) {
            uint256 ethBalanceForRate = address(this).balance; // Includes msg.value of current tx
            uint256 ethBalanceInUnits = ethBalanceForRate / ONE_ETHER;

            // Cap daysPassed to prevent excessive gas usage in the loop (e.g., max 10 years).
            if (daysPassed > 3650) {
                daysPassed = 3650;
            }

            for (uint i = 0; i < daysPassed; i++) {
                currentTokenPrice = (currentTokenPrice * (RATE_BASE_DENOMINATOR + ethBalanceInUnits)) / RATE_BASE_DENOMINATOR;
            }
            lastPriceUpdateTime = block.timestamp;
            emit PriceUpdated(currentTokenPrice, lastPriceUpdateTime);
        }
        return currentTokenPrice;
    }


    function getCurrentCalculatedPrice() external view returns (uint256) {
        uint256 price = currentTokenPrice;
        uint256 daysPassed = (block.timestamp - lastPriceUpdateTime) / ONE_DAY_IN_SECONDS;

        if (daysPassed > 0) {
            uint256 ethBalanceInUnits = address(this).balance / ONE_ETHER;
            if (daysPassed > 3650) { daysPassed = 3650; } // Apply same gas-saving cap

            for (uint i = 0; i < daysPassed; i++) {
                price = (price * (RATE_BASE_DENOMINATOR + ethBalanceInUnits)) / RATE_BASE_DENOMINATOR;
            }
        }
        return price;
    }

    function buyTokens(uint256 numberOfWholeTokensToBuy) external payable nonReentrant {
        require(numberOfWholeTokensToBuy > 0, "Must buy at least one token");
        _updatePrice(); // Price is updated first, considering current transaction's msg.value

        uint256 amountBaseUnits = numberOfWholeTokensToBuy * (10**tokenDecimals);
        uint256 requiredETH = numberOfWholeTokensToBuy * currentTokenPrice;

        require(msg.value == requiredETH, "Incorrect ETH sent for purchase");
        require(GiangToken.balanceOf(address(this)) >= amountBaseUnits, "Exchange out of tokens");

        GiangToken.transfer(msg.sender, amountBaseUnits);
        emit TokensBought(msg.sender, numberOfWholeTokensToBuy, msg.value);
    }

    function sellTokens(uint256 numberOfWholeTokensToSell) external nonReentrant {
        require(numberOfWholeTokensToSell > 0, "Must sell at least one token");
        _updatePrice(); // Update price before processing the sale

        uint256 amountBaseUnits = numberOfWholeTokensToSell * (10**tokenDecimals);
        uint256 ethToSendToSeller = numberOfWholeTokensToSell * currentTokenPrice;

        require(address(this).balance >= ethToSendToSeller, "Exchange has insufficient ETH for buyback");

        GiangToken.transferFrom(msg.sender, address(this), amountBaseUnits); // Tokens return to the exchange
        payable(msg.sender).transfer(ethToSendToSeller);

        emit TokensSold(msg.sender, numberOfWholeTokensToSell, ethToSendToSeller);
    }

    function depositEthByOwner() external payable onlyOwner {
        emit EthDepositedByOwner(owner(), msg.value);
    }

    function withdrawEthByOwner(uint256 amountInWei) external onlyOwner nonReentrant {
        require(address(this).balance >= amountInWei, "Insufficient ETH in contract to withdraw");
        payable(owner()).transfer(amountInWei);
        emit EthWithdrawnByOwner(owner(), amountInWei);
    }
    receive() external payable {}
}