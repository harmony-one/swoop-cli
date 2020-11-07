// Args
const yargs = require('yargs');
const argv = yargs
    .option('network', {
      alias: 'n',
      description: 'Which network to use',
      type: 'string',
      default: 'testnet'
    })
    .option('factory', {
      alias: 'f',
      description: 'The contract address for the UniswapV2Factory',
      type: 'string'
    })
    .option('pair', {
      alias: 'p',
      description: 'The pair to check the pool status for, e.g. ONE/1BTC',
      type: 'string'
    })
    .help()
    .alias('help', 'h')
    .argv;

const factoryAddress = argv.factory;

if (factoryAddress == null || factoryAddress == '') {
  console.log('You must supply a factory address using --factory CONTRACT_ADDRESS or -f CONTRACT_ADDRESS!');
  process.exit(0);
}

var pair = null;
if (argv.pair != null && argv.pair != '' && argv.pair.includes('/')) {
  pair = argv.pair.split('/');
}

// Libs
const web3 = require('web3');
const { BigNumber } = require('@ethersproject/bignumber');
const { HmyEnv} = require("@swoop-exchange/utils");
const { getAddress } = require("@harmony-js/crypto");
const { parseTokens, findTokenBy } = require("../shared/tokens");
const { Pair, Token } = require ("@swoop-exchange/sdk");
const { hexToNumber} = require('@harmony-js/utils');

// Vars
const network = new HmyEnv(argv.network);
const tokens = parseTokens(network, 'all');

const factoryContract = network.loadContract('@swoop-exchange/core/build/contracts/UniswapV2Factory.json', factoryAddress, 'deployer');
const factoryInstance = factoryContract.methods;

/*const tokenAContract = network.loadContract('@swoop-exchange/core/build/contracts/HRC20.json', tokenAAddress, 'deployer');
const tokenAInstance = tokenContract.methods;

const tokenBContract = network.loadContract('@swoop-exchange/core/build/contracts/HRC20.json', tokenBAddress, 'deployer');
const tokenBInstance = tokenContract.methods;*/

const walletAddress = factoryContract.wallet.signer.address;
const walletAddressBech32 = getAddress(walletAddress).bech32;

async function status() {
  console.log(`Factory info:`);
  const feeTo = await factoryInstance.feeTo().call(network.gasOptions());
  console.log(`feeTo is set to: ${feeTo}`);
  
  const feeToSetter = await factoryInstance.feeToSetter().call(network.gasOptions());
  console.log(`feeToSetter is set to: ${feeToSetter}\n`);

  console.log(`Pair info:`)

  const length = await factoryInstance.allPairsLength().call(network.gasOptions());
  console.log(`There is a total of ${length} pairs created by the factory ${factoryAddress} \n`);

  if (pair != null && pair.length == 2) {
    const tokenASymbol = pair[0];
    const tokenBSymbol = pair[1];

    const tokenAAddress = findTokenBy(tokens, 'symbol', tokenASymbol).address;
    const tokenBAddress = findTokenBy(tokens, 'symbol', tokenBSymbol).address;
    const expectedAddress = generatedPairAddress(tokenAAddress, tokenBAddress);

    console.log(`Expected pair address for the token pair ${tokenAAddress} / ${tokenBAddress} by the SDK is: ${expectedAddress}`);

    console.log(`Fetching pair address for the token pair ${tokenAAddress} / ${tokenBAddress} ...`);
    var pairAddress = await factoryInstance.getPair(tokenAAddress, tokenBAddress).call(network.gasOptions());
    console.log(`The pair address for the token pair ${tokenAAddress} / ${tokenBAddress} is: ${pairAddress}\n`);

    await pairDetails(pairAddress);
  } else {
    if (length > 0) {
      for (index = 0; index < length; index++) { 
        console.log(`Fetching pair address for the token pair via index ${index} ...`);
        pairAddress = await factoryInstance.allPairs(index).call(network.gasOptions());
        console.log(`The pair address for the token pair at index ${index} is: ${pairAddress}\n`);

        await pairDetails(pairAddress);
      }
    }
  }
}

