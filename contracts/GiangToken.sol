// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GiangToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY_WHOLE_TOKENS = 10**5; // 100,000 tokens

    constructor(string memory tokenName, string memory tokenSymbol, address initialTokenOwner)
        ERC20(tokenName, tokenSymbol)
        Ownable(initialTokenOwner)
    {
        uint256 decimalsValue = decimals();
        _mint(initialTokenOwner, TOTAL_SUPPLY_WHOLE_TOKENS * (10**decimalsValue));
    }
}