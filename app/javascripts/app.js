// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import series_artifacts from '../../build/contracts/Series.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
let Series = contract(series_artifacts);

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
let accounts;
let account;

window.App = {
  start: function() {
    let self = this;

    // Bootstrap the MetaCoin abstraction for Use.
    Series.setProvider(web3.currentProvider);

    // Get the initial account balance so it can be displayed.
    web3.eth.getAccounts(function(err, accs) {
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
      if(accounts.length > 0) {
        self.refreshAccountData(account);
      }
    });
  },

  refreshContractData: function() {
    let self = this;

    let series;
    Series.deployed().then(function(instance) {
      series = instance;
      return series.title();
    }).then(function(title) {
      $('#title').html(title);
      return series.minimumPublicationFrequency();
    }).then(function(minimumPublicationFrequency) {
      $('#minimumPublicationFrequencyBlocks').html("" + minimumPublicationFrequency);
      $('#minimumPublicationFrequencyTime').html((minimumPublicationFrequency*15/3600/24) + " days");
      return series.pledgePerEpisode();
    }).then(function(pledgePerEpisode) {
      $('#pledgePerEpisodeEth').html("" + web3.fromWei(pledgePerEpisode, "ether"));
      self.getEtherPrice('EUR', function(price) {
        $('#pledgePerEpisodeFiat').html("" + (price * web3.fromWei(pledgePerEpisode, "ether")).toFixed(2) + ' €');
      });
      return series.activePledgers();
    }).then(function(activePledgers){
      $('#activePledgers').html("" + activePledgers);
      return series.totalPledgers();
    }).then(function(totalPledgers) {
      $('#totalPledgers').html("" + totalPledgers);
      return series.nextEpisodePay();
    }).then(function(nextEpisodePay) {
      $('#nextEpisodePayEth').html('' + web3.fromWei(nextEpisodePay, "ether"));
      self.getEtherPrice('EUR', function(price) {
        $('#nextEpisodePayFiat').html("" + (price * web3.fromWei(nextEpisodePay, "ether")).toFixed(2) + ' €')
      })
    });
  },

    refreshAccountData: function(account) {
      let self = this;
      let series;
      let perEpisode;
      Series.deployed().then(function(instance) {
          series = instance;
          return series.pledgePerEpisode();
      }).then(function(pledgePerEpisode) {
        perEpisode = pledgePerEpisode;
        return series.pledges(account);
      }).then(function(pledge) {
        if(pledge.toNumber() === 0) {
            $('#withdrawButton').prop('disabled', true);
        } else {
            $('#withdrawButton').prop('disabled', false);
        }
        if(pledge < perEpisode) {
          $('#pledgeTooLowWarning').show();
        } else {
          $('#pledgeTooLowWarning').hide();
        }
        $('#pledgeEth').html("" + web3.fromWei(pledge, "ether"));
        $('#pledgeEpisodes').html("" + Math.floor(pledge / perEpisode));
        self.getEtherPrice('EUR', function(price) {
          $('#pledgeFiat').html('' + (price * web3.fromWei(pledge, "ether")).toFixed(2) + " €");
        });

        return series.owner();
      }).then(function(owner) {
        if(account === owner) {
          $('#yourSupport').hide();
          $('#closeButton').show();
          $('#publishButton').show();
        } else {
            $('#yourSupport').show();
            $('#closeButton').hide();
            $('#publishButton').hide();
        }
      });
    },

    getEtherPrice: function(fiat, callback) {
      $.getJSON('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD,EUR', function(data) {
        callback(data[fiat]);
      });
    }
};

window.addEventListener('load', function() {
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
