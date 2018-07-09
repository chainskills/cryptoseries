// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";
// Import libraries we need.
import {default as Web3} from 'web3';
import {default as contract} from 'truffle-contract'
// Import our contract artifacts and turn them into usable abstractions.
import series_artifacts from '../../build/contracts/Series.json'
let Series = contract(series_artifacts);

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
let accounts;
let account;

window.App = {
    start: function () {
        let self = this;

        // Bootstrap the MetaCoin abstraction for Use.
        Series.setProvider(web3.currentProvider);

        // Get the initial account balance so it can be displayed.
        web3.eth.getAccounts(function (err, accs) {
            if (err != null) {
                alert("There was an error fetching your accounts.");
                return;
            }

            if (accs.length === 0) {
                $('#noAccountInfo').show();
                $('#accountInfo').hide();
            } else {
                $('#noAccountInfo').hide();
                $('#accountInfo').show();
            }

            accounts = accs;
            account = accounts.length === 0 ? undefined : accounts[0];

            self.refreshContractData();
            if (accounts.length > 0) {
                self.refreshAccountData(account);
            }
            self.watchEvents(account);
        });
    },

    refreshContractData: function () {
        let self = this;

        let series;
        Series.deployed().then(function (instance) {
            console.log("instance:", instance);
            series = instance;
            $('#supportContractAddress').prop('href', 'https://etherscan.io/address/' + instance.address);
            return series.title();
        }).then(function (title) {
            console.log("title", title);
            $('#title').html(title);
            $('#supportSeriesTitle').html(title);
            return series.minimumPublicationFrequency();
        }).then(function (minimumPublicationFrequency) {
            $('#minimumPublicationFrequencyBlocks').html("" + minimumPublicationFrequency);
            $('#minimumPublicationFrequencyTime').html((minimumPublicationFrequency * 15 / 3600 / 24) + " days");
            $('#supportPublicationFrequencyBlocks').html("" + minimumPublicationFrequency);
            return series.pledgePerEpisode();
        }).then(function (pledgePerEpisode) {
            $('#pledgePerEpisodeEth').html("" + web3.fromWei(pledgePerEpisode, "ether"));
            $('#supportEth').val(web3.fromWei(pledgePerEpisode, "ether").toNumber());
            $('#supportPledgePerEpisode').html("" + web3.fromWei(pledgePerEpisode, "ether"));
            self.getEtherPrice('EUR', function (price) {
                $('#pledgePerEpisodeFiat').html("" + (price * web3.fromWei(pledgePerEpisode, "ether")).toFixed(2) + ' €');
            });
            return series.activePledgers();
        }).then(function (activePledgers) {
            $('#activePledgers').html("" + activePledgers);
            return series.totalPledgers();
        }).then(function (totalPledgers) {
            $('#totalPledgers').html("" + totalPledgers);
            return series.nextEpisodePay();
        }).then(function (nextEpisodePay) {
            $('#nextEpisodePayEth').html('' + web3.fromWei(nextEpisodePay, "ether"));
            self.getEtherPrice('EUR', function (price) {
                $('#nextEpisodePayFiat').html("" + (price * web3.fromWei(nextEpisodePay, "ether")).toFixed(2) + ' €')
            })
        }).catch(function(error){
            $('#showInfo').hide();
            $('#supporters').hide();
            $('#yourSupport').hide();
            $('#episodes').hide();
            $('#episodeList').hide();
            $('#ownerFooter').hide();
            $('#title').html("This show was cancelled. You cannot support it anymore.")
        });
    },

    supportEpisodesChanged: function (event) {
        let supportEpisodesField = $('#supportEpisodes');
        let supportConfirmButton = $('#supportConfirmButton');

        if (supportEpisodesField.val()) {
            let series;
            Series.deployed().then(function (instance) {
                series = instance;
                return series.pledgePerEpisode();
            }).then(function (pledgePerEpisode) {
                $('#supportEth').val(web3.fromWei(pledgePerEpisode, "ether") * supportEpisodesField.val());
            });
            supportEpisodesField.removeClass('is-invalid');
            supportConfirmButton.prop('disabled', false);
        } else {
            supportEpisodesField.addClass('is-invalid');
            supportConfirmButton.prop('disabled', true);
        }
    },

    supportEthChanged: function (event) {
        let supportEthField = $('#supportEth');
        let supportConfirmButton = $('#supportConfirmButton');

        if (supportEthField.val() && $.isNumeric(supportEthField.val()) && supportEthField.val() > 0) {
            let series;
            Series.deployed().then(function (instance) {
                series = instance;
                return series.pledgePerEpisode();
            }).then(function (pledgePerEpisode) {
                let numberOfEpisodes = Math.floor(supportEthField.val() / web3.fromWei(pledgePerEpisode, "ether"));
                $('#supportEpisodes').val(numberOfEpisodes);
                if(numberOfEpisodes < 1) {
                    supportEthField.addClass('is-invalid');
                    supportConfirmButton.prop('disabled', true);
                } else {
                    supportEthField.removeClass('is-invalid');
                    supportConfirmButton.prop('disabled', false);
                }
            });
        } else {
            supportEthField.addClass('is-invalid');
            supportConfirmButton.prop('disabled', true);
        }
    },

    refreshAccountData: function (account) {
        let self = this;
        let series;
        let perEpisode;
        Series.deployed().then(function (instance) {
            series = instance;
            return series.pledgePerEpisode();
        }).then(function (pledgePerEpisode) {
            perEpisode = pledgePerEpisode;
            return series.pledges(account);
        }).then(function (pledge) {
            if (pledge.toNumber() === 0) {
                $('#withdrawButton').prop('disabled', true);
                $('#pledgeButton').html('Support');
            } else {
                $('#withdrawButton').prop('disabled', false);
                $('#pledgeButton').html('Increase');
            }
            if (web3.fromWei(pledge) < web3.fromWei(perEpisode)) {
                $('#pledgeTooLowWarning').show();
            } else {
                $('#pledgeTooLowWarning').hide();
            }
            let pledgeEth = "" + web3.fromWei(pledge, "ether");
            $('#pledgeEth').html(pledgeEth);
            $('#pledgeEpisodes').html("" + Math.floor(pledge / perEpisode));
            $('#withdrawPledgeEth').html(pledgeEth);
            self.getEtherPrice('EUR', function (price) {
                let pledgeFiat = '' + (price * web3.fromWei(pledge, "ether")).toFixed(2) + " €";
                $('#pledgeFiat').html(pledgeFiat);
                $('#withdrawPledgeFiat').html(pledgeFiat);
            });

            return series.owner();
        }).then(function (owner) {
            if (account === owner) {
                $('#yourSupport').hide();
                $('#ownerFooter').show();
            } else {
                $('#yourSupport').show();
                $('#ownerFooter').hide();
            }
        });
    },

    refresh: function(account) {
        App.refreshContractData();
        if(account) {
            App.refreshAccountData(account);
        }
    },

    watchEvents: function(account) {
        Series.deployed().then(function(instance) {
            instance.NewPledger({}, {}).watch(function(error, event) {
                App.refresh(account);
            });

            instance.NewPledge({}, {}).watch(function(error, event) {
                App.refresh(account);
            });

            instance.NewPublication({}, {}).watch(function(error, event){
                App.refresh(account);
            });

            instance.Withdrawal({}, {}).watch(function(error, event) {
                App.refresh(account);
            });

            instance.PledgeInsufficient({}, {}).watch(function(error, event) {
                App.refresh(account);
            });

            instance.SeriesClosed({}, {}).watch(function(error, event) {
                App.refresh(account);
            })
        });
    },

    getEtherPrice: function (fiat, callback) {
        $.getJSON('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD,EUR', function (data) {
            callback(data[fiat]);
        });
    },

    pledge: function(event) {
        let pledgeValue = $('#supportEth').val();
        if($.isNumeric(pledgeValue) && pledgeValue > 0) {
            web3.eth.getAccounts(function(error, accounts) {
                if(accounts && accounts.length > 0) {
                    Series.deployed().then(function(instance) {
                        let value = web3.toWei(pledgeValue, "ether");
                        return instance.pledge({from: accounts[0], value: value, gas: 500000});
                    }).then(function(result){
                        console.log(result);
                        if(result.receipt.status === '0x01') {
                            $('#supportModal').modal('hide');
                            $('#supportEpisodes').val(1);
                            App.supportEpisodesChanged();
                        } else {
                            console.error("Transaction didn't succeed");
                        }
                    }).catch(function(error) {
                        console.error(error);
                    });
                }
            });
        }
    },

    withdraw: function() {
        web3.eth.getAccounts(function(error, accounts) {
            if(accounts && accounts.length > 0) {
                Series.deployed().then(function(instance) {
                    return instance.withdraw({from: accounts[0], gas: 500000});
                }).then(function(result) {
                    if(result.receipt.status === '0x01'){
                        $('#withdrawModal').modal('hide');
                    } else {
                        console.error("Transaction didn't succeed");
                    }
                }).catch(function(error) {
                    console.error(error);
                })
            }
        });
    },

    close: function() {
        web3.eth.getAccounts(function(error, accounts) {
            if(accounts && accounts.length > 0) {
                Series.deployed().then(function(instance) {
                    return instance.close({from: accounts[0], gas: 500000});
                }).then(function(result) {
                    if(result.receipt.status === '0x01'){
                        $('#closeModal').modal('hide');
                    } else {
                        console.error("Transaction didn't succeed");
                    }
                }).catch(function(error) {
                    console.error(error);
                })
            }
        });
    }

    /*ipfsHashToBytes32: function(ipfs_hash) {
        let h = bs58.decode(ipfs_hash).toString('hex').replace(/^1220/, '');
        if (h.length != 64) {
            console.error('invalid ipfs format', ipfs_hash, h);
            return null;
        }
        return '0x' + h;
    },

    bytes32ToIPFSHash: function(hash_hex) {
        let buf = new Buffer(hash_hex.replace(/^0x/, '1220'), 'hex')
        return bs58.encode(buf)
    },*/
};

window.addEventListener('load', function () {
    // Checking if Web3 has been injected by the browser (Mist/MetaMask)
    if (typeof web3 !== 'undefined') {
        //console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
        // Use Mist/MetaMask's provider
        window.web3 = new Web3(web3.currentProvider);
    } else {
        console.warn("No web3 detected. Falling back to http://127.0.0.1:9545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
        // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
        window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:9545"));
    }

    App.start();
});
