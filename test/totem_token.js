const totemToken = artifacts.require("TotemToken");

contract("TotemToken", (/* accounts */) => {
  it("should find a contract", async () => {
    await totemToken.deployed();
    assert.isTrue(true);
  });
});
