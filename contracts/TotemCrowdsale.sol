// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ITotemToken.sol";

struct SaleSettings {
    address wallet;
    uint256 saleStart;
    uint256 saleEnd;
    uint256 withdrawalStart;
    uint256 withdrawPeriodDuration;
    uint256 withdrawPeriodNumber;
    uint256 minBuyValue;
    uint256 maxBuyValue;
    uint256 exchangeRate;
    uint256 referralRewardPercentage;
}

contract TotemCrowdsale {
    using SafeERC20 for IERC20;

    address private immutable token;
    address private wallet;
    uint256 private saleStart;
    uint256 private saleEnd;
    uint256 private withdrawalStart;
    uint256 private withdrawPeriodDuration;
    uint256 private withdrawPeriodNumber;
    uint256 private minBuyValue;
    uint256 private maxBuyValue;
    uint256 private exchangeRate;
    uint256 private referralRewardPercentage;

    function setWallet(address newWallet) external {
        wallet = newWallet;
        emit WalletUpdated(newWallet, msg.sender);
    }

    function setSaleStart(uint256 newSaleStart) external onlyBeforeSaleStart {
        saleStart = newSaleStart;
        emit SaleStartUpdated(newSaleStart, msg.sender);
    }

    function setSaleEnd(uint256 newSaleEnd) external onlyBeforeSaleStart {
        saleEnd = newSaleEnd;
        emit SaleEndUpdated(newSaleEnd, msg.sender);
    }

    function setWithdrawalStart(uint256 newWithdrawalStart) external onlyBeforeSaleStart {
        withdrawalStart = newWithdrawalStart;
        emit WithdrawalStartUpdated(newWithdrawalStart, msg.sender);
    }

    function setWithdrawPeriodDuration(uint256 newWithdrawPeriodDuration)
        external
        onlyBeforeSaleStart
    {
        withdrawPeriodDuration = newWithdrawPeriodDuration;
        emit WithdrawPeriodDurationUpdated(newWithdrawPeriodDuration, msg.sender);
    }

    function setWithdrawPeriodNumber(uint256 newWithdrawPeriodNumber) external onlyBeforeSaleStart {
        withdrawPeriodNumber = newWithdrawPeriodNumber;
        emit WithdrawPeriodNumberUpdated(newWithdrawPeriodNumber, msg.sender);
    }

    function setMinBuyValue(uint256 newMinBuyValue) external onlyBeforeSaleStart {
        minBuyValue = newMinBuyValue;
        emit MinBuyValueUpdated(newMinBuyValue, msg.sender);
    }

    function setMaxBuyValue(uint256 newMaxBuyValue) external onlyBeforeSaleStart {
        maxBuyValue = newMaxBuyValue;
        emit MaxBuyValueUpdated(newMaxBuyValue, msg.sender);
    }

    function setExchangeRate(uint256 newExchangeRate) external onlyBeforeSaleStart {
        exchangeRate = newExchangeRate;
        emit ExchangeRateUpdated(newExchangeRate, msg.sender);
    }

    function setReferralRewardPercentage(uint256 newReferralRewardPercentage)
        external
        onlyBeforeSaleStart
    {
        referralRewardPercentage = newReferralRewardPercentage;
        emit ReferralRewardPercentageUpdated(newReferralRewardPercentage, msg.sender);
    }

    // function authorizeTokens

    function getSaleSettings() external view returns (SaleSettings memory) {
        return
            SaleSettings(
                wallet,
                saleStart,
                saleEnd,
                withdrawalStart,
                withdrawPeriodDuration,
                withdrawPeriodNumber,
                minBuyValue,
                maxBuyValue,
                exchangeRate,
                referralRewardPercentage
            );
    }

    uint256 private soldAmount;

    mapping(address => bool) private authorizedTokens;
    mapping(address => uint256) private userToClaimableAmount;
    mapping(address => uint256) private userToWithdrewAmount;

    event WalletUpdated(address newWallet, address indexed updater);
    event SaleStartUpdated(uint256 newSaleStart, address indexed updater);
    event SaleEndUpdated(uint256 newSaleEnd, address indexed updater);
    event WithdrawalStartUpdated(uint256 newWithdrawalStart, address indexed updater);
    event WithdrawPeriodDurationUpdated(uint256 newWithdrawPeriodDuration, address indexed updater);
    event WithdrawPeriodNumberUpdated(uint256 newWithdrawPeriodNumber, address indexed updater);
    event MinBuyValueUpdated(uint256 newMinBuyValue, address indexed updater);
    event MaxBuyValueUpdated(uint256 newMaxBuyValue, address indexed updater);
    event ExchangeRateUpdated(uint256 newExchangeRate, address indexed updater);
    event ReferralRewardPercentageUpdated(
        uint256 newReferralRewardPercentage,
        address indexed updater
    );

    event TokenBought(
        address indexed account,
        address indexed stableCoin,
        uint256 value,
        address indexed referral
    );
    event TokenWithdrew(address indexed account, uint256 amount);
    event SaleFinalized(uint256 remainingBalance);

    modifier onlyBeforeSaleStart() {
        if (saleStart > 0) {
            require(block.timestamp < saleStart, "TotemCrowdsale: sale already started");
        }
        _;
    }

    constructor(
        address _token,
        address _wallet,
        uint256 _minBuyValue,
        uint256 _exchangeRate,
        uint256 _referralPercentage,
        address[] memory _authorizedTokens
    ) {
        token = _token;
        wallet = _wallet;

        minBuyValue = _minBuyValue;
        exchangeRate = _exchangeRate;
        referralRewardPercentage = _referralPercentage;

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
        require(value >= minBuyValue, "TotemCrowdsale: under minimum buy value");
        require(
            referral == address(0) ||
                (msg.sender != referral && userToClaimableAmount[referral] > 0),
            "TotemCrowdsale: invalid referral address"
        );

        uint256 tokensAvailable = IERC20(token).balanceOf(address(this));
        uint256 claimableAmount = value * exchangeRate;
        require(
            tokensAvailable >= soldAmount + claimableAmount,
            "TotemCrowdsale: not enough tokens available"
        );
        userToClaimableAmount[msg.sender] += claimableAmount;
        soldAmount += claimableAmount;

        if (referral != address(0)) {
            uint256 referralReward = (claimableAmount * referralRewardPercentage) / 100;
            require(
                tokensAvailable >= soldAmount + referralReward,
                "TotemCrowdsale: not enough tokens available"
            );
            userToClaimableAmount[referral] += referralReward;
            soldAmount += referralReward;
        }

        emit TokenBought(msg.sender, stableCoin, value, referral);

        IERC20(stableCoin).safeTransferFrom(msg.sender, wallet, value);
    }

    function withdrawToken() external {
        uint256 periodsElapsed = (block.timestamp - withdrawalStart) / withdrawPeriodDuration + 1; // reverts if before withdrawalStart

        uint256 amountToSend;
        if (periodsElapsed >= withdrawPeriodNumber) {
            amountToSend = userToClaimableAmount[msg.sender] - userToWithdrewAmount[msg.sender];
            delete userToClaimableAmount[msg.sender];
            delete userToWithdrewAmount[msg.sender];
        } else {
            uint256 withdrawableAmountPerPeriod = userToClaimableAmount[msg.sender] /
                withdrawPeriodNumber;
            amountToSend =
                withdrawableAmountPerPeriod *
                periodsElapsed -
                userToWithdrewAmount[msg.sender];
            userToWithdrewAmount[msg.sender] += amountToSend;
        }

        emit TokenWithdrew(msg.sender, amountToSend);

        IERC20(token).transfer(msg.sender, amountToSend); // considers that token reverts if transfer not successfull
    }

    function finalizeSale() external {
        require(block.timestamp > saleEnd, "TotemCrowdsale: sale not ended yet");
        uint256 balance = IERC20(token).balanceOf(address(this));
        emit SaleFinalized(balance);
        ITotemToken(token).burn(balance);
    }

    function getSoldAmount() external view returns (uint256) {
        return soldAmount;
    }

    function getClaimableAmount(address account) external view returns (uint256) {
        return userToClaimableAmount[account];
    }

    function getWithdrewAmount(address account) external view returns (uint256) {
        return userToWithdrewAmount[account];
    }
}
