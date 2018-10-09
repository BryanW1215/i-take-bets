pragma solidity ^0.4.17;

contract BetFactory {
    address[] public deployedBets;
    address public masterAccount;

    function BetFactory() public {
        masterAccount = msg.sender;
    }

    function createBet(uint minimum, uint8 choiceCount, string data) public {
        address newBet = new Bet(masterAccount, msg.sender, minimum, choiceCount, data);
        deployedBets.push(newBet);
    }

    function getDeployedBets() public view returns (address[]) {
        return deployedBets;
    }
}

contract Bet {
    struct Choice {
        address[] selectors;
        uint count;
    }

    address public masterAccount;
    address public manager;
    uint public wager;
    mapping(uint8 => Choice) public choices;
    mapping(address => bool) public entrants;
    uint8 public choiceCount;
    string public data;

    modifier restricted() {
        require(msg.sender == manager || msg.sender == masterAccount);
        _;
    }

    function Bet(address a_master, address a_creator, uint a_wager, uint8 a_choiceCount, string a_data) public payable {
        require(a_wager > 0);
        require(a_choiceCount > 0);
        require(keccak256(a_data) != keccak256(''));
        masterAccount = a_master;
        manager = a_creator;
        wager = a_wager;
        choiceCount = a_choiceCount;
        data = a_data;
        for (uint8 i = 1; i <= choiceCount; i++) {
            choices[i] = Choice({count : 0, selectors : new address[](0)});
        }
    }

    function bet(uint8 selection) public payable {
        require(msg.value >= wager);
        require(!entrants[msg.sender]);
        entrants[msg.sender] = true;
        Choice storage selectedChoice = choices[selection];
        selectedChoice.selectors.push(msg.sender);
        selectedChoice.count++;
    }

    function setWinningChoice(uint8 choice) restricted public {
        uint prizePool = this.balance;
        uint managerShare = prizePool * 9 / 100;
        manager.transfer(managerShare);
        prizePool = prizePool * 90 / 100;
        Choice storage winningChoice = choices[choice];
        uint winnerShare = prizePool / winningChoice.count;
        for (uint i = 0; i < winningChoice.selectors.length; i++) {
            winningChoice.selectors[i].transfer(winnerShare);
        }
        masterAccount.transfer(this.balance);
    }

    function addToPrizePool() restricted public payable restricted {
    }

    function getBetData() public view returns (string, uint, uint[]){
        uint[] memory choiceCounts = new uint[](choiceCount);
        for(uint8 i = 1; i <= choiceCount; i++){
            choiceCounts[i-1] = choices[i].count;
        }
        return (data, this.balance, choiceCounts);
    }

}

