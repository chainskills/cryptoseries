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
    /**
     * This function is called once the page is loaded and makes it possible for us to initialize our contract
     */
    start: function () {
        let self = this;

        // Bootstrap the Series contract abstraction for use.
        Series.setProvider(web3.currentProvider);

        // Get the initial account balance so it can be displayed.
        web3.eth.getAccounts(function (err, accs) {
            if (err != null) {
                alert("There was an error fetching your accounts.");
                return;
            }

            accounts = accs;
            account = accounts.length === 0 ? undefined : accounts[0];

            // we refresh the main UI
            self.refresh(account);
            // and finally we watch events in order to refresh the UI when some data is modified in the contract state
            self.watchEvents(account);
        });
    },

    /**
     * This function will be called every time something happens with our contract state, so that the interface
     * displays up-to-date information
     * @param account The account that's connected to the application in Metamask if any.
     * If no account is specify, the account-specific parts of the UI will simply be hidden
     */
    refresh: function (account) {
        App.refreshContractData();
        if (account) {
            $('#noAccountInfo').hide();
            $('#accountInfo').show();
            App.refreshAccountData(account);
        } else {
            $('#noAccountInfo').show();
            $('#accountInfo').hide();
        }
    },

    /**
     * This part refreshes all of the contract-generic data like number of supporters, pledge per episode and so on
     */
    refreshContractData: function () {
        // we show a progress indicator
        $('#cover-spin').show();

        let self = this;

        let series;
        // we reload the contract instance each time to make sure we are interacting with the latest one
        Series.deployed().then(function (instance) {
            // we keep a reference to the contract instance in order to be able to call several functions on it
            series = instance;
            // since we have the contract instance's address, we update the link in the support modal
            $('#supportContractAddress').prop('href', 'https://etherscan.io/address/' + instance.address);
            // we load the title of the series contract
            return series.title();
        }).then(function (title) {
            // we update the title in the main UI...
            $('#title').html(title);
            // ... as well as in the support dialog
            $('#supportSeriesTitle').html(title);
            // we load the minimum publication period
            return series.minimumPublicationPeriod();
        }).then(function (minimumPublicationPeriod) {
            // we push this piece of information to the main UI...
            $('#minimumPublicationPeriodBlocks').html("" + minimumPublicationPeriod);
            $('#minimumPublicationPeriodTime').html((minimumPublicationPeriod * 15 / 3600 / 24) + " days");
            // ...and to the support dialog
            $('#supportPublicationPeriodBlocks').html("" + minimumPublicationPeriod);
            // we load the pledge per episode
            return series.pledgePerEpisode();
        }).then(function (pledgePerEpisode) {
            // we push this piece of data to the main UI...
            $('#pledgePerEpisodeEth').html("" + web3.fromWei(pledgePerEpisode, "ether"));
            // ...and to the support modal
            $('#supportEth').val(web3.fromWei(pledgePerEpisode, "ether").toNumber());
            $('#supportPledgePerEpisode').html("" + web3.fromWei(pledgePerEpisode, "ether"));
            // and then we convert this amount in ETH into fiat currency (here, euros)
            self.getEtherPrice('EUR', function (price) {
                // and we display that information once the converstion was done asynchronously with
                $('#pledgePerEpisodeFiat').html("" + (price * web3.fromWei(pledgePerEpisode, "ether")).toFixed(2) + ' €');
            });
            // then we load the number of active supporters
            return series.activePledgers();
        }).then(function (activePledgers) {
            // and we show it in the main UI
            $('#activePledgers').html("" + activePledgers);
            // then we load the total number of supporters
            return series.totalPledgers();
        }).then(function (totalPledgers) {
            // and we show it in the main UI
            $('#totalPledgers').html("" + totalPledgers);
            // then we retrieve amount that the creator will receive on next publication, based on all the supporters
            // and their respective pledges
            return series.nextEpisodePay();
        }).then(function (nextEpisodePay) {
            // we show that piece of information in the main UI
            $('#nextEpisodePayEth').html('' + web3.fromWei(nextEpisodePay, "ether"));
            // and we convert it into fiat currency (here euros) to show it as well
            self.getEtherPrice('EUR', function (price) {
                $('#nextEpisodePayFiat').html("" + (price * web3.fromWei(nextEpisodePay, "ether")).toFixed(2) + ' €')
            });
            // at this stage, all the contract-generic data is loaded so we hide the progress indicator
            $('#cover-spin').hide();
        }).catch(function (error) {
            // in case an error happens in this loading process, it means the contract has been disabled
            // so we hide all the UI elements and show a message instead of the title
            $('#showInfo').hide();
            $('#supporters').hide();
            $('#yourSupport').hide();
            $('#episodes').hide();
            $('#episodeList').hide();
            $('#ownerFooter').hide();
            $('#title').html("This show was cancelled. You cannot support it anymore.");
            // and of course we don't forget to hide the progress indicator
            $('#cover-spin').hide();
        });
    },

    /**
     * This function refreshes all the account-specific data for the account currently selected in Metamask, if any
     * @param account The account connected to this app, if any. If none, this function does nothing.
     */
    refreshAccountData: function (account) {
        // if no account is currently selected in Metamask or Metamask is locked, don't do anything there
        if (undefined === account || null === account) {
            return
        }
        // otherwise, start by showing the progress indicator
        $('#cover-spin').show();

        // then let's load the instance of the contract
        // NB: it's better to load it every time to make sure that we are interacting with the latest instance
        let self = this;
        let series;
        let perEpisode;
        Series.deployed().then(function (instance) {
            series = instance;
            // once we have our instance, we check the amount the creator will get for each episode from each supporter
            // this will be useful later on to do some conditional updates on the UI
            return series.pledgePerEpisode();
        }).then(function (pledgePerEpisode) {
            // we save that data in a local variable to be referenced later
            perEpisode = pledgePerEpisode;
            // and then we retrieve the pledge for the current account
            return series.pledges(account);
        }).then(function (pledge) {
            // once we have that information, we can decide whether we should enable the withdraw button,
            // and the label of the support button
            if (pledge.toNumber() === 0) {
                $('#withdrawButton').prop('disabled', true);
                $('#pledgeButton').html('Support');
            } else {
                $('#withdrawButton').prop('disabled', false);
                $('#pledgeButton').html('Increase');
            }
            // if the current pledge is lower than the pledge per episode, then the current user is not
            // an active supporter of the show, and we are just warning him of that
            if (web3.fromWei(pledge) < web3.fromWei(perEpisode)) {
                $('#pledgeTooLowWarning').show();
            } else {
                $('#pledgeTooLowWarning').hide();
            }
            // then we update the UI in several places with that information
            let pledgeEth = "" + web3.fromWei(pledge, "ether");
            $('#pledgeEth').html(pledgeEth);
            $('#pledgeEpisodes').html("" + Math.floor(pledge / perEpisode));
            $('#withdrawPledgeEth').html(pledgeEth);
            // and we convert that amount in ETH into fiat currency (here, euros) to display it as well
            self.getEtherPrice('EUR', function (price) {
                let pledgeFiat = '' + (price * web3.fromWei(pledge, "ether")).toFixed(2) + " €";
                $('#pledgeFiat').html(pledgeFiat);
                $('#withdrawPledgeFiat').html(pledgeFiat);
            });

            // we then retrieve the address of the show owner to detect whether the current user is the creator himself or not
            return series.owner();
        }).then(function (owner) {
            // if the show creator is the connected user, we show the footer with the owner-specific actions (publish and close)
            // and we hide the support panel since the owner cannot support his own show
            if (account === owner) {
                $('#yourSupport').hide();
                $('#ownerFooter').show();
                // we will display a message and disable the publish button if it's too soon for the owner to publish a new episode
                // we need to know whether an episode has already published
                series.episodeCounter().then(function(episodeCounter) {
                    // otherwise publication is possible right away
                    if(episodeCounter.toNumber() === 0) {
                        $('#publishButton').prop('disabled', false);
                        $('#publishWait').html('You can publish whenever you want.');
                        $('#cover-spin').hide();
                    } else {
                        // if at least one episode has already been published, we will need 2 pieces of info from the contract: last publication block and minimum publication period
                        let lastPublicationBlockNumber, minimumPublicationPeriodNumber;
                        series.lastPublicationBlock().then(function(lastPublicationBlock) {
                            lastPublicationBlockNumber = lastPublicationBlock.toNumber();
                            return series.minimumPublicationPeriod();
                        }).then(function(minimumPublicationPeriod) {
                            minimumPublicationPeriodNumber = minimumPublicationPeriod.toNumber();
                            // once we have those 2 elements, we check the last block mined on the chain we are connected to
                            web3.eth.getBlockNumber(function(error, blockNumber) {
                                // and based on that we determine if the owner has to wait, and if yes, for how many blocks
                                if(lastPublicationBlockNumber + minimumPublicationPeriod > blockNumber) {
                                    $('#publishWait').html("You have to wait for " + (lastPublicationBlockNumber + minimumPublicationPeriodNumber - blockNumber) + " blocks before publishing again.");
                                    $('#publishButton').prop('disabled', true);
                                } else {
                                    $('#publishButton').prop('disabled', false);
                                    $('#publishWait').html('You can publish whenever you want.');
                                }
                                $('#cover-spin').hide();
                            });
                        });
                    }
                });
            } else {
                // if current user is not the owner, we hide the owner-specific buttons and show the supporter ones
                $('#yourSupport').show();
                $('#ownerFooter').hide();
            }
            // at this stage we can hide the progress indicator
            $('#cover-spin').hide();
        }).catch(function (error) {
            // if any error happens at this stage, we simply log it not to lose it
            console.error(error);
        });
    },

    /**
     * This function watches all events happening on the contract and refreshes the UI if anything happens
     * @param account The account currently selected in Metamask, if any.
     * If none, the account-specific information will be hidden.
     */
    watchEvents: function (account) {
        Series.deployed().then(function (instance) {
            instance.NewPledger({}, {}).watch(function (error, event) {
                App.refresh(account);
            });

            instance.NewPledge({}, {}).watch(function (error, event) {
                App.refresh(account);
            });

            instance.NewPublication({}, {}).watch(function (error, event) {
                App.refresh(account);
            });

            instance.Withdrawal({}, {}).watch(function (error, event) {
                App.refresh(account);
            });

            instance.PledgeInsufficient({}, {}).watch(function (error, event) {
                App.refresh(account);
            });

            instance.SeriesClosed({}, {}).watch(function (error, event) {
                App.refresh(account);
            })
        });
    },

    /**
     * This function is used to update the pledge amount in the support modal when the number of supported episodes changes
     */
    supportEpisodesChanged: function () {
        // we retrieve the support modal field corresponding to the number of episodes
        let supportEpisodesField = $('#supportEpisodes');
        // and we also keep a reference to the confirmation button in this modal to enable/disable it depending on the data
        let supportConfirmButton = $('#supportConfirmButton');

        // if the number of episodes to support is specified, we convert it into an Ether amount based on pledge-per-episode
        if (supportEpisodesField.val()) {
            let series;
            Series.deployed().then(function (instance) {
                series = instance;
                return series.pledgePerEpisode();
            }).then(function (pledgePerEpisode) {
                $('#supportEth').val(web3.fromWei(pledgePerEpisode, "ether") * supportEpisodesField.val());
            });
            // we also marke the fieled as valid in case it was previously marked as invalid
            supportEpisodesField.removeClass('is-invalid');
            // and we enable the confirmation button
            supportConfirmButton.prop('disabled', false);
        } else {
            // otherwise we mark the field as invalid
            supportEpisodesField.addClass('is-invalid');
            // and we disable the confirmation button
            supportConfirmButton.prop('disabled', true);
        }
    },

    /**
     * This function is used to update the number of supported episodes based on the amount to be pledged in the support modal
     */
    supportEthChanged: function () {
        // we keep a reference to the pledge amount field
        let supportEthField = $('#supportEth');
        // and to the confirmation button in the support modal
        let supportConfirmButton = $('#supportConfirmButton');

        // if the amount of the pledge is set, if it is a number and that number is strictly positive
        // then we calculate the number of episode this corresponds to and we change the value of that field accordingly
        if (supportEthField.val() && $.isNumeric(supportEthField.val()) && supportEthField.val() > 0) {
            let series;
            Series.deployed().then(function (instance) {
                series = instance;
                return series.pledgePerEpisode();
            }).then(function (pledgePerEpisode) {
                let numberOfEpisodes = Math.floor(supportEthField.val() / web3.fromWei(pledgePerEpisode, "ether"));
                $('#supportEpisodes').val(numberOfEpisodes);

                // in that case, the field is considered as valid and the button is enabled
                // note that even if the number of episodes to be supported is 0, then the sum of the new pledge plus
                // plus the one already in the contract can be greater than the pledge per episode, so any positive amount
                // is still valid
                supportEthField.removeClass('is-invalid');
                supportConfirmButton.prop('disabled', false);
            });
        } else {
            // otherwise the field is invalid and the confirmation button is disabled
            supportEthField.addClass('is-invalid');
            supportConfirmButton.prop('disabled', true);
        }
    },

    /**
     * CONTRACT TRANSACTIONS
     */

    /**
     * This function is called when the confirmation button in the support modal is clicked
     */
    pledge: function () {
        // we retrieve the value of the support modal Ether field
        // not the number of episodes because this one might be zero if amount in ETH is lower than pledge per episode
        let pledgeValue = $('#supportEth').val();
        // only if it's numeric and positive do we trigger the contract call
        if ($.isNumeric(pledgeValue) && pledgeValue > 0) {
            // we show a progress indicator because this action will trigger a transaction that will need to be mined
            // before the data for the contract can be updated
            $('#cover-spin').show();
            // we reload the active account to make sure we have the right one
            web3.eth.getAccounts(function (error, accounts) {
                // we make sure an account is selected (Metamask is unlocked)
                if (accounts && accounts.length > 0) {
                    Series.deployed().then(function (instance) {
                        // the user specifies the pledge value in ETH, so we need to convert it into wei before calling the contract
                        let value = web3.toWei(pledgeValue, "ether");
                        // we call the pledge function on the contract, specifying a gas value that corresponds to an upper value estimation
                        // of how complex this operation will be
                        return instance.pledge({from: accounts[0], value: value, gas: 500000});
                    }).then(function (result) {
                        // result contains the receipt of the transaction that was triggered
                        console.log(result);
                        // in some node implementation, no exception is triggered on a failing transaction and we have to check
                        // the status field in the transaction receipt
                        if (result.receipt.status === '0x01') {
                            // if transaction is successful, we can hide the support modal
                            $('#supportModal').modal('hide');
                            // then reset it for next time
                            $('#supportEpisodes').val(1);
                            App.supportEpisodesChanged();
                        } else {
                            console.error("Transaction didn't succeed");
                        }
                    }).catch(function (error) {
                        // if an error occurs, we simply hide the progress indicator and log the error
                        // we could also display an error message to the user here
                        $('#cover-spin').hide();
                        console.error(error);
                    });
                } else {
                    // if Metamask is locked, we simply hide the progress indicator
                    $('#cover-spin').hide();
                }
            });
        }
    },

    /**
     * This function is called when the user confirms he wants to recover his entire pledge
     */
    withdraw: function () {
        // we retrieve the address of the connected account
        web3.eth.getAccounts(function (error, accounts) {
            if (accounts && accounts.length > 0) {
                // we can hide the modal right away
                $('#withdrawModal').modal('hide');
                // we show a progress indicator
                $('#cover-spin').show();
                Series.deployed().then(function (instance) {
                    // and we call the contract's withdraw function,
                    // specifying an amount of gas corresponding to an estimation of the upper bound for the cost of this operation
                    return instance.withdraw({from: accounts[0], gas: 500000});
                }).then(function (result) {
                    // in some node implementation, no exception is thrown when a transaction fails,
                    // so we have to check the status of the transaction receipt
                    if (result.receipt.status !== '0x01') {
                        console.error("Transaction didn't succeed");
                    }
                }).catch(function (error) {
                    // in case of an error, we simply hide the progress indicator and log the error
                    // but we could also display an error message for the user here
                    $('#cover-spin').hide();
                    console.error(error);
                });
            }
        });
    },

    publish: function () {
        let episodeLinkField = $('#episodeLink');
        let episodeLink = episodeLinkField.val();
        if (episodeLink && episodeLink.length > 0) {
            episodeLinkField.removeClass('is-invalid');
            // we retrieve the address of the connected account
            web3.eth.getAccounts(function (error, accounts) {
                if (accounts && accounts.length > 0) {
                    // we show a progress indicator
                    $('#cover-spin').show();
                    Series.deployed().then(function (instance) {
                        // and we call the contract's publish function,
                        // specifying an amount of gas corresponding to an estimation of the upper bound for the cost of this operation
                        return instance.publish(episodeLink, {from: accounts[0], gas: 500000});
                    }).then(function (result) {
                        // in some node implementation, no exception is thrown when a transaction fails,
                        // so we have to check the status of the transaction receipt
                        if (result.receipt.status === '0x01') {
                            // if everything went smoothly, we simply hide the modal, and the UI will be refreshed based on the event watcher
                            $('#publishModal').modal('hide');
                        } else {
                            console.error("Transaction didn't succeed");
                        }
                    }).catch(function (error) {
                        // in case of an error, we simply hide the progress indicator and log the error
                        // but we could also display an error message for the user here
                        $('#cover-spin').hide();
                        console.error(error);
                    });
                }
            });
        } else {
            episodeLinkField.addClass('is-invalid');
        }
    },

    /**
     * This function is called when the owner of the contract has confirmed that he wants to cancel the show
     * and send all their money back to his supporters
     */
    close: function () {
        // we reload the connected account
        web3.eth.getAccounts(function (error, accounts) {
            if (accounts && accounts.length > 0) {
                // we show a progress indicator
                $('#cover-spin').show();
                // we reload the contract instance
                Series.deployed().then(function (instance) {
                    // we call the close function, specifying a gas amount that corresponds to an estimation
                    // of the cost of this operation. Note that if there are too many supporters to pay back
                    // this operation may fail
                    return instance.close({from: accounts[0], gas: 500000});
                }).then(function (result) {
                    // given that certain node implementations don't throw an exception when a transaction fail
                    // we check the status of the transaction receipt
                    if (result.receipt.status === '0x01') {
                        // if everything is OK, we simply hide the modal and event watchers will update the UI later
                        $('#closeModal').modal('hide');
                    } else {
                        console.error("Transaction didn't succeed");
                    }
                }).catch(function (error) {
                    $('#cover-spin').hide();
                    console.error(error);
                })
            }
        });
    },

    /**
     * UTILITY FUNCTIONS
     */

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

    /**
     * This function retrieves the price of 1 ETH in the specified currency from CryptoCompare
     * @param fiat The fiat currency symbol to retrieve the price in: EUR or USD
     * @param callback The function that's called when the price is recovered, that takes the price of 1 ETH
     * in 'fiat' currency as a parameter
     */
    getEtherPrice: function (fiat, callback) {
        $.getJSON('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD,EUR', function (data) {
            callback(data[fiat]);
        });
    },
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
