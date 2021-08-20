const Web3 = require('web3');

const TotemToken = artifacts.require('TotemToken');
const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const LambdaToken = artifacts.require('LambdaToken');

const wallet = '0x535Ea2751927C0Ce9086b0a7ECAfA82698Bb3958';
const saleStart = 0;
const saleEnd = 2031369020;
// const saleStart = 1628777020;
// const saleEnd = 1631369020;
const withdrawStart = saleEnd;
const minBuyValue = new Web3.utils.BN(Web3.utils.toWei('300', 'ether'), 10);
const exchangeRate = 50;
const referralPercentage = 2;
const bscStableCoins = [];

module.exports = async (deployer, network, accounts) => {
  const token = await TotemToken.deployed();

  // let saleStart = new Date();
  // saleStart.setDate(saleStart.getDate() + 1);
  // let saleEnd = new Date(saleStart);
  // saleEnd.setDate(saleStart.getDate() + 30);
  // saleStart = Math.floor(saleStart.getTime() / 1000);
  // saleEnd = Math.floor(saleEnd.getTime() / 1000);

  if (network === 'bsc_test') {
    const testUsdc = await deployer.deploy(
      LambdaToken,
      'USDC',
      'USDC',
      new web3.utils.BN('1000000000000000000000000', 10),
      {
        from: accounts[0],
      }
    );
    bscStableCoins.push(testUsdc.address);
  }

  await deployer.deploy(
    TotemCrowdsale,
    token.address,
    wallet,
    minBuyValue,
    exchangeRate,
    referralPercentage,
    bscStableCoins,
    {
      from: accounts[0],
    }
  );
};
