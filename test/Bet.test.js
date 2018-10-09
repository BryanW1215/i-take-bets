const assert = require('assert');
const ganache = require('ganache-cli');
const Web3 = require('web3');
const web3 = new Web3(ganache.provider());

const compiledFactory = require('../ethereum/build/BetFactory.json');
const compiledBet = require('../ethereum/build/Bet.json');
const VM_REVERT_ERROR = 'VM Exception while processing transaction: revert';
const INITIAL_PRIZE_POOL = web3.utils.toWei('1', 'ether');
let accounts;
let factory;
let betAddress;
let bet;
function toEther(value){
    web3.utils.fromWei(value, 'ether');
}
beforeEach(async () => {
    accounts = await web3.eth.getAccounts();

    factory = await new web3.eth.Contract(JSON.parse(compiledFactory.interface))
        .deploy({data: compiledFactory.bytecode})
        .send({from: accounts[0], gas: '2000000'});

    await factory.methods.createBet(100, 2, 'this is data').send({
        from: accounts[1],
        gas: '1000000'
    });

    [betAddress] = await factory.methods.getDeployedBets().call();
    bet = await new web3.eth.Contract(
        JSON.parse(compiledBet.interface),
        betAddress
    );
    await bet.methods.addToPrizePool().send({from: accounts[1], gas: '1000000', value: INITIAL_PRIZE_POOL});

});

describe('Bets', () => {
    it('deploys a factory and a bet', () => {
        assert.ok(factory.options.address);
        assert.ok(bet.options.address);
    });
    it('should have an initial prize pool value', async () => {
        let prizePoolValue =  await web3.eth.getBalance(betAddress);
        assert.strictEqual(prizePoolValue, INITIAL_PRIZE_POOL);
    });
    it('should allow an account to place a wager', async () => {
       await bet.methods.bet(1).send({from: accounts[2], value: web3.utils.toWei('1', 'ether'), gas: '1000000'});
       let result = await bet.methods.getBetData().call();
       assert.strictEqual(result['1'], web3.utils.toWei('2', 'ether'));
       assert.strictEqual(result['2'][0], "1");
    });
    it('should distribute prize money', async () => {
        await bet.methods.bet(1).send({from: accounts[2], value: web3.utils.toWei('1', 'ether'), gas: '1000000'});
        await bet.methods.bet(2).send({from: accounts[3], value: web3.utils.toWei('1', 'ether'), gas: '1000000'});
        await bet.methods.bet(1).send({from: accounts[4], value: web3.utils.toWei('1', 'ether'), gas: '1000000'});

        let start  ={
            contract: await web3.eth.getBalance(betAddress),
            master: await web3.eth.getBalance(accounts[0]),
            manager: await web3.eth.getBalance(accounts[1]),
            winner1: await web3.eth.getBalance(accounts[2]),
            winner2: await web3.eth.getBalance(accounts[4]),
            loser: await web3.eth.getBalance(accounts[3])
        };
        await bet.methods.setWinningChoice(1).send({from: accounts[1], gas: '1000000'});
        let end  ={
            contract: await web3.eth.getBalance(betAddress),
            master: await web3.eth.getBalance(accounts[0]),
            manager: await web3.eth.getBalance(accounts[1]),
            winner1: await web3.eth.getBalance(accounts[2]),
            winner2: await web3.eth.getBalance(accounts[4]),
            loser: await web3.eth.getBalance(accounts[3])
        };
        let final = {
            contract: (parseInt(end.contract) - parseInt(start.contract)) * 0.000000000000000001,
            master: (parseInt(end.master) - parseInt(start.master)) * 0.000000000000000001,
            manager: (parseInt(end.manager) - parseInt(start.manager)) * 0.000000000000000001,
            winner1: (parseInt(end.winner1) - parseInt(start.winner1)) * 0.000000000000000001,
            winner2: (parseInt(end.winner2) - parseInt(start.winner2)) * 0.000000000000000001,
            loser: (parseInt(end.loser) - parseInt(start.loser)) * 0.000000000000000001
        };
        assert.strictEqual(final.contract, -4);
        assert.strictEqual(final.master, 0.04); // 4 * .01
        assert.strictEqual(final.winner1, 1.8); // (4 * .9) /2
        assert.strictEqual(final.loser, 0);
        assert(.359 < final.manager && final.manager < .36); // (4 * .09) - gas to call setWinningChoice();
    });
    it('should not allow an account to place 2 wagers', async () =>{
        await bet.methods.bet(1).send({from: accounts[2], value: web3.utils.toWei('1', 'ether'), gas: '1000000'});
        try {
            await bet.methods.bet(2).send({from: accounts[2], value: web3.utils.toWei('1', 'ether'), gas: '1000000'});
            assert(false);
        } catch (ex){
            assert.strictEqual(ex.message, VM_REVERT_ERROR);
        }
    });
    it('should not allow a non admin account to select winner', async ()=>{
        try {
            await bet.methods.setWinningChoice(1).send({from: accounts[2], gas: '1000000'});
            assert(false);
        } catch (e){
            assert(e.message, VM_REVERT_ERROR);
        }

    });

});