async function pairDetails(address) {
  let pairContract = network.loadContract('@swoop-exchange/core/build/contracts/UniswapV2Pair.json', address, 'deployer');
  let pairInstance = pairContract.methods;

  let name = await pairInstance.name().call(network.gasOptions());
  console.log(`The name for the pair contract ${address} is: ${name}\n`);

  let symbol = await pairInstance.symbol().call(network.gasOptions());
  console.log(`The symbol for the pair contract ${address} is: ${symbol}\n`);

  let decimals = await pairInstance.decimals().call(network.gasOptions());
  console.log(`The decimals for the pair contract ${address} is: ${decimals}\n`);

  let totalSupply = await pairInstance.totalSupply().call(network.gasOptions());
  console.log(`The total supply for the pair contract ${address} is: ${web3.utils.fromWei(totalSupply)}\n`);

  let minimumLiquidity = await pairInstance.MINIMUM_LIQUIDITY().call(network.gasOptions());
  console.log(`The minimum liqudity for the pair contract ${address} is: ${web3.utils.fromWei(minimumLiquidity)}\n`);

  let liquidity = await pairInstance.balanceOf(address).call(network.gasOptions());
  console.log(`The current liquidity for the pair contract ${address} is: ${web3.utils.fromWei(liquidity)}\n`);

  let factory = await pairInstance.factory().call(network.gasOptions());
  console.log(`The factory address for the pair contract ${address} is: ${factory}\n`);

  let token0Address = await pairInstance.token0().call(network.gasOptions());
  let token0 = findTokenBy(tokens, 'address', token0Address);
  let token0Symbol = (token0) ? token0.symbol : '';
  let token0Contract = network.loadContract('@swoop-exchange/periphery/build/contracts/IERC20.json', token0Address, 'deployer');
  let token0UnderlyingBalance = await token0Contract.methods.balanceOf(address).call(network.gasOptions())
  console.log(`The token0 address for the pair contract ${address} is: ${token0Address} - ${token0Symbol}. Underlying balance: ${web3.utils.fromWei(token0UnderlyingBalance)} ${token0Symbol}\n`);

  let token1Address = await pairInstance.token1().call(network.gasOptions());
  let token1 = findTokenBy(tokens, 'address', token1Address);
  let token1Symbol = (token1) ? token1.symbol : '';
  let token1Contract = network.loadContract('@swoop-exchange/periphery/build/contracts/IERC20.json', token1Address, 'deployer');
  let token1UnderlyingBalance = await token1Contract.methods.balanceOf(address).call(network.gasOptions())
  console.log(`The token1 address for the pair contract ${address} is: ${token1Address} - ${token1Symbol}. Underlying balance: ${web3.utils.fromWei(token1UnderlyingBalance)} ${token1Symbol}\n`);

  let reserves = await pairInstance.getReserves().call(network.gasOptions());
  let reserve0 = reserves['_reserve0'];
  let reserve1 = reserves['_reserve1'];
  let totalReserves = BigNumber.from(reserve0).add(BigNumber.from(reserve1));
  let timestamp = hexToNumber('0x'+reserves['_blockTimestampLast']);
  let dateTime = (timestamp > 0) ? stringDate(timestamp) : '';

  console.log(`The reserves for the pair contract ${address} is:`);
  console.log(`  Reserve 0: ${web3.utils.fromWei(reserve0)} (${reserve0}) - ${token0Symbol}`);
  console.log(`  Reserve 1: ${web3.utils.fromWei(reserve1)} (${reserve1}) - ${token1Symbol}`);
  console.log(`  Total reserves: ${web3.utils.fromWei(totalReserves.toString())}`);
  console.log(`  BlockTimestampLast: ${dateTime} (${timestamp})\n`);
}

function generatedPairAddress(addressA, addressB) {
  const tokenA = new Token(network.chainId, addressA, 18);
  const tokenB = new Token(network.chainId, addressB, 18);

  const expectedAddress = Pair.getAddress(tokenA, tokenB);

  return expectedAddress;
}

function stringDate(epoch) {
  var utcEta = new Date(0);
  utcEta.setUTCSeconds(epoch);
  
  return utcEta.toUTCString();
}

status()
  .then(() => {
    process.exit(0);
  })
  .catch(function(err){
    console.log(err);
    process.exit(0);
  });
