const TotemToken = artifacts.require('TotemToken');
const TotemCrowdsale = artifacts.require('TotemCrowdsale');

const wallet = '0x535Ea2751927C0Ce9086b0a7ECAfA82698Bb3958';
const saleStart = 1628777020;
const saleEnd = 1631369020;
const exchangeRate = 50;
const referralPercentage = 2;
const bscStableCoins = ['0x535Ea2751927C0Ce9086b0a7ECAfA82698Bb3958'];

// const computeDates

module.exports = async (deployer, _, accounts) => {
  const token = await TotemToken.deployed();

  let saleStart = new Date();
  saleStart.setDate(saleStart.getDate() + 1);
  let saleEnd = new Date(saleStart);
  saleEnd.setDate(saleStart.getDate() + 30);
  saleStart = Math.floor(saleStart.getTime() / 1000);
  saleEnd = Math.floor(saleEnd.getTime() / 1000);

  await deployer.deploy(
    TotemCrowdsale,
    token.address,
    wallet,
    saleStart,
    saleEnd,
    exchangeRate,
    referralPercentage,
    bscStableCoins,
    {
      from: accounts[0],
    }
  );
};
