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
  const referralPercentage = new BN(2, 10);
  const totalSupply = new BN(web3.utils.toWei('1000000', 'ether'), 10);

  const exchangeRate = 50;
  const [owner, user1, user2, wallet, usdt, dai] = accounts;

  beforeEach(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await TotemToken.new('Test Token', 'TST', totalSupply, {
      from: owner,
    });

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    saleStart = now + time.duration.days(1).toNumber();
    saleEnd = saleStart + time.duration.days(30).toNumber();

    crowdsale = await TotemCrowdsale.new(
      token.address,
      wallet,
      saleStart,
      saleEnd,
      exchangeRate,
      referralPercentage,
      [usdc.address, usdt, dai],
      {
        from: owner,
      }
    );

    await token.transfer(crowdsale.address, totalSupply, { from: owner });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
  });

  describe('Initialisation', () => {
    it('should initialize with token address and exchangeRate', async () => {
      const res = await crowdsale.getSaleInfo();
      assert(res[0] === token.address);
      assert(res[1] === wallet);
      assert(res[2].toNumber() === saleStart);
      assert(res[3].toNumber() === saleEnd);
      assert(res[4].toNumber() === exchangeRate);
      assert(res[5].eq(referralPercentage));
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

      it('should sell Totem token', async () => {
        const value = 100;
        const expectedTokenAmount = value * exchangeRate;

        await time.increase(time.duration.days(2));
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

      it('should not sell for zero as value', async () => {
        await expectRevert(
          crowdsale.buyToken(usdc.address, 0, ZERO_ADDRESS, {
            from: user1,
          }),
          "TotemCrowdsale: value can't be zero"
        );
      });

      it('should not sell if not enough supply', async () => {
        const crowdsaleBalance = await token.balanceOf(crowdsale.address);

        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            crowdsaleBalance.add(new BN(1, 10)),
            ZERO_ADDRESS,
            {
              from: user1,
            }
          ),
          'ERC20: transfer amount exceeds balance'
        );
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

      it('should sell all tokens left', async () => {
        const val = totalSupply.div(new BN(exchangeRate, 10));
        await crowdsale.buyToken(usdc.address, val, ZERO_ADDRESS, {
          from: user1,
        });
        const balance = await token.balanceOf(crowdsale.address);

        assert(balance.eq(new BN(0, 10)));
      });
    });

    describe('Referral', () => {
      it('should send referral', async () => {
        const value = 100;
        const expectedTokenAmount = value * exchangeRate;
        const expectedReferralAmount = new BN(
          (expectedTokenAmount * referralPercentage) / 100,
          10
        );

        // Add user2 to buyers
        await usdc.transfer(user2, 1, { from: user1 });
        await usdc.approve(crowdsale.address, MAX_INT256, { from: user2 });
        await crowdsale.buyToken(usdc.address, 1, ZERO_ADDRESS, {
          from: user2,
        });
        const initialBalance = await token.balanceOf(user2);

        const receipt = await crowdsale.buyToken(usdc.address, value, user2, {
          from: user1,
        });
        const finalBalance = await token.balanceOf(user2);

        expectEvent(receipt, 'TokenBought', {
          referral: user2,
        });
        assert(finalBalance.sub(initialBalance).eq(expectedReferralAmount));
      });

      it('should not sell if not enough supply for referral', async () => {
        // Add user2 to buyers
        await usdc.transfer(user2, 1, { from: user1 });
        await usdc.approve(crowdsale.address, MAX_INT256, { from: user2 });
        await crowdsale.buyToken(usdc.address, 1, ZERO_ADDRESS, {
          from: user2,
        });

        const crowdsaleBalance = await token.balanceOf(crowdsale.address);
        const supplyLeft = crowdsaleBalance.div(new BN(exchangeRate, 10));

        await expectRevert(
          crowdsale.buyToken(usdc.address, supplyLeft, user2, {
            from: user1,
          }),
          'ERC20: transfer amount exceeds balance'
        );
      });

      it('should not accept address different from buyers and zero for referral', async () => {
        await expectRevert(
          crowdsale.buyToken(usdc.address, 100, user2, {
            from: user1,
          }),
          'TotemCrowdsale: invalid referral address'
        );
      });
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
        await time.increase(time.duration.days(40));
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
});
