// Args
const yargs = require('yargs');
const argv = yargs
    .option('network', {
      alias: 'n',
      description: 'Which network to use',
      type: 'string',
      default: 'testnet'
    })
    .option('token', {
      alias: 't',
      description: 'What token to interact with',
      type: 'string'
    })
    .option('amount', {
      alias: 'a',
      description: 'The amount of tokens to send',
      type: 'string',
      default: '1'
    })
    .help()
    .alias('help', 'h')
    .argv;

let tokenName = argv.token;
let amountString = argv.amount;

if (tokenName == null || tokenName == '') {
  console.log('You must supply a token using --token TOKEN_NAME or -c TOKEN_NAME!');
  process.exit(0);
}

if (amountString == null || amountString == '') {
  console.log('You must supply the amount to transfer using --amount AMOUNT or -a AMOUNT! Amount is a normal number - not wei');
  process.exit(0);
}

// Libs
const web3 = require('web3');
const { HmyEnv} = require("@swoop-exchange/utils");
const { toBech32 } = require("@harmony-js/crypto");
const { parseTokens } = require("../shared/tokens");

// Vars
tokenName = tokenName.replace(/^1/i, 'One')

const network = new HmyEnv(argv.network);
const amount = web3.utils.toWei(amountString);
const tokens = parseTokens(network, tokenName);

async function mint() {
  for(let token of tokens) {
    if (token.name == 'Wrapped ONE') {
      continue
    }
    
    const tokenAddress = token.address;
    const oneTokenAddress = toBech32(tokenAddress);
    var contractName = token.name;

    if (contractName == 'Wrapped BTC') {
      contractName = 'WBTC';
    }

    const contractPath = `@swoop-exchange/misc/build/contracts/${contractName}.json`;

    const tokenContract = network.loadContract(contractPath, tokenAddress, 'deployer');
    const tokenInstance = tokenContract.methods;

    const walletAddress = tokenContract.wallet.signer.address;

    await totalSupply(tokenInstance, token, tokenAddress, oneTokenAddress);

    console.log(`Attempting to mint ${amountString} ${token.name} tokens ...`);
    let result = await tokenInstance.mint(walletAddress, amount).send(network.gasOptions());
    let txHash = result.transaction.receipt.transactionHash;
    console.log(`Minted ${amountString} ${token.name} tokens, tx hash: ${txHash}\n`);

    await totalSupply(tokenInstance, token, tokenAddress, oneTokenAddress);
  }
}

async function totalSupply(tokenInstance, token, tokenAddress, oneTokenAddress) {
  let total = await tokenInstance.totalSupply().call(network.gasOptions());
  let formattedTotal = web3.utils.fromWei(total);
  console.log(`Current total supply for the token ${token.name} (address: ${oneTokenAddress} / ${tokenAddress}) is: ${formattedTotal}\n`);
}

mint().then(() => {
  process.exit(0);
})
.catch(function(err){
  console.log(err);
  process.exit(0);
});
