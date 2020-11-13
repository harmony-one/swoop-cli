const { isHex, hexToNumber } = require('@harmony-js/utils');

exports.decodeParameters = (contract, abi, hexData) => {
  if (0 == abi.length) return []
  let params = contract.abiCoder.decodeParameters(abi, hexData)
  params.length = abi.length
  //for (let i = 0; i < abi.length; i++) {
  //  if (abi[i].type.startsWith('address'))
  //    params[i] = hmySDK.crypto.toBech32(params[i]);
  //}
  return Array.from(params)
}

exports.decodeInput = (contract, hexData) => {
  let no0x = hexData.startsWith('0x') ? hexData.slice(2) : hexData
  let sig = no0x.slice(0, 8).toLowerCase()
  let method = contract.abiModel.getMethod('0x' + sig)
  if (!method) return false
  let argv = method.decodeInputs('0x' + no0x.slice(8))
  let obj = contract.methods['0x' + sig](...argv)

  /*for (let i = 0; i < obj.params.length; i++) {
    if (obj.abiItem.inputs[i].type == 'address')
      obj.params[i] = obj.params[i]
  }*/
  obj.toString = () => {
    let str = obj.abiItem.name + '('
    for (let i = 0; i < obj.params.length; i++) {
      if (i > 0) str += ', '
      str += obj.params[i]
    }
    str += ')'
    return str
  }
  return obj
}

exports.decodeRouterParams = (tx, decoded) => {
  var decodedParams = {};

  try {
    var method = decoded.name;
    var amountETHDesired = null;

    if (tx && tx.value && tx.value !== '') {
      if (isHex(tx.value)) {
        amountETHDesired = hexToNumber(tx.value);
      } else {
        amountETHDesired = Number(tx.value);
      }
    }

    switch (method) {
      case 'addLiquidity':
        var [ tokenAAddress, tokenBAddress, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, tokenAAddress, tokenBAddress, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline };
        break;
      case 'addLiquidityETH':
        var [ tokenAddress, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, tokenAddress, amountTokenDesired, amountTokenMin, amountETHDesired, amountETHMin, to, deadline };
        break;
      case 'removeLiquidity':
        var [ tokenAAddress, tokenBAddress, liquidity, amountAMin, amountBMin, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, tokenAAddress, tokenBAddress, liquidity, amountAMin, amountBMin, to, deadline };
        break;
      case 'removeLiquidityETH':
        var [ tokenAddress, liquidity, amountTokenMin, amountETHMin, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, tokenAddress, liquidity, amountTokenMin, amountETHMin, to, deadline };
        break;
      case 'swapExactTokensForTokens':
        var [ amountIn, amountOutMin, path, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, amountIn, amountOutMin, path, to, deadline };
        break;
      case 'swapTokensForExactTokens':
        var [ amountOut, amountInMax, path, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, amountOut, amountInMax, path, to, deadline };
        break;
      case 'swapExactETHForTokens':
        var [ amountOutMin, path, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, amountETHDesired, amountOutMin, path, to, deadline }
        break;
      case 'swapTokensForExactETH':
        var [ amountOut, amountInMax, path, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, amountOut, amountInMax, path, to, deadline };
        break;
      case 'swapExactTokensForETH':
        var [ amountIn, amountOutMin, path, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, amountIn, amountOutMin, path, to, deadline };
        break;
      case 'swapETHForExactTokens':
        var [ amountOut, path, to, deadline ] = decoded.contractMethodParameters;
        decodedParams = { method, amountETHDesired, amountOut, path, to, deadline };
        break;
    }
  } catch (error) {
  }

  return decodedParams;
}
