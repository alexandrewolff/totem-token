// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ITotemToken.sol";

contract TotemCrowdsale {
    address private immutable token;
    uint256 private immutable exchangeRate;
    address private immutable wallet;
    uint256 private immutable saleStart;
    uint256 private immutable saleEnd;
    uint256 private immutable referralValue;

    mapping(address => bool) private authorizedTokens;
    mapping(address => uint256) private userToReferralAccrued;

    event TokenBought(address indexed buyer, address indexed stableCoin, uint256 value, address indexed referral);
    event SaleFinalized(uint256 remainingBalance);

    constructor(
        address _token,
        address _wallet,
        uint256 _exchangeRate,
        uint256 _saleStart,
        uint256 _saleEnd,
        uint256 _referralValue,
        address[] memory _authorizedTokens
    ) {
        token = _token;
        wallet = _wallet;
        exchangeRate = _exchangeRate;
        saleStart = _saleStart;
        saleEnd = _saleEnd;
        referralValue = _referralValue;

        for (uint8 i = 0; i < _authorizedTokens.length; i += 1) {
            authorizedTokens[_authorizedTokens[i]] = true;
        }
    }

    function buyToken(
        address stableCoin,
        uint256 value,
        address referral
    ) external {
        require(authorizedTokens[stableCoin] == true, "TotemCrowdsale: unauthorized token");
        require(block.timestamp >= saleStart, "TotemCrowdsale: sale not started yet");

        require(block.timestamp <= saleEnd, "TotemCrowdsale: sale ended");

        uint256 amountToSend = value * exchangeRate;
        if (referral != address(0)) {
            userToReferralAccrued[referral] += (amountToSend * referralValue) / 100;
        }

        emit TokenBought(msg.sender, stableCoin, value, referral);

        IERC20(stableCoin).transferFrom(msg.sender, wallet, value);
        IERC20(token).transfer(msg.sender, amountToSend);
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
            uint256
        )
    {
        return (token, wallet, exchangeRate, saleStart, saleEnd);
    }

    function getReferralAccrued(address account) external view returns (uint256) {
        return userToReferralAccrued[account];
    }

    function isTokenAuthorized(address _token) external view returns (bool) {
        return authorizedTokens[_token];
    }
}
