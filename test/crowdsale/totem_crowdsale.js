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
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
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
  let saleEnd;
  let referralValue;

  const exchangeRate = 50;
  const [owner, user1, user2, wallet, usdt, dai] = accounts;

  beforeEach(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await TotemToken.new(
      'Test Token',
      'TST',
      web3.utils.toWei('1000000', 'ether'),
      {
        from: owner,
      }
    );

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    saleStart = now + time.duration.days(1).toNumber();
    saleEnd = saleStart + time.duration.days(30).toNumber();

    referralValue = 2;

    crowdsale = await TotemCrowdsale.new(
      token.address,
      wallet,
      exchangeRate,
      saleStart,
      saleEnd,
      referralValue,
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
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
  });

  describe('Initialisation', () => {
    it('should initialize with token address and exchangeRate', async () => {
      const res = await crowdsale.getSaleInfo();
      assert(res[0] === token.address);
      assert(res[1] === wallet);
      assert(res[2].toNumber() === exchangeRate);
      assert(res[3].toNumber() === saleStart);
      assert(res[4].toNumber() === saleEnd);
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

  describe('Before sale', () => {
    describe('Sale', () => {
      it('should not allow buying before sale start', async () => {
        await expectRevert(
          crowdsale.buyToken(usdc.address, '100', ZERO_ADDRESS, {
            from: user1,
          }),
          'TotemCrowdsale: sale not started yet'
        );
      });
    });
  });

  describe('During sale', () => {
    describe('Sale', () => {
      // should sell Totem token after start

      it('should sell Totem token for authorized coin', async () => {
        const value = 100;
        const expectedTokenAmount = value * exchangeRate;

        time.increase(time.duration.days(2));
        const receipt = await crowdsale.buyToken(
          usdc.address,
          value,
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );

        expectEvent(receipt, 'TokenBought', {
          buyer: user1,
          stableCoin: usdc.address,
          value: new BN(value, 10),
        });

        const userTotemBalance = await token.balanceOf(user1);
        const walletUsdcBalance = await usdc.balanceOf(wallet);
        assert(userTotemBalance.eq(new BN(expectedTokenAmount, 10)));
        assert(walletUsdcBalance.eq(new BN(value, 10)));
      });

      it('should not accept random token', async () => {
        const randomToken = await deployBasicToken('RDM', user1);

        await randomToken.approve(crowdsale.address, MAX_INT256, {
          from: user1,
        });
        await expectRevert(
          crowdsale.buyToken(randomToken.address, '100', ZERO_ADDRESS, {
            from: user1,
          }),
          'TotemCrowdsale: unauthorized token'
        );
      });
    });

    describe('Referral', () => {
      it('should increase referral at sell', async () => {
        const value = 100;
        const expectedTokenAmount = value * exchangeRate;
        const expectedReferralAmount = new BN(
          (expectedTokenAmount * referralValue) / 100,
          10
        );
        const receipt = await crowdsale.buyToken(usdc.address, value, user2, {
          from: user1,
        });
        const referralAccrued = await crowdsale.getReferralAccrued(user2);

        expectEvent(receipt, 'TokenBought', {
          referral: user2,
        });
        assert(referralAccrued.eq(expectedReferralAmount));
      });

      it('should not increase referral if zero address', async () => {
        const receipt = await crowdsale.buyToken(
          usdc.address,
          100,
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );
        const referralAccrued = await crowdsale.getReferralAccrued(
          ZERO_ADDRESS
        );

        expectEvent(receipt, 'TokenBought', {
          referral: ZERO_ADDRESS,
        });
        assert(referralAccrued.eq(new BN(0, 10)));
      });

      it('should should withdraw referral amount', async () => {});
    });

    describe('Finalization', () => {
      it('should not finalize if sale not ended', async () => {
        await expectRevert(
          crowdsale.finalizeSale({ from: user1 }),
          'TotemCrowdsale: sale not ended yet'
        );
      });
    });
  });

  describe('After sale', () => {
    describe('Sale', () => {
      it('should not sell Totem token after end', async () => {
        time.increase(time.duration.days(40));
        await expectRevert(
          crowdsale.buyToken(usdc.address, '100', ZERO_ADDRESS, {
            from: user1,
          }),
          'TotemCrowdsale: sale ended'
        );
      });
    });

    describe('Finalization', () => {
      it('should burn remaining tokens on finalize', async () => {
        const initialBalance = await token.balanceOf(crowdsale.address);
        const receipt = await crowdsale.finalizeSale({ from: user1 });
        const finalBalance = await token.balanceOf(crowdsale.address);

        expectEvent(receipt, 'SaleFinalized', {
          remainingBalance: initialBalance,
        });
        assert(finalBalance.eq(new BN(0, 10)));
      });
    });
  });

  // should buy only from start to finish

  // should not buy if not enough stable coin
  // should not buy if not enough totem coin

  // should burn remaining token when finalize
});

// saleStart = new Date();
// saleStart.setDate(saleStart.getDate() + 1);
// saleStart = Math.floor(saleStart.getTime() / 1000);
// const saleEnd = new Date(saleStart);
// saleEnd.setDate(saleStart.getDate() + 30);
