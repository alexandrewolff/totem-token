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

contract('Totem Crowdsale', (accounts) => {
  let crowdsale;
  let token;
  let usdc;
  let saleStart;
  let saleEnd;
  const minBuyValue = new BN(web3.utils.toWei('300', 'ether'), 10);
  const exchangeRate = new BN(50, 10);
  const referralPercentage = new BN(2, 10);
  const totalSupply = new BN(web3.utils.toWei('1000000', 'ether'), 10);

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
      minBuyValue,
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
      assert(res.token === token.address);
      assert(res.wallet === wallet);
      assert(parseInt(res.saleStart) === saleStart);
      assert(parseInt(res.saleEnd) === saleEnd);
      assert(new BN(res.minBuyValue, 10).eq(minBuyValue));
      assert(new BN(res.exchangeRate, 10).eq(exchangeRate));
      assert(new BN(res.referralPercentage, 10).eq(referralPercentage));
      assert(parseInt(res.soldAmount) === 0);
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
    before(async () => {
      await time.increase(time.duration.days(2));
    });

    describe('Sale', () => {
      it('should sell Totem token', async () => {
        const value = new BN(100, 10);
        const expectedTokenAmount = value.mul(exchangeRate);

        const receipt = await crowdsale.buyToken(
          usdc.address,
          value,
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );

        const claimableAmount = await crowdsale.getClaimableAmount(user1);
        let res = await crowdsale.getSaleInfo();
        const walletUsdcBalance = await usdc.balanceOf(wallet);

        expectEvent(receipt, 'TokenBought', {
          buyer: user1,
          stableCoin: usdc.address,
          value: new BN(value, 10),
        });
        assert(claimableAmount.eq(expectedTokenAmount));
        assert(new BN(res.soldAmount, 10).eq(expectedTokenAmount));
        assert(walletUsdcBalance.eq(value));

        await crowdsale.buyToken(usdc.address, value, ZERO_ADDRESS, {
          from: user1,
        });
        res = await crowdsale.getSaleInfo();

        assert(
          new BN(res.soldAmount, 10).eq(expectedTokenAmount.mul(new BN(2, 10)))
        );
      });

      it('should not sell if not enough supply', async () => {
        const crowdsaleBalance = await token.balanceOf(crowdsale.address);
        const crowdsaleBalanceValue = crowdsaleBalance.div(exchangeRate);

        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            crowdsaleBalanceValue.add(new BN(1, 10)),
            ZERO_ADDRESS,
            {
              from: user1,
            }
          ),
          'TotemCrowdsale: not enough tokens available'
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
        const totalSupplyValue = totalSupply.div(new BN(exchangeRate, 10));
        await crowdsale.buyToken(usdc.address, totalSupplyValue, ZERO_ADDRESS, {
          from: user1,
        });
        const claimableAmount = await crowdsale.getClaimableAmount(user1);

        assert(claimableAmount.eq(totalSupply));
      });
    });

    describe('Referral', () => {
      it('should apply referral reward', async () => {
        const value = new BN(100, 10);
        const expectedTokenAmount = value.mul(exchangeRate);
        const expectedReferralAmount = expectedTokenAmount
          .mul(referralPercentage)
          .div(new BN(100, 10));

        // Add user2 to buyers
        const user2Value = new BN(1, 10);
        const expectedUsers2Tokens = user2Value.mul(exchangeRate);
        await usdc.transfer(user2, 1, { from: user1 });
        await usdc.approve(crowdsale.address, MAX_INT256, { from: user2 });
        await crowdsale.buyToken(usdc.address, user2Value, ZERO_ADDRESS, {
          from: user2,
        });

        const initialClaimableAmount = await crowdsale.getClaimableAmount(
          user2
        );
        const receipt = await crowdsale.buyToken(usdc.address, value, user2, {
          from: user1,
        });
        const finalClaimableAmount = await crowdsale.getClaimableAmount(user2);
        const res = await crowdsale.getSaleInfo();

        expectEvent(receipt, 'TokenBought', {
          referral: user2,
        });
        assert(
          finalClaimableAmount
            .sub(initialClaimableAmount)
            .eq(expectedReferralAmount)
        );
        assert(
          new BN(res.soldAmount, 10).eq(
            expectedTokenAmount
              .add(expectedReferralAmount)
              .add(expectedUsers2Tokens)
          )
        );
      });

      it('should not sell if not enough supply for referral', async () => {
        // Add user2 to buyers
        await usdc.transfer(user2, 1, { from: user1 });
        await usdc.approve(crowdsale.address, MAX_INT256, { from: user2 });
        await crowdsale.buyToken(usdc.address, 1, ZERO_ADDRESS, {
          from: user2,
        });

        const crowdsaleBalance = await token.balanceOf(crowdsale.address);
        const supplyLeftValue = crowdsaleBalance.div(new BN(exchangeRate, 10));

        await expectRevert(
          crowdsale.buyToken(usdc.address, supplyLeftValue, user2, {
            from: user1,
          }),
          'TotemCrowdsale: not enough tokens available'
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

      it('should not allow referral to be buyer', async () => {
        await expectRevert(
          crowdsale.buyToken(usdc.address, 100, user1, {
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
    before(async () => {
      await time.increase(time.duration.days(40));
    });

    describe('Sale', () => {
      it('should not sell Totem token after end', async () => {
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
