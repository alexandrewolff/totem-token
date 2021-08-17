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
const { MAX_INT256, ZERO_ADDRESS } = constants;
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

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
  let authorizedTokens;
  const minBuyValue = new BN(web3.utils.toWei('300', 'ether'), 10);
  const exchangeRate = new BN(50, 10);
  const referralPercentage = new BN(2, 10);
  const tokenTotalSupply = new BN(web3.utils.toWei('1000000', 'ether'), 10);

  const [owner, user1, user2, wallet, usdt, dai] = accounts;

  beforeEach(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await TotemToken.new('Test Token', 'TST', tokenTotalSupply, {
      from: owner,
    });

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    saleStart = now + time.duration.days(1).toNumber();
    saleEnd = saleStart + time.duration.days(30).toNumber();

    authorizedTokens = [usdc.address, usdt, dai];

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

    await token.transfer(crowdsale.address, tokenTotalSupply, { from: owner });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });
  });

  describe('Initialisation', () => {
    it('should initialize with sale settings', async () => {
      const web3jsCrowdsale = new web3.eth.Contract(
        crowdsale.abi,
        crowdsale.address
      );
      const events = await web3jsCrowdsale.getPastEvents('SaleInitialized', {
        fromBlock: 'earliest',
        toBlock: 'latest',
      });
      const { event, returnValues } = events[0];

      assert(event === 'SaleInitialized');
      assert(returnValues.token === token.address);
      assert(returnValues.wallet === wallet);
      assert(parseInt(returnValues.saleStart) === saleStart);
      assert(parseInt(returnValues.saleEnd) === saleEnd);
      assert(new BN(returnValues.minBuyValue, 10).eq(minBuyValue));
      assert(new BN(returnValues.exchangeRate, 10).eq(exchangeRate));
      assert(
        new BN(returnValues.referralPercentage, 10).eq(referralPercentage)
      );
      authorizedTokens.forEach((token) =>
        assert(returnValues.authorizedTokens.includes(token))
      );
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
        const value = new BN(web3.utils.toWei('300', 'ether'), 10);
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
        let soldAmount = await crowdsale.getSoldAmount();
        const walletUsdcBalance = await usdc.balanceOf(wallet);

        expectEvent(receipt, 'TokenBought', {
          buyer: user1,
          stableCoin: usdc.address,
          value,
          referral: ZERO_ADDRESS,
        });
        assert(claimableAmount.eq(expectedTokenAmount));
        assert(new BN(soldAmount, 10).eq(expectedTokenAmount));
        assert(walletUsdcBalance.eq(value));

        await crowdsale.buyToken(usdc.address, value, ZERO_ADDRESS, {
          from: user1,
        });
        soldAmount = await crowdsale.getSoldAmount();

        assert(
          new BN(soldAmount, 10).eq(expectedTokenAmount.mul(new BN(2, 10)))
        );
      });

      it('should not sell if under minimum buy value', async () => {
        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            minBuyValue.div(new BN(2, 10)),
            ZERO_ADDRESS,
            {
              from: user1,
            }
          ),
          'TotemCrowdsale: under minimum buy value'
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
        const tokenTotalSupplyValue = tokenTotalSupply.div(
          new BN(exchangeRate, 10)
        );
        await crowdsale.buyToken(
          usdc.address,
          tokenTotalSupplyValue,
          ZERO_ADDRESS,
          {
            from: user1,
          }
        );
        const claimableAmount = await crowdsale.getClaimableAmount(user1);

        assert(claimableAmount.eq(tokenTotalSupply));
      });
    });

    describe('Referral', () => {
      it('should apply referral reward', async () => {
        const value = new BN(web3.utils.toWei('400', 'ether'), 10);
        const expectedTokenAmount = value.mul(exchangeRate);
        const expectedReferralAmount = expectedTokenAmount
          .mul(referralPercentage)
          .div(new BN(100, 10));

        // Add user2 to buyers
        const user2Value = new BN(web3.utils.toWei('300', 'ether'), 10);
        const expectedUsers2Tokens = user2Value.mul(exchangeRate);
        await usdc.transfer(user2, user2Value, { from: user1 });
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
        const soldAmount = await crowdsale.getSoldAmount();

        expectEvent(receipt, 'TokenBought', {
          referral: user2,
        });
        assert(
          finalClaimableAmount
            .sub(initialClaimableAmount)
            .eq(expectedReferralAmount)
        );
        assert(
          new BN(soldAmount, 10).eq(
            expectedTokenAmount
              .add(expectedReferralAmount)
              .add(expectedUsers2Tokens)
          )
        );
      });

      it('should not sell if not enough supply for referral', async () => {
        // Add user2 to buyers
        const user2Value = new BN(web3.utils.toWei('300', 'ether'), 10);
        await usdc.transfer(user2, user2Value, { from: user1 });
        await usdc.approve(crowdsale.address, MAX_INT256, { from: user2 });
        await crowdsale.buyToken(usdc.address, user2Value, ZERO_ADDRESS, {
          from: user2,
        });

        const crowdsaleBalance = await token.balanceOf(crowdsale.address);
        const supplyLeftValue = crowdsaleBalance.div(exchangeRate);

        await expectRevert(
          crowdsale.buyToken(usdc.address, supplyLeftValue, user2, {
            from: user1,
          }),
          'TotemCrowdsale: not enough tokens available'
        );
      });

      it('should not accept address different from buyers and zero for referral', async () => {
        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            web3.utils.toWei('400', 'ether'),
            user2,
            {
              from: user1,
            }
          ),
          'TotemCrowdsale: invalid referral address'
        );
      });

      it('should not allow referral to be buyer', async () => {
        await expectRevert(
          crowdsale.buyToken(
            usdc.address,
            web3.utils.toWei('2500', 'ether'),
            user1,
            {
              from: user1,
            }
          ),
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
