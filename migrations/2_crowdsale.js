const { time } = require('@openzeppelin/test-helpers');

const TotemToken = artifacts.require('TotemToken');
const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const LambdaToken = artifacts.require('LambdaToken');

module.exports = async (deployer, network, accounts) => {
  if (network === 'test') return;

  let wallet;
  let saleStart;
  let saleEnd;
  let withdrawalStart;
  let withdrawPeriodDuration;
  let withdrawPeriodNumber;
  let minBuyValue;
  let maxTokenAmountPerAddress;
  let exchangeRate;
  let referralRewardPercentage;
  const stableCoins = [];

  if (network === 'ganache' || network === 'bsc_test') {
    wallet = accounts[0];

    saleStart = Math.floor(new Date().getTime() / 1000);
    saleStart += time.duration.minutes(10).toNumber();
    saleEnd = saleStart + time.duration.minutes(10).toNumber();

    withdrawalStart = saleEnd;
    withdrawPeriodDuration = time.duration.minutes(10).toNumber();
    withdrawPeriodNumber = 10;
    minBuyValue = web3.utils.toWei('300', 'ether');
    maxTokenAmountPerAddress = web3.utils.toWei('500000', 'ether');
    exchangeRate = 50;
    referralRewardPercentage = 2;

    const initialUsdcSupply = web3.utils.toWei('1000000', 'ether'); // 1 millions tokens
    await deployer.deploy(LambdaToken, 'USDC', 'USDC', initialUsdcSupply, {
      from: accounts[0],
    });
    const testUsdc = await LambdaToken.deployed();

    stableCoins.push(testUsdc.address);
  }

  const token = await TotemToken.deployed();

  const crowdsale = await deployer.deploy(TotemCrowdsale, token.address, {
    from: accounts[0],
  });

  try {
    await crowdsale.setWallet(wallet);
    await crowdsale.setSaleStart(saleStart);
    await crowdsale.setSaleEnd(saleEnd);
    await crowdsale.setWithdrawalStart(withdrawalStart);
    await crowdsale.setWithdrawPeriodDuration(withdrawPeriodDuration);
    await crowdsale.setWithdrawPeriodNumber(withdrawPeriodNumber);
    await crowdsale.setMinBuyValue(minBuyValue);
    await crowdsale.setMaxTokenAmountPerAddress(maxTokenAmountPerAddress);
    await crowdsale.setExchangeRate(exchangeRate);
    await crowdsale.setReferralRewardPercentage(referralRewardPercentage);
    await crowdsale.authorizePaymentCurrencies(stableCoins);
  } catch (err) {
    console.error(err);
  }
};
