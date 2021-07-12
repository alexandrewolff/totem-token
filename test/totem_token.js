const bn = web3.utils.BN;
const totemToken = artifacts.require('TotemToken');

contract('TotemToken', (accounts) => {
  const initialSupply = new bn('1000000000000000000000000', 10); // 1 millions tokens
  let token;

  beforeEach(async () => {
    token = await totemToken.new('Test Token', 'TST', initialSupply, {
      from: accounts[0],
    });
  });

  it('should create a contract', async () => {
    assert.isTrue(true);
  });

  it('should mint at deployment', async () => {
    const balance = await token.balanceOf(accounts[0]);
    assert.isTrue(balance.eq(initialSupply));
  });
});
