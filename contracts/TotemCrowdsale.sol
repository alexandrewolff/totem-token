// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ITotemToken.sol";

contract TotemCrowdsale {
    address private immutable token;
    uint256 private immutable exchangeRate;
    address private immutable wallet;
    uint256 private immutable saleStart;
    uint256 private saleEnd;
    mapping(address => bool) private authorizedTokens;

    event TokenBought(address indexed buyer, address indexed stableCoin, uint256 value);

    constructor(
        address _token,
        address _wallet,
        uint256 _exchangeRate,
        uint256 _saleStart,
        uint256 _saleEnd,
        address[] memory _authorizedTokens
    ) {
        token = _token;
        wallet = _wallet;
        exchangeRate = _exchangeRate;
        saleStart = _saleStart;
        saleEnd = _saleEnd;

        for (uint8 i = 0; i < _authorizedTokens.length; i += 1) {
            authorizedTokens[_authorizedTokens[i]] = true;
        }
    }

    function buyToken(address stableCoin, uint256 value) external {
        require(authorizedTokens[stableCoin] == true, "TotemCrowdsale: unauthorized token");
        require(block.timestamp >= saleStart, "TotemCrowdsale: sale not started yet");

        require(block.timestamp <= saleEnd, "TotemCrowdsale: sale ended");

        uint256 amountToSend = value * exchangeRate;

        emit TokenBought(msg.sender, stableCoin, value);

        IERC20(stableCoin).transferFrom(msg.sender, wallet, value);
        IERC20(token).transfer(msg.sender, amountToSend);
    }

    function finalize() external {
        uint256 balance = IERC20(token).balanceOf(address(this));
        // emit
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

    function isTokenAuthorized(address _token) external view returns (bool) {
        return authorizedTokens[_token];
    }
}
