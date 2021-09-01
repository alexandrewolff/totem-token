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

    saleStart = new Date();
    saleStart.setDate(saleStart.getDate() + 1);
    saleEnd = new Date(saleStart);
    saleEnd.setDate(saleStart.getDate() + 1);
    saleStart = Math.floor(saleStart.getTime() / 1000);
    saleEnd = Math.floor(saleEnd.getTime() / 1000);

    withdrawalStart = saleEnd;
    withdrawPeriodDuration = time.duration.weeks(4).toNumber();
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
