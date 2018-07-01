let Series = artifacts.require("./Series.sol");

contract('Series', function (accounts) {
    let seriesInstance = null;
    let minPledge = 0;
    let minFrequency = 0;

    it("is correctly initialized", function (done) {
        Series.deployed().then(function(instance) {
            seriesInstance = instance;
            return instance.title();
        }).then(function(title) {
            assert.notEqual(title, "", "Title should not be empty");
            return seriesInstance.pledgePerEpisode();
        }).then(function(pledgePerEpisode) {
            assert.notEqual(pledgePerEpisode, 0, "Pledge per episode should not be zero");
            return seriesInstance.minimumPublicationFrequency();
        }).then(function(minimumPublicationFrequency) {
            assert.notEqual(minimumPublicationFrequency, 0, "Minimum publication frequency should not be zero");
            return seriesInstance.totalPledgers();
        }).then(function(totalPledgers) {
            assert.equal(totalPledgers, 0, "There should be no pledger yet");
            return seriesInstance.activePledgers();
        }).then(function(activePledgers){
            assert.equal(activePledgers, 0, "There should be no active pledger yet");
            done();
        });
    });

    it("accepts pledges", function(done) {
        Series.deployed().then(function(instance) {
            seriesInstance = instance;
            return instance.pledgePerEpisode();
        }).then(function(result) {
            minPledge = result;
            return seriesInstance.minimumPublicationFrequency();
        }).then(function(result) {
            minFrequency = result;
            return seriesInstance.pledge({value: minPledge * 10, from: accounts[1]});
        }).then(function(result){
            assert.equal(result.receipt.status, 0x01, "Pledge should have been successful");
            assert.equal(result.logs.length, 2, "2 events should have been triggered by the pledge operation");
            const newPledgerEvent = result.logs[0];
            const newPledgeEvent = result.logs[1];
            assert.equal(newPledgerEvent.event, "NewPledger", "Pledge should have emitted a NewPledger event");
            assert.equal(newPledgerEvent.args['pledger'], accounts[1], "NewPledger pledger should be caller of pledge");
            assert.equal(newPledgeEvent.event, "NewPledge", "Pledge should have emitted a NewPledge event");
            assert.equal(newPledgeEvent.args['pledger'], accounts[1], "NewPledge pledger should be caller of pledge");
            assert.equal(newPledgeEvent.args['pledge'], minPledge * 10, "NewPledge pledge should correspond to the amount pledged");
            assert.equal(newPledgeEvent.args['totalPledge'], minPledge * 10, "NewPledge total pledge should correspond to the amount pledged");

            return web3.eth.getBalance(seriesInstance.address);
        }).then(function(contractBalance) {
            assert.equal(contractBalance.toNumber(), minPledge * 10, "Contract balance should be equal to pledge");

            return seriesInstance.totalPledgers();
        }).then(function(result) {
            assert.equal(result.toNumber(), 1, "There should be 1 pledger after first call to pledge");
            return seriesInstance.activePledgers();
        }).then(function(result){
            assert.equal(result.toNumber(), 1, "There should be 1 active pledger after first call to pledge");
            return seriesInstance.nextEpisodePay();
        }).then(function(result) {
            assert.equal(result.toNumber(), minPledge.toNumber(), "Since there's only one pledger at this stage, next episode pay should be minimum pledge");
            return seriesInstance.publish('0x1', {from: accounts[0]});
        }).then(function(result){
            assert.equal(result.receipt.status, 0x01, "Publish should have been successful");
            assert.equal(result.logs.length, 1, "1 event should have been emitted by publish operation");
            const newPublicationEvent = result.logs[0];
            assert.equal(newPublicationEvent.event, "NewPublication");
            assert.equal(newPublicationEvent.args['episodeHash'], '0x1000000000000000000000000000000000000000000000000000000000000000', "NewPublicationEvent episode hash should correspond to the one published");
            assert.equal(newPublicationEvent.args['episodePay'].toNumber(), minPledge.toNumber(), "Episode pay should correspond to pledge per episode");

            return seriesInstance.pledges(accounts[1]);
        }).then(function(result) {
            assert.equal(result.toNumber(), 9 * minPledge.toNumber(), "Pledger's pledge should be adapted");
            return seriesInstance.withdraw({from: accounts[1]});
        }).then(function(result) {
            assert.equal(result.receipt.status, 0x01, "Withdraw should have been successful");
            assert.equal(result.logs.length, 2, "2 events should have been triggered by withdraw");
            let withdrawalEvent = result.logs[0];
            assert.equal(withdrawalEvent.event, "Withdrawal", "Withdrawal event should have been emitted by withdraw");
            assert.equal(withdrawalEvent.args['pledger'], accounts[1], "Withdrawal event pledger should be " + accounts[1]);
            assert.equal(withdrawalEvent.args['pledge'].toNumber(), minPledge.toNumber() * 9, "Withdrawal event pledge should be " + (minPledge.toNumber() * 9));

            let pledgeInsufficientEvent = result.logs[1];
            assert.equal(pledgeInsufficientEvent.event, "PledgeInsufficient", "PledgeInsufficient event should have been emitted by withdraw");
            assert.equal(pledgeInsufficientEvent.args['pledger'], accounts[1], "PledgeInsufficient pledger should be " + accounts[1]);
            assert.equal(pledgeInsufficientEvent.args['pledge'].toNumber(), 0, "PledgeInsufficient pledge should be 0");
            return seriesInstance.totalPledgers();
        }).then(function(result){
            assert.equal(result.toNumber(), 1, "Total pledgers should still be 1, even after withdraw");
            return seriesInstance.activePledgers();
        }).then(function(result){
            assert.equal(result.toNumber(), 0, "There shouldn't be any more active pledger after withdrawal of the only pledger");
            done();
        });
    });
});
