const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const TotemToken = artifacts.require('TotemToken');
const LambdaToken = artifacts.require('LambdaToken');

const {
  BN,
  constants,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { MAX_INT256 } = constants;

const deployBasicToken = async (symbol, initialHolder) =>
  LambdaToken.new(symbol, symbol, web3.utils.toWei('1000000', 'ether'), {
    from: initialHolder,
  });

contract('TotemToken', (accounts) => {
  let crowdsale;
  let token;
  let usdc;
  let saleStart;
  const exchangeRate = 50;
  const [owner, user, wallet, usdt, dai] = accounts;

  beforeEach(async () => {
    usdc = await deployBasicToken('USDC', user);
    token = await TotemToken.new(
      'Test Token',
      'TST',
      web3.utils.toWei('1000000', 'ether'),
      {
        from: owner,
      }
    );

    saleStart = new Date();
    saleStart.setDate(saleStart.getDate() + 1);
    saleStart = Math.floor(saleStart.getTime() / 1000);
    // const saleEnd = new Date(saleStart);
    // saleEnd.setDate(saleStart.getDate() + 30);

    crowdsale = await TotemCrowdsale.new(
      token.address,
      wallet,
      exchangeRate,
      saleStart,
      [usdc.address, usdt, dai],
      {
        from: owner,
      }
    );

    await token.transfer(
      crowdsale.address,
      web3.utils.toWei('1000000', 'ether'),
      { from: owner }
    );
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user });
  });

  describe('initialisation', () => {
    it('should initialize with token address and exchangeRate', async () => {
      const res = await crowdsale.getSaleInfo();
      assert(res[0] === token.address);
      assert(res[1] === wallet);
      assert(res[2].toNumber() === exchangeRate);
    });

    it('should initialize authorized tokens', async () => {
      const usdcAuthorization = await crowdsale.isTokenAuthorized(usdc.address);
      const usdtAuthorization = await crowdsale.isTokenAuthorized(usdt);
      const daiAuthorization = await crowdsale.isTokenAuthorized(dai);

      assert(usdcAuthorization === true);
      assert(usdtAuthorization === true);
      assert(daiAuthorization === true);
    });
  });

  describe('sale', () => {
    it('should sell Totem token for authorized coin', async () => {
      const value = 100;
      const expectedTokenAmount = value * exchangeRate;

      time.increase(time.duration.days(2));

      const receipt = await crowdsale.buyToken(usdc.address, value, {
        from: user,
      });

      expectEvent(receipt, 'TokenBought', {
        buyer: user,
        stableCoin: usdc.address,
        value: new BN(value, 10),
      });

      const userTotemBalance = await token.balanceOf(user);
      const walletUsdcBalance = await usdc.balanceOf(wallet);
      assert(userTotemBalance.eq(new BN(expectedTokenAmount, 10)));
      assert(walletUsdcBalance.eq(new BN(value, 10)));
    });

    it('should not accept random token', async () => {
      const randomToken = await deployBasicToken('RDM', user);

      await usdc.approve(randomToken.address, MAX_INT256, { from: user });
      await expectRevert(
        crowdsale.buyToken(randomToken.address, '100', {
          from: user,
        }),
        'TotemCrowdsale: unauthorized token'
      );
    });

    it('should not allow buying before sale start', async () => {
      let saleStart2 = new Date();
      saleStart2.setDate(saleStart2.getDate() + 1);
      saleStart2 = Math.floor(saleStart2.getTime() / 1000);
      // const saleEnd = new Date(saleStart);
      // saleEnd.setDate(saleStart.getDate() + 30);

      const crowdsale2 = await TotemCrowdsale.new(
        token.address,
        wallet,
        exchangeRate,
        saleStart2,
        [usdc.address, usdt, dai],
        {
          from: owner,
        }
      );

      await token.transfer(
        crowdsale2.address,
        web3.utils.toWei('1000000', 'ether'),
        { from: owner }
      );
      await usdc.approve(crowdsale2.address, MAX_INT256, { from: user });
      await expectRevert(
        crowdsale2.buyToken(usdc.address, '100', {
          from: user,
        }),
        'TotemCrowdsale: sale not started yet'
      );
    });

    // should buy only from start to finish

    // should not buy if not enough stable coin
    // should not buy if not enough totem coin

    // should burn remaining token when finalize
  });
});
