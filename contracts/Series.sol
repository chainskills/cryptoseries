pragma solidity ^0.4.22;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract Series is Ownable {
  using SafeMath for uint;
  
  //title of the series
  string public title;
  //amount that the owner will receive from each pledger for each episode
  uint public pledgePerEpisode;
  //periodicity of episodes, in number of blocks
  //to limit the possibility of owner to drain pledgers' accounts by publishing multiple episodes quickly
  uint public minimumPublicationPeriod;

  //to keep track of how much each publisher pledged, knowing that this pledge will decrease each time a new episode is published, or when a pledger withdraws everything from his account
  mapping(address => uint) public pledges;
  //to keep a list of all the pledgers into the series
  address[] pledgers;
  //to keep track of the last time an episode was published, and limit the frequency of publications
  uint public lastPublicationBlock;
  //to keep track of all published episodes
  mapping(uint => string) public publishedEpisodes;
  uint public episodeCounter;

  //events
  /*
  * Emitted when a new pledger joins the series
  * @param pledger Address of the new pledger
  */
  event NewPledger(address pledger);
  /*
  * Emitted when a pledger pledges some amount, whether he is a new pledger or a previous one just topping up his account
  * @param pledger Address of the pledger
  * @param pledge Amount pledged this time
  * @param totalPledge Balance of this pledger's account including what he just pledged
  */
  event NewPledge(address indexed pledger, uint pledge, uint totalPledge);
  /*
  * Emitted when the owner published a new episode
  * @param episodeHash Hash of the published episode
  * @param episodePay How much the owner received for this episode
  */
  event NewPublication(uint episodeId, string episodeLink, uint episodePay);
  /*
  * Emitted when a pledger withdraws all his pledge from his account
  * @param pledger Address of the withdrawing pledger
  * @param pledge Amount that was sent back to the pledger
  */
  event Withdrawal(address indexed pledger, uint pledge);
  /*
  * Emitted when a pledge goes lower than pledgePerEpisode, that can be used to notify the pledger that he should top up his account before next episode is published
  * @param pledger Address of the pledger
  * @param pledge Current balance of the pledger
  */
  event PledgeInsufficient(address indexed pledger, uint pledge);

  /*
  * Emitted when the show is closed by the owner
  * @param balanceBeforeClose Balance of the contract at the moment of closing
  */
  event SeriesClosed(uint balanceBeforeClose);

  /*
  * Configures the series parameters
  * @param title Title of the series
  * @param pledgePerEpisode Amount the owner will receive for each episode from each pledger
  * @param minimumPublicationPeriod Number of blocks the owner will have to wait between 2 publications
  */
  constructor(string _title, uint _pledgePerEpisode, uint _minimumPublicationPeriod) public {
    title = _title;
    pledgePerEpisode = _pledgePerEpisode;
    minimumPublicationPeriod = _minimumPublicationPeriod;
  }

  /*
  * Lets someone increase their pledge.
  * The first time you pledge, you must pledge at least the minimum pledge per episode.
  * Then for every new pledge, the amount you already pledged plus the new amount must be at least the minimum pledge per episode
  * This function is payable so the pledge must be transmitted with msg.value
  * The owner cannot pledge on its own series.
  */
  function pledge() public payable {
    require(msg.value.add(pledges[msg.sender]) >= pledgePerEpisode, "Pledge must be greater than minimum pledge per episode");
    require(msg.sender != owner, "Owner cannot pledge on its own series");
    bool oldPledger = false;
    for(uint i = 0; i < pledgers.length; i++) {
      if(pledgers[i] == msg.sender) {
        oldPledger = true;
        break;
      }
    }
    if(!oldPledger) {
      pledgers.push(msg.sender);
      emit NewPledger(msg.sender);
    }
    pledges[msg.sender] = pledges[msg.sender].add(msg.value);
    emit NewPledge(msg.sender, msg.value, pledges[msg.sender]);
  }

  /*
  * Total number of pledgers, whether they are still active or not,
  * that is the number of accounts that have pledged at some point
  */
  function totalPledgers() public view returns (uint) {
    return pledgers.length;
  }

  /*
  * Number of active pledgers, that is number of pledgers whose pledge is still
  * greater than minimum pledge per episode
  */
  function activePledgers() public view returns (uint) {
    uint active = 0;
    for(uint i = 0; i < pledgers.length; i++) {
      if(pledges[pledgers[i]] > pledgePerEpisode) {
        active++;
      }
    }
    return active;
  }

  /*
  * Calculate how much the owner will get paid for next episode
  */
  function nextEpisodePay() public view returns (uint) {
    uint episodePay = 0;
    for(uint i = 0; i < pledgers.length; i++) {
      if(pledges[pledgers[i]] > pledgePerEpisode) {
        episodePay = episodePay.add(pledgePerEpisode);
      }
    }

    return episodePay;
  }

  /*
  * This function can only be called by the owner.
  * And it can only be called if at least minimumPublicationPeriod blocks have passed since lastPublicationBlock
  * If those prerequisites are met, then the owner receives pledgePerEpisode times number of pledgers whose pledge is still greater than pledgePerEpisode
  * @param episodeLink Link to download the episode
  */
  function publish(string episodeLink) public onlyOwner {
    require(lastPublicationBlock == 0 || block.number > lastPublicationBlock.add(minimumPublicationPeriod), "Owner cannot publish again so soon");

    lastPublicationBlock = block.number;
    episodeCounter++;
    publishedEpisodes[episodeCounter] = episodeLink;

    //calculate episode pay by reusing a view function
    uint episodePay = nextEpisodePay();

    //update pledges
    for(uint i = 0; i < pledgers.length; i++) {
      if(pledges[pledgers[i]] > pledgePerEpisode) {
        pledges[pledgers[i]] = pledges[pledgers[i]].sub(pledgePerEpisode);
        if(pledges[pledgers[i]] < pledgePerEpisode) {
          emit PledgeInsufficient(pledgers[i], pledges[pledgers[i]]);
        }
      }
    }

    //pay the owner
    owner.transfer(episodePay);
    emit NewPublication(episodeCounter, episodeLink, episodePay);
  }

  /*
  * Let a pledger withdraw his entire pledge from his account
  */
  function withdraw() public {
    uint amount = pledges[msg.sender];
    if(amount > 0) {
      pledges[msg.sender] = 0;
      msg.sender.transfer(amount);
      emit Withdrawal(msg.sender, amount);
      emit PledgeInsufficient(msg.sender, 0);
    }
  }

  /*
  * Give their money back to all pledgers before killing the contract
  */
  function close() public onlyOwner {
    uint contractBalance = address(this).balance;
    for(uint i = 0; i < pledgers.length; i++) {
      uint amount = pledges[pledgers[i]];
      if(amount > 0) {
        pledges[pledgers[i]] = 0;
        pledgers[i].transfer(amount);
      }
    }
    emit SeriesClosed(contractBalance);
    selfdestruct(owner);
  }
}
