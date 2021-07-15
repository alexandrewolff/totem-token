const TotemToken = artifacts.require('TotemToken');

const initialSupply = new web3.utils.BN('1000000000000000000000000', 10); // 1 millions tokens

module.exports = (deployer) => {
  deployer.deploy(TotemToken, 'Totem', 'TOT', initialSupply);
};
