// Args
const yargs = require('yargs');
const argv = yargs
  .option('network', {
    alias: 'n',
    description: 'Which network to use',
    type: 'string',
    default: 'testnet'
  })
  .option('router', {
    alias: 'r',
    description: 'The contract address for the UniswapV2Router02',
    type: 'string'
  })
  .option('type', {
    alias: 't',
    description: 'The type of transaction',
    type: 'string',
    default: 'all'
  })
  .option('per-page', {
    alias: 'p',
    description: 'Number of transactions to fetch per page',
    type: 'integer',
    default: 1000
  })
  .option('address', {
    alias: 'a',
    description: 'Filter transactions based on a specific sender address',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

const routerAddress = argv.router;
const type = argv.type;
const size = argv['per-page'];
var address = argv.address;
var oneAddress = null;

if (routerAddress == null || routerAddress == '') {
  console.log('You must supply a router address using --router CONTRACT_ADDRESS or -r CONTRACT_ADDRESS!');
  process.exit(0);
}

// Libs
const { HmyEnv} = require("@swoop-exchange/utils");
const Transactions = require("../shared/transactions");
const { decodeRouterParams } = require("../shared/contracts");
const { parseTokens, findTokenBy } = require("../shared/tokens");
const web3 = require('web3');
const { fromBech32, toBech32 } = require("@harmony-js/crypto");
const ObjectsToCsv = require('objects-to-csv');
const { hexToNumber, isBech32Address } = require('@harmony-js/utils');

// Vars
const network = new HmyEnv(argv.network);
const contractPath = '@swoop-exchange/periphery/build/contracts/UniswapV2Router02.json';
const tokens = parseTokens(network, 'all');
const oneRouterAddress = toBech32(routerAddress);
const transactions = new Transactions(network);

if (address && address != '') {
  if (isBech32Address(address)) {
    oneAddress = address
    address = fromBech32(address);
  } else {
    oneAddress = toBech32(address);
  }
}

const txs = {
  'all': [],
  'swap': [],
  'addLiquidity': [],
  'removeLiquidity': []
}

function createContract() {
  return network.loadContract(contractPath, routerAddress, 'deployer');
}

async function status() {
  const decodedTxs = await transactions.getAllDecodedTransactions(network, createContract, oneRouterAddress, true, size, 'RECEIVED', 'ASC', 0);
  
  if (decodedTxs && decodedTxs.length > 0) {
    for(let txResult of decodedTxs) {
      if (txResult.decoded) {
        var routerParams = decodeRouterParams(txResult.tx, txResult.decoded);
        if (routerParams) {
          txResult.decoded.routerParams = routerParams;
        }
      }

      const txType = determineTxType(txResult.decoded.name);
      if (txType && txType !== '') {
        console.log(`Found ${txType} transaction ${txResult.tx.hash} from ${txResult.tx.from}`);
        txResult.txType = txType;
      }

      if (oneAddress && oneAddress != '') {
        if (oneAddress.toLowerCase() == txResult.tx.from.toLowerCase()) {
          txs['all'].push(txResult);
          txs[txType].push(txResult);
        }
      } else {
        txs['all'].push(txResult);
        txs[txType].push(txResult);
      }
    }
  } else {
    console.log(`Couldn't find any transactions for router ${routerAddress} (${oneRouterAddress}) on ${argv.network}`);
  }

  const segmentTxs = (txs && txs[type] && txs[type].length > 0) ? txs[type] : [];
  if (segmentTxs && segmentTxs.length > 0) {
    console.log(`Found a total of ${segmentTxs.length} ${type} transactions for router ${routerAddress} (${oneRouterAddress}) on ${argv.network}`);
    await exportToCsv(segmentTxs);
  }
}

async function exportToCsv(txs) {
  const csvData = [];

  for(let result of txs) {
    const {tx, txType, receipt, decoded} = result;
    const timestamp = hexToNumber(tx.timestamp);
    const dateTime = (timestamp > 0) ? stringDate(timestamp) : '';
    const status = (receipt.status.toLowerCase() == '0x1') ? 'Success' : 'Failure';
    const tokenData = parseTokenData(decoded);

    csvData.push({
      address: tx.from,
      txHash: tx.hash,
      timestamp: dateTime,
      status: status,
      category: txType,
      method: decoded.name,
      tokenA: tokenData.tokenA,
      tokenAAmount: tokenData.tokenADesired,
      tokenB: tokenData.tokenB,
      tokenBAmount: tokenData.tokenBDesired,
    })
  }

  var addressPrefix = (oneAddress && oneAddress != '') ? `${oneAddress}-` : '';
  var csvPath = `./data/txs/${addressPrefix}${type}-txs.csv`;

  if (csvData && csvData.length > 0) {
    const csv = new ObjectsToCsv(csvData);
    await csv.toDisk(csvPath);
  }
}

function parseTokenData(decoded) {
  var tokenAAddress = null;
  var tokenADesired = null;

  var tokenBAddress = null;
  var tokenBDesired = null;

  var wone = findTokenBy(tokens, 'symbol', 'WONE');

  var routerParams = decoded.routerParams;

  if (('tokenAAddress' in routerParams) && ('tokenBAddress' in routerParams)) {
    tokenAAddress = routerParams.tokenAAddress;
    tokenBAddress = routerParams.tokenBAddress;
  } else if ('tokenAddress' in routerParams) {
    tokenAAddress = wone.address;
    tokenBAddress = routerParams.tokenAddress;
  } else if ('path' in decoded.routerParams) {
    tokenAAddress = routerParams.path[0];
    tokenBAddress = (routerParams.path.length > 1) ? routerParams.path[routerParams.path.length-1] : wone.address;
  }

  var tokenA = findTokenBy(tokens, 'address', tokenAAddress);
  tokenASymbol = (tokenA && tokenA.symbol) ? tokenA.symbol : toBech32(tokenAAddress);
  tokenASymbol = (tokenASymbol === 'WONE') ? 'ONE' : tokenASymbol;

  var tokenB = findTokenBy(tokens, 'address', tokenBAddress);
  tokenBSymbol = (tokenB && tokenB.symbol) ? tokenB.symbol : toBech32(tokenBAddress);
  tokenBSymbol = (tokenBSymbol === 'WONE') ? 'ONE' : tokenBSymbol;

  switch (routerParams.method) {
    case 'addLiquidity':
      tokenADesired = routerParams.amountADesired;
      tokenBDesired = routerParams.amountBDesired;
      break;
    case 'addLiquidityETH':
      tokenADesired = routerParams.amountETHDesired;
      tokenBDesired = routerParams.amountTokenDesired;
      break;
    case 'removeLiquidity':
      tokenADesired = routerParams.amountAMin;
      tokenBDesired = routerParams.amountBMin;
      break;
    case 'removeLiquidityETH':
      tokenADesired = routerParams.amountETHMin;
      tokenBDesired = routerParams.amountTokenMin;
      break;
    case 'swapExactTokensForTokens':
      tokenADesired = routerParams.amountIn;
      tokenBDesired = routerParams.amountOutMin;
      break;
    case 'swapTokensForExactTokens':
      tokenADesired = routerParams.amountInMax;
      tokenBDesired = routerParams.amountOut;
      break;
    case 'swapExactETHForTokens':
      tokenADesired = routerParams.amountETHDesired;
      tokenBDesired = routerParams.amountOutMin;
      break;
    case 'swapTokensForExactETH':
      tokenADesired = routerParams.amountInMax;
      tokenBDesired = routerParams.amountOut;
      break;
    case 'swapExactTokensForETH':
      tokenADesired = routerParams.amountIn;
      tokenBDesired = routerParams.amountOutMin;
      break;
    case 'swapETHForExactTokens':
      tokenADesired = routerParams.amountETHDesired;
      tokenBDesired = routerParams.amountOut;
      break;
  }

  var tokenADecimals = (tokenA && tokenA.decimals) ? tokenA.decimals : 18;
  var tokenBDecimals = (tokenB && tokenB.decimals) ? tokenB.decimals : 18;

  tokenADesired = convertAmount(tokenADesired, tokenADecimals);
  tokenBDesired = convertAmount(tokenBDesired, tokenBDecimals);

  return {tokenA: tokenASymbol, tokenB: tokenBSymbol, tokenADesired: tokenADesired, tokenBDesired: tokenBDesired};
}

function stringDate(epoch) {
  var utcEta = new Date(0);
  utcEta.setUTCSeconds(epoch);
  
  return utcEta.toUTCString();
}

function convertAmount(amountString, decimals) {
  var amount = null;

  if (decimals == 18) {
    amount = web3.utils.fromWei(amountString);
  } else {
    amount = (parseFloat(amountString) / 10**decimals).toFixed(decimals);
  }

  return amount.toString();
}

status()
  .then(() => {
    process.exit(0);
  })
  .catch(function(err){
    console.log(err);
    process.exit(0);
  });
