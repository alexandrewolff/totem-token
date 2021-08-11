// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ITotemToken.sol";

contract TotemCrowdsale {
    using SafeERC20 for IERC20;

    address private immutable token;
    address private immutable wallet;
    uint256 private immutable saleStart;
    uint256 private immutable saleEnd;
    uint256 private immutable exchangeRate;
    uint256 private immutable referralPercentage;

    mapping(address => bool) private authorizedTokens;
    mapping(address => bool) private buyers;

    event TokenBought(address indexed buyer, address indexed stableCoin, uint256 value, address indexed referral);
    event SaleFinalized(uint256 remainingBalance);

    constructor(
        address _token,
        address _wallet,
        uint256 _saleStart,
        uint256 _saleEnd,
        uint256 _exchangeRate,
        uint256 _referralPercentage,
        address[] memory _authorizedTokens
    ) {
        token = _token;
        wallet = _wallet;
        saleStart = _saleStart;
        saleEnd = _saleEnd;
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
        require(value > 0, "TotemCrowdsale: value can't be zero");
        require(referral == address(0) || buyers[referral], "TotemCrowdsale: invalid referral address");

        if (!buyers[msg.sender]) {
            buyers[msg.sender] = true;
        }

        uint256 amountToSend = value * exchangeRate;

        emit TokenBought(msg.sender, stableCoin, value, referral);

        IERC20(stableCoin).safeTransferFrom(msg.sender, wallet, value);
        IERC20(token).transfer(msg.sender, amountToSend); // considers that token reverts if transfer not successfull
        if (referral != address(0)) {
            IERC20(token).transfer(referral, (amountToSend * referralPercentage) / 100); // considers that token reverts if transfer not successfull
        }
    }

    function finalizeSale() external {
        require(block.timestamp > saleEnd, "TotemCrowdsale: sale not ended yet");
        uint256 balance = IERC20(token).balanceOf(address(this));
        emit SaleFinalized(balance);
        ITotemToken(token).burn(balance);
    }

    function getSaleInfo()
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        return (token, wallet, saleStart, saleEnd, exchangeRate, referralPercentage);
    }

    function isTokenAuthorized(address _token) external view returns (bool) {
        return authorizedTokens[_token];
    }
}
