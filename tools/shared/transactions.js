const { decodeParameters, decodeInput } = require("./contracts");
const { isHex, hexToNumber } = require('@harmony-js/utils');

module.exports = class Transactions {
  
  constructor(network) {
    this.network = network;
  }

  async getAllTransactions(shardID, type, address, includeReceipts, pageSize, txType, order) {
    type = (type && type !== '') ? type : 'plain';
    const txs = [];
    const txObjects = await this.getAllTransactionHistory(type, shardID, address, pageSize, true, txType, order);
    var txReceipts = [];
  
    if (txObjects && txObjects.length > 0) {
      if (includeReceipts) {
        const txHashes = [];
  
        for (let txObject of txObjects) {
          txHashes.push(txObject.hash);
        }
  
        txReceipts = await this.getTransactionBatch('getTransactionReceipt', txHashes);
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

  async getAllCombinedTransactionHistory(shardID, address, pageSize, fullTxs, txType, order) {
    order = (order && order !== '') ? order.toUpperCase() : 'ASC';
    const plainTxs = await this.getAllTransactionHistory('plain', shardID, address, pageSize, fullTxs, txType, order);
    const stakingTxs = await this.getAllTransactionHistory('staking', shardID, address, pageSize, fullTxs, txType, order);
    
    var combined = (plainTxs && plainTxs.length > 0) ? plainTxs : [];
    combined = (stakingTxs && stakingTxs.length > 0) ? combined.concat(stakingTxs) : combined;

    const sorted = combined.sort((a, b) => {
      const aUnixtime = isHex(a.timestamp) ? Number(hexToNumber(a.timestamp)) : Number(a.timestamp);
      const bUnixtime = isHex(b.timestamp) ? Number(hexToNumber(b.timestamp)) : Number(b.timestamp);

      const diff = (order === 'ASC') ? (aUnixtime-bUnixtime) : (bUnixtime-aUnixtime);

      return diff;
    });

    return sorted;
  }

  async getAllTransactionHistory(type, shardID, address, pageSize, fullTxs, txType, order) {
    type = (type && type !== '') ? type : 'plain';
    var pageIndex = 0;
    var results = [];
    var txObjects = [];
  
    do {
      txObjects = [];
      txObjects = await this.getTransactionHistory(type, shardID, address, pageIndex, pageSize, fullTxs, txType, order);
      pageIndex++;
      
      if (txObjects && txObjects.length > 0) {
        results = results.concat(txObjects);
      }
    }
    while (txObjects && txObjects.length > 0);
  
    return results;
  }

  async getTransactionHistory (type, shardID, address, pageIndex, pageSize, fullTxs, txType, order) {
    var results = [];
    var chainPrefix = this.network.client.messenger.chainPrefix;
    var rpcMethod = 'hmy_getTransactionsHistory';
    
    if (type && type.toLowerCase() === 'staking') {
      rpcMethod ='hmyv2_getStakingTransactionsHistory';
    } else {
      type = 'plain';
    }

    if (shardID == null) {
      shardID = 0;
    }
  
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
  
    const rawResult = await this.network.client.messenger.send(
      rpcMethod,
      params,
      chainPrefix,
      shardID,
    );

    const result = this.network.client.blockchain.getRpcResult(rawResult);

    if (type === 'plain') {
      results = (result && result.result && result.result.transactions) ? result.result.transactions : [];
    } else if (type === 'staking') {
      results = (result && result.result && result.result.staking_transactions) ? result.result.staking_transactions : [];
    }
  
    return results;
  }

  getDecodedTransaction(contract, input) {
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

  async getAllDecodedTransactions(shardID, address, createContractMethod, includeReceipts, pageSize, txType, order) {
    const txs = [];
    const txObjects = await this.getAllTransactions('plain', shardID, address, includeReceipts, pageSize, txType, order, );
    
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

  async getTransactionBatch(method, txHashes) {
    var results = [];
  
    if (txHashes && txHashes.length > 0) {
      var promises = [];
      var tempResults = [];
  
      for (let txHash of txHashes) {
        if (method == 'getTransactionByHash') {
          promises.push(this.network.client.blockchain.getTransactionByHash({txnHash: txHash}));
        } else if (method == 'getTransactionReceipt') {
          promises.push(this.network.client.blockchain.getTransactionReceipt({txnHash: txHash}));
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

  transactionsByBlocks(txObjects) {
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

  transactionsByAddresses(txObjects) {
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

  findTransaction(transactions, key, value) {
    let matches = transactions.filter(function(transaction) {
      return transaction[key].toLowerCase() == value.toLowerCase();
    });
  
    const tx = (matches && matches.length == 1) ? matches[0] : null;
  
    return tx;
  }

  determineTxType(methodName) {
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
  
}
