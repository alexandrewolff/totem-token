const TotemCrowdsale = artifacts.require('TotemCrowdsale');
const TotemToken = artifacts.require('TotemToken');
const LambdaToken = artifacts.require('LambdaToken');

const {
  BN,
  constants,
  //   expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { MAX_INT256, ZERO_ADDRESS } = constants;

const deployBasicToken = async (symbol, initialHolder) =>
  LambdaToken.new(symbol, symbol, MAX_INT256, {
    from: initialHolder,
  });

contract('Totem Crowdsale Withdrawal', (accounts) => {
  let crowdsale;
  let token;
  let usdc;

  const tokenTotalSupply = new BN(web3.utils.toWei('1000000', 'ether'), 10);

  let withdrawStart;
  const withdrawPeriodLength = time.duration.weeks(4).toNumber();
  const withdrawPeriodNumber = new BN(10, 10);
  const minBuyValue = new BN(web3.utils.toWei('300', 'ether'), 10);
  const exchangeRate = new BN(50, 10);
  const referralPercentage = new BN(2, 10);

  const [owner, user1, wallet] = accounts;

  let user1Bought = new BN(web3.utils.toWei('2500', 'ether'), 10);
  let user1expectsTotalToken = user1Bought.mul(exchangeRate);

  before(async () => {
    usdc = await deployBasicToken('USDC', user1);
    token = await TotemToken.new('Test Token', 'TST', tokenTotalSupply, {
      from: owner,
    });

    const res = await web3.eth.getBlock();
    const now = res.timestamp;
    const saleStart = now + time.duration.days(1).toNumber();
    const saleEnd = saleStart + time.duration.days(30).toNumber();
    withdrawStart = saleEnd + time.duration.days(60).toNumber();

    const authorizedTokens = [usdc.address];

    crowdsale = await TotemCrowdsale.new(
      token.address,
      wallet,
      saleStart,
      saleEnd,
      withdrawStart,
      minBuyValue,
      exchangeRate,
      referralPercentage,
      authorizedTokens,
      {
        from: owner,
      }
    );

    await token.transfer(crowdsale.address, tokenTotalSupply, { from: owner });
    await usdc.approve(crowdsale.address, MAX_INT256, { from: user1 });

    await time.increaseTo(saleStart);

    await crowdsale.buyToken(usdc.address, user1Bought, ZERO_ADDRESS, {
      from: user1,
    });
  });

  describe('At cliff', () => {
    before(async () => {
      await time.increaseTo(withdrawStart);
    });

    it('should withdraw 10%', async () => {
      const expectedWithdrawAmount =
        user1expectsTotalToken.div(withdrawPeriodNumber);
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      const receipt = await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      expectEvent(receipt, 'TokenWithdrew', {
        account: user1,
        amount: expectedWithdrawAmount,
      });
      assert(
        userFinalBalance.sub(userInitialBalance).eq(expectedWithdrawAmount)
      );
      assert(
        crowdsaleInitialBalance
          .sub(crowdsaleFinalBalance)
          .eq(expectedWithdrawAmount)
      );
    });

    it('should not withdraw twice', async () => {
      const userInitialBalance = await token.balanceOf(user1);
      const crowdsaleInitialBalance = await token.balanceOf(crowdsale.address);

      await crowdsale.withdrawToken({ from: user1 });

      const userFinalBalance = await token.balanceOf(user1);
      const crowdsaleFinalBalance = await token.balanceOf(crowdsale.address);

      assert(userFinalBalance.sub(userInitialBalance).eq(new BN(0, 10)));
      assert(
        crowdsaleInitialBalance.sub(crowdsaleFinalBalance).eq(new BN(0, 10))
      );
    });
  });
});
