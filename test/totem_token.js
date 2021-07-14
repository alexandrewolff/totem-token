const TotemToken = artifacts.require('TotemToken');

const {
  BN,
  constants,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const skipGracePeriod = () => time.increase(time.duration.days(7));

const setBridgeAddress = async (token, bridge, owner) => {
  await token.launchBridgeUpdate(bridge, { from: owner });
  skipGracePeriod();
  await token.executeBridgeUpdate({ from: owner });
};

contract('TotemToken', (accounts) => {
  const name = 'Test Token';
  const symbol = 'TST';
  const initialSupply = new BN('1000000000000000000000000', 10); // 1 millions tokens
  let token;
  const [owner, bridge, random, user] = accounts;

  beforeEach(async () => {
    token = await TotemToken.new(name, symbol, initialSupply, {
      from: owner,
    });
  });

  describe('initialisation', () => {
    it('should create a contract', async () => {
      assert.isTrue(true);
    });

    it('should mint at deployment', async () => {
      const res = await token.balanceOf(owner);
      assert.isTrue(res.eq(initialSupply));
    });

    it('should store owner address as owner', async () => {
      const res = await token.owner();
      assert(res === owner);
    });

    it('should leave bridge address to zero', async () => {
      const res = await token.getBridge();
      assert(res === ZERO_ADDRESS);
    });
  });

  describe('ERC20', () => {
    it('should have a name', async () => {
      const res = await token.name();
      assert(res === name);
    });

    it('should have a symbol', async () => {
      const res = await token.symbol();
      assert(res === symbol);
    });

    it('should have 18 decimals', async () => {
      const decimals = new BN(18, 10);
      const res = await token.decimals();
      assert(res.eq(decimals));
    });
  });

  describe('bridge update', () => {
    it('should launch bridge update', async () => {
      const receipt = await token.launchBridgeUpdate(bridge, { from: owner });
      const res = await token.getBridgeUpdate();

      expectEvent(receipt, 'BridgeUpdateLaunched', {
        newBridge: bridge,
      });
      assert(res.newBridge === bridge);
      assert(res.executed === false);
    });

    it('should not launch bridge update if not owner', async () => {
      await expectRevert(
        token.launchBridgeUpdate(bridge, { from: random }),
        'Ownable: caller is not the owner'
      );
    });

    it('should not launch bridge update if last one not executed', async () => {
      await token.launchBridgeUpdate(random, { from: owner });
      await expectRevert(
        token.launchBridgeUpdate(bridge, { from: owner }),
        'TotemToken: current update not yet executed'
      );
    });

    it('should execute bridge update', async () => {
      await token.launchBridgeUpdate(bridge, { from: owner });

      skipGracePeriod();

      const receipt = await token.executeBridgeUpdate({ from: owner });
      const resBridge = await token.getBridge();
      const resUpdate = await token.getBridgeUpdate();

      expectEvent(receipt, 'BridgeUpdateExecuted', {
        newBridge: bridge,
      });
      assert(resBridge === bridge);
      assert(resUpdate.executed === true);
    });

    it('should not execute bridge update if not owner', async () => {
      await token.launchBridgeUpdate(bridge, { from: owner });
      await expectRevert(
        token.executeBridgeUpdate({ from: random }),
        'Ownable: caller is not the owner'
      );
    });

    it('should launch bridge update if last one executed', async () => {
      await token.launchBridgeUpdate(random, { from: owner });

      skipGracePeriod();

      await token.executeBridgeUpdate({ from: owner });
      await token.launchBridgeUpdate(bridge, { from: owner });
    });

    it('should not launch bridge update if last one executed', async () => {
      await token.launchBridgeUpdate(random, { from: owner });

      skipGracePeriod();

      await token.executeBridgeUpdate({ from: owner });
      await token.launchBridgeUpdate(bridge, { from: owner });
    });

    it('should not execute bridge update before 7 days has passed', async () => {
      await token.launchBridgeUpdate(random, { from: owner });
      await expectRevert(
        token.executeBridgeUpdate({ from: owner }),
        'TotemToken: grace period has not finished'
      );
    });

    it('should not execute if already executed', async () => {
      await token.launchBridgeUpdate(random, { from: owner });
      skipGracePeriod();
      await token.executeBridgeUpdate({ from: owner });

      await expectRevert(
        token.executeBridgeUpdate({ from: owner }),
        'TotemToken: update already executed'
      );
    });
  });

  describe('bridge minting & burning', () => {
    it('should mint if bridge', async () => {
      await setBridgeAddress(token, bridge, owner);

      const amount = new BN('1000', 10);

      const initialBalance = await token.balanceOf(user);

      const receipt = await token.mintFromBridge(user, amount, {
        from: bridge,
      });

      const finalBalance = await token.balanceOf(user);

      expectEvent(receipt, 'Transfer', {
        from: ZERO_ADDRESS,
        to: user,
        value: amount,
      });
      assert(finalBalance.sub(initialBalance).eq(amount));
    });

    it('should not mint if bridge not initialised and zero address used', async () => {
      await expectRevert(
        token.mintFromBridge(user, '1000', {
          from: ZERO_ADDRESS,
        }),
        'error: sender account not recognized'
      );
    });

    it('should not mint if not bridge', async () => {
      await setBridgeAddress(token, bridge, owner);
      await expectRevert(
        token.mintFromBridge(user, '1000', {
          from: random,
        }),
        'TotemToken: access denied'
      );
    });

    it('should burn if bridge', async () => {
      await setBridgeAddress(token, bridge, owner);

      const amount = new BN('1000', 10);

      const initialBalance = await token.balanceOf(owner);

      const receipt = await token.burnFromBridge(owner, amount, {
        from: bridge,
      });

      const finalBalance = await token.balanceOf(owner);

      expectEvent(receipt, 'Transfer', {
        from: owner,
        to: ZERO_ADDRESS,
        value: amount,
      });
      assert(initialBalance.sub(finalBalance).eq(amount));
    });

    it('should not burn if bridge not initialised and zero address used', async () => {
      await expectRevert(
        token.burnFromBridge(owner, '1000', {
          from: ZERO_ADDRESS,
        }),
        'error: sender account not recognized'
      );
    });

    it('should not burn if not bridge', async () => {
      await setBridgeAddress(token, bridge, owner);
      await expectRevert(
        token.burnFromBridge(owner, '1000', {
          from: random,
        }),
        'TotemToken: access denied'
      );
    });
  });
});
