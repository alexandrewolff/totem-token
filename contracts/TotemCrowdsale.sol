// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ITotemToken.sol";

struct SaleInfo {
    address token;
    address wallet;
    uint256 saleStart;
    uint256 saleEnd;
    uint256 minBuyValue;
    uint256 exchangeRate;
    uint256 referralPercentage;
    uint256 soldAmount;
}

contract TotemCrowdsale {
    using SafeERC20 for IERC20;

    address private immutable token;
    address private immutable wallet;
    uint256 private immutable saleStart;
    uint256 private immutable saleEnd;
    uint256 private immutable minBuyValue;
    uint256 private immutable exchangeRate;
    uint256 private immutable referralPercentage;
    uint256 private soldAmount;

    mapping(address => bool) private authorizedTokens;
    mapping(address => uint256) private userToClaimableAmount;

    event TokenBought(address indexed buyer, address indexed stableCoin, uint256 value, address indexed referral);
    event SaleFinalized(uint256 remainingBalance);

    constructor(
        address _token,
        address _wallet,
        uint256 _saleStart,
        uint256 _saleEnd,
        uint256 _minBuyValue,
        uint256 _exchangeRate,
        uint256 _referralPercentage,
        address[] memory _authorizedTokens
    ) {
        token = _token;
        wallet = _wallet;
        saleStart = _saleStart;
        saleEnd = _saleEnd;
        minBuyValue = _minBuyValue;
        exchangeRate = _exchangeRate;
        referralPercentage = _referralPercentage;

        for (uint8 i = 0; i < _authorizedTokens.length; i += 1) {
            authorizedTokens[_authorizedTokens[i]] = true;
        }
    }

    function buyToken(
        address stableCoin,
        uint256 value,
        address referral
    ) external {
        require(authorizedTokens[stableCoin], "TotemCrowdsale: unauthorized token");
        require(block.timestamp >= saleStart, "TotemCrowdsale: sale not started yet");
        require(block.timestamp <= saleEnd, "TotemCrowdsale: sale ended");
        require(
            referral == address(0) || (msg.sender != referral && userToClaimableAmount[referral] > 0),
            "TotemCrowdsale: invalid referral address"
        );

        uint256 tokensAvailable = IERC20(token).balanceOf(address(this));
        uint256 claimableAmount = value * exchangeRate;
        require(tokensAvailable >= soldAmount + claimableAmount, "TotemCrowdsale: not enough tokens available");
        userToClaimableAmount[msg.sender] += claimableAmount;
        soldAmount += claimableAmount;

        if (referral != address(0)) {
            uint256 referralReward = (claimableAmount * referralPercentage) / 100;
            require(tokensAvailable >= soldAmount + referralReward, "TotemCrowdsale: not enough tokens available");
            userToClaimableAmount[referral] += referralReward;
            soldAmount += referralReward;
        }

        emit TokenBought(msg.sender, stableCoin, value, referral);

        IERC20(stableCoin).safeTransferFrom(msg.sender, wallet, value);
    }

    // function withdrawToken() external {
    // IERC20(token).transfer(msg.sender, amountToSend); // considers that token reverts if transfer not successfull
    // }

    function finalizeSale() external {
        require(block.timestamp > saleEnd, "TotemCrowdsale: sale not ended yet");
        uint256 balance = IERC20(token).balanceOf(address(this));
        emit SaleFinalized(balance);
        ITotemToken(token).burn(balance);
    }

    function getSaleInfo() external view returns (SaleInfo memory) {
        return SaleInfo(token, wallet, saleStart, saleEnd, minBuyValue, exchangeRate, referralPercentage, soldAmount);
    }

    function getClaimableAmount(address account) external view returns (uint256) {
        return userToClaimableAmount[account];
    }

    function isTokenAuthorized(address _token) external view returns (bool) {
        return authorizedTokens[_token];
    }
}
