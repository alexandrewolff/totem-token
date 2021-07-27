// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TotemCrowdsale {
    address private token;
    uint256 private exchangeRate;
    address private wallet;
    uint256 private saleStart;
    // uint256 private saleEnd;
    mapping(address => bool) private authorizedTokens;

    event TokenBought(address buyer, address stableCoin, uint256 value);

    constructor(
        address _token,
        address _wallet,
        uint256 _exchangeRate,
        uint256 _saleStart,
        address[] memory _authorizedTokens
    ) {
        token = _token;
        wallet = _wallet;
        exchangeRate = _exchangeRate;
        saleStart = _saleStart;

        for (uint8 i = 0; i < _authorizedTokens.length; i += 1) {
            authorizedTokens[_authorizedTokens[i]] = true;
        }
    }

    function buyToken(address stableCoin, uint256 value) external {
        require(
            authorizedTokens[stableCoin] == true,
            "TotemCrowdsale: unauthorized token"
        );
        require(
            block.timestamp >= saleStart,
            "TotemCrowdsale: sale not started yet"
        );

        uint256 amountToSend = value * exchangeRate;

        emit TokenBought(msg.sender, stableCoin, value);

        IERC20(stableCoin).transferFrom(msg.sender, wallet, value);
        IERC20(token).transfer(msg.sender, amountToSend);
    }

    function getSaleInfo()
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256
        )
    {
        return (token, wallet, exchangeRate, saleStart);
    }

    function isTokenAuthorized(address _token) external view returns (bool) {
        return authorizedTokens[_token];
    }
}
