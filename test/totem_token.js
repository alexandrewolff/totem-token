const totemToken = artifacts.require('TotemToken');

const {
  constants,
  expectRevert,
  expectEvent,
  time,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const bn = web3.utils.BN;

const skipGracePeriod = () => time.increase(time.duration.days(7));

const setBridgeAddress = async (token, bridge, owner) => {
  await token.launchBridgeUpdate(bridge, { from: owner });
  skipGracePeriod();
  await token.executeBridgeUpdate({ from: owner });
};

contract('TotemToken', (accounts) => {
  const initialSupply = new bn('1000000000000000000000000', 10); // 1 millions tokens
  let token;
  const [owner, bridge, random, user] = accounts;

  beforeEach(async () => {
    token = await totemToken.new('Test Token', 'TST', initialSupply, {
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

  describe('bridge update', () => {
    it('should launch bridge update', async () => {
      const receipt = await token.launchBridgeUpdate(bridge, { from: owner });
      const res = await token.getBridgeUpdate();

      expectEvent(receipt, 'BridgeUpdateLaunched', {
        newBridge: bridge,
      });
      assert(res.newBridge === bridge);
    });

    it('should execute bridge update', async () => {
      await token.launchBridgeUpdate(bridge, { from: owner });

      skipGracePeriod();

      const receipt = await token.executeBridgeUpdate({ from: owner });
      const res = await token.getBridge();

      expectEvent(receipt, 'BridgeUpdateExecuted', {
        newBridge: bridge,
      });
      assert(res === bridge);
    });

    it('should not launch bridge update if not owner', async () => {
      await expectRevert(
        token.launchBridgeUpdate(bridge, { from: random }),
        'Ownable: caller is not the owner'
      );
    });

    it('should not execute bridge update if not owner', async () => {
      await token.launchBridgeUpdate(bridge, { from: owner });
      await expectRevert(
        token.executeBridgeUpdate({ from: random }),
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
  });

  describe('bridge minting & burning', () => {
    it('should mint if bridge', async () => {
      await setBridgeAddress(token, bridge, owner);

      const amount = new bn('1000', 10);

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

      const amount = new bn('1000', 10);

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

    it('should not burn if not bridge', async () => {
      await setBridgeAddress(token, bridge, owner);
      await expectRevert(
        token.burnFromBridge(user, '1000', {
          from: random,
        }),
        'TotemToken: access denied'
      );
    });
  });
});
