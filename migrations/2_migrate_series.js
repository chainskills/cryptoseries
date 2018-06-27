var Series = artifacts.require("./Series.sol");

module.exports = function(deployer) {
  deployer.deploy(Series, "ProofOfCast", web3.toWei(0.005, "ether"), 14*24*60*60/15);
};
