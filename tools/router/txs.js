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
  .option('size', {
    alias: 's',
    description: 'Number of transactions to fetch',
    type: 'integer',
    default: 10
  })
  .help()
  .alias('help', 'h')
  .argv;

const routerAddress = argv.router;
const type = argv.type;
const size = argv.size;

if (routerAddress == null || routerAddress == '') {
  console.log('You must supply a router address using --router CONTRACT_ADDRESS or -r CONTRACT_ADDRESS!');
  process.exit(0);
}

// Libs
const { HmyEnv} = require("@swoop-exchange/utils");
const { decodeParameters, decodeInput } = require("../shared/contracts");
const { parseTokens, findTokenBy } = require("../shared/tokens");
const web3 = require('web3');
const { toBech32 } = require("@harmony-js/crypto");
const ObjectsToCsv = require('objects-to-csv');
const { hexToNumber} = require('@harmony-js/utils');

// Vars
const network = new HmyEnv(argv.network);
const factoryContract = network.loadContract('@swoop-exchange/periphery/build/contracts/UniswapV2Router02.json', routerAddress, 'deployer');
const tokens = parseTokens(network, 'all');
const oneRouterAddress = toBech32(routerAddress);

const txs = {
  'all': [],
  'swap': [],
  'addLiquidity': [],
  'removeLiquidity': []
}

async function status() {
  const txHashes = await getAllTransactionHistory(oneRouterAddress, size, false, 'all', 'desc', 0);
  
  if (txHashes && txHashes.length > 0) {
    console.log(`Found a total of ${txHashes.length} transactions for router ${routerAddress} (${oneRouterAddress}) on ${argv.network}`);

    var txPromises = [];

    for(let txHash of txHashes) {
      txPromises.push(getDecodedTransaction(txHash));
    }

    const txResults = await Promise.all(txPromises);

    for(let txResult of txResults) {
      if (txResult && txResult.tx && txResult.decoded) {
        /*console.log(`Method: ${txResult.decoded.name}`);
        console.log(`Method signature:`);
        console.log(txResult.decoded.inputs);
        console.log(`Method parameters:`);
        console.log(txResult.decoded.contractMethodParameters);*/

        const txType = determineTxType(txResult.decoded.name);

        console.log(`Found ${txType} transaction ${txResult.tx.hash} from ${txResult.tx.from}`);

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
    const {tx, decoded} = result;
    const timestamp = hexToNumber(tx.timestamp);
    const dateTime = (timestamp > 0) ? stringDate(timestamp) : '';

    csvData.push({
      address: tx.from,
      txHash: tx.hash,
      timestamp: dateTime,
      category: type,
      method: decoded.name
    })
  }

  if (csvData && csvData.length > 0) {
    const csv = new ObjectsToCsv(csvData);
    await csv.toDisk(`./export/${type}-txs.csv`);
  }
}

function determineTxType(methodName) {
  switch (methodName) {
    case 'addLiquidity':
    case 'addLiquidityETH':
      return 'addLiquidity';
    case 'removeLiquidity':
    case 'removeLiquidityETH':
      return 'removeLiquidity';
    case 'swapExactTokensForTokens':
    case 'swapTokensForExactTokens':
    case 'swapExactETHForTokens':
    case 'swapTokensForExactETH':
    case 'swapExactTokensForETH':
    case 'swapETHForExactTokens':
      return 'swap';
  }
}

function stringDate(epoch) {
  var utcEta = new Date(0);
  utcEta.setUTCSeconds(epoch);
  
  return utcEta.toUTCString();
}

async function getAllTransactionHistory(address, pageSize, fullTxs, txType, order, shardID) {
  pageIndex = 0;
  var results = [];
  var txHashes = [];

  do {
    txHashes = [];
    const batchResult = await getTransactionHistory(address, pageIndex, pageSize, fullTxs, txType, order, shardID);
    txHashes = (batchResult && batchResult.result && batchResult.result.transactions) ? batchResult.result.transactions : [];
    pageIndex++;
    
    if (txHashes && txHashes.length > 0) {
      results = results.concat(txHashes);
    }
  }
  while (txHashes && txHashes.length > 0);

  return results;
}

async function getTransactionHistory(address, pageIndex, pageSize, fullTxs, txType, order, shardID) {
  if (pageIndex == null) {
    pageIndex = 0;
  }

  if (pageSize == null) {
    pageSize = 1000;
  }

  if (fullTxs == null) {
    fullTxs = false;
  }

  if (txType == null) {
    txType = 'all';
  }

  txType = txType.toUpperCase();

  if (order == null) {
    order = 'asc';
  }

  order = order.toUpperCase();

  if (shardID == null) {
    shardID = 0;
  }

  const params = [
    {
      'address': address,
      'pageIndex': pageIndex,
      'pageSize': pageSize,
      'fullTx': fullTxs,
      'txType': txType,
      'order': order
    }
  ]

  const rawResult = await network.client.messenger.send(
    'hmy_getTransactionsHistory',
    params,
    network.client.messenger.chainPrefix,
    shardID,
  );

  const result = network.client.blockchain.getRpcResult(rawResult);

  return result;
}

async function getDecodedTransaction(txHash) {
  var result = null;
  var decodedResult = null;

  const tx = await network.client.blockchain.getTransactionByHash({txnHash: txHash});

  if (tx) {
    result = tx.result;
    input = tx.result.input;

    for (let name in factoryContract.abiModel.getMethods()) {
      let method = factoryContract.abiModel.getMethod(name)
  
      method.decodeInputs = hexData => decodeParameters(factoryContract, method.inputs, hexData);
      method.decodeOutputs = hexData => decodeParameters(factoryContract, method.outputs, hexData);
    }
  
    var decodedInput = decodeInput(factoryContract, input);
    var decodedResult = null;

    if (decodedInput && decodedInput.abiItem) {
      decodedResult = decodedInput.abiItem;
    }
  }

  return {tx: result, decoded: decodedResult};
}

status()
  .then(() => {
    process.exit(0);
  })
  .catch(function(err){
    console.log(err);
    process.exit(0);
  });
