const { decodeParameters, decodeInput } = require("./contracts");
const { isHex, hexToNumber } = require('@harmony-js/utils');

exports.getAllTransactions = async (network, address, includeReceipts, pageSize, txType, order, shardID) => {
  const txs = [];
  const txObjects = await this.getAllTransactionHistory(network, address, pageSize, true, txType, order, shardID);
  var txReceipts = [];

  if (txObjects && txObjects.length > 0) {
    if (includeReceipts) {
      const txHashes = [];

      for (let txObject of txObjects) {
        txHashes.push(txObject.hash);
      }

      txReceipts = await this.getTransactionBatch(network, 'getTransactionReceipt', txHashes);
    }

    for (let txObject of txObjects) {
      var tx = {tx: txObject};

      if (includeReceipts && txReceipts.length > 0) {
        var txReceipt = this.findTransaction(txReceipts, 'transactionHash', txObject.hash);
        if (txReceipt) {
          tx.receipt = txReceipt;
        }
      }

      txs.push(tx);
    }
  }

  return txs;
}

exports.getAllTransactionHistory = async (network, address, pageSize, fullTxs, txType, order, shardID) => {
  pageIndex = 0;
  var results = [];
  var txObjects = [];

  do {
    txObjects = [];
    const batchResult = await this.getTransactionHistory(network, address, pageIndex, pageSize, fullTxs, txType, order, shardID);
    txObjects = (batchResult && batchResult.result && batchResult.result.transactions) ? batchResult.result.transactions : [];
    pageIndex++;
    
    if (txObjects && txObjects.length > 0) {
      results = results.concat(txObjects);
    }
  }
  while (txObjects && txObjects.length > 0);

  return results;
}

exports.getTransactionHistory = async (network, address, pageIndex, pageSize, fullTxs, txType, order, shardID) => {
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

exports.getDecodedTransaction = (contract, input) => {
  var decoded = null;

  for (let name in contract.abiModel.getMethods()) {
    let method = contract.abiModel.getMethod(name)

    method.decodeInputs = hexData => decodeParameters(contract, method.inputs, hexData);
    method.decodeOutputs = hexData => decodeParameters(contract, method.outputs, hexData);
  }

  var decodedInput = decodeInput(contract, input);

  if (decodedInput && decodedInput.abiItem) {
    decoded = decodedInput.abiItem;
  }

  return decoded;
}

exports.getAllDecodedTransactions = async (network, createContractMethod, address, includeReceipts, pageSize, txType, order, shardID) => {
  const txs = [];
  const txObjects = await this.getAllTransactions(network, address, includeReceipts, pageSize, txType, order, shardID);
  
  if (txObjects && txObjects.length > 0) {
    for (let txObject of txObjects) {
      var decoded = this.getDecodedTransaction(createContractMethod(), txObject.tx.input);

      if (decoded) {
        txObject.decoded = decoded;
      }

      txs.push(txObject);
    }
  }

  return txs;
}

exports.getTransactionBatch = async (network, method, txHashes) => {
  var results = [];

  if (txHashes && txHashes.length > 0) {
    var promises = [];
    var tempResults = [];

    for (let txHash of txHashes) {
      if (method == 'getTransactionByHash') {
        promises.push(network.client.blockchain.getTransactionByHash({txnHash: txHash}));
      } else if (method == 'getTransactionReceipt') {
        promises.push(network.client.blockchain.getTransactionReceipt({txnHash: txHash}));
      }
    }

    tempResults = await Promise.all(promises);

    if (tempResults && tempResults.length > 0) {
      for(let tempResult of tempResults) {
        if (tempResult && tempResult.result) {
          results.push(tempResult.result);
        }
      }
    }
  }

  return results;
}

exports.transactionsByBlocks = (txObjects) => {
  var txsByBlocks = {};

  for (let txObject of txObjects) {
    if (txObject.tx && txObject.tx.blockNumber !== '') {
      var blockNumber = null;

      if (isHex(txObject.tx.blockNumber)) {
        blockNumber = hexToNumber(txObject.tx.blockNumber);
      } else {
        blockNumber = Number(txObject.tx.blockNumber);
      }

      txsByBlocks[blockNumber] = !(blockNumber in txsByBlocks) ? [] : txsByBlocks[blockNumber];
      txsByBlocks[blockNumber].push(txObject);
    }
  }

  return txsByBlocks;
}

exports.transactionsByAddresses = (txObjects) => {
  var txsByAddresses = {};

  for (let txObject of txObjects) {
    if (txObject.tx && txObject.tx.from !== '') {
      var address = txObject.tx.from.toLowerCase();
      txsByAddresses[address] = !(address in txsByAddresses) ? [] : txsByAddresses[address];
      txsByAddresses[address].push(txObject);
    }
  }

  return txsByAddresses;
}

exports.findTransaction = (transactions, key, value) => {
  let matches = transactions.filter(function(transaction) {
    return transaction[key].toLowerCase() == value.toLowerCase();
  });

  const tx = (matches && matches.length == 1) ? matches[0] : null;

  return tx;
}

exports.determineTxType = (methodName) => {
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
