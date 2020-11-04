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
  .option('tx', {
    alias: 't',
    description: 'The tx hash of a contract to inspect',
    type: 'string'
  })
  .help()
  .alias('help', 'h')
  .argv;

const routerAddress = argv.router;
const txHash = argv.tx;

if (routerAddress == null || routerAddress == '') {
  console.log('You must supply a router address using --router CONTRACT_ADDRESS or -r CONTRACT_ADDRESS!');
  process.exit(0);
}

if (txHash == null || txHash == '') {
  console.log('You must supply a tx hash using --tx TX_HASH or -t TX_HASH!');
  process.exit(0);
}

// Libs
const { HmyEnv} = require("@swoop-exchange/utils");
const { decodeParameters, decodeInput } = require("../shared/contracts");
const { parseTokens, findTokenBy } = require("../shared/tokens");
const web3 = require('web3');

// Vars
const network = new HmyEnv(argv.network);
const factoryContract = network.loadContract('@swoop-exchange/periphery/build/contracts/UniswapV2Router02.json', routerAddress, 'deployer');
const tokens = parseTokens(network, 'all');

async function status() {
  const tx = await network.client.blockchain.getTransactionByHash({txnHash: txHash});
  const input = tx.result.input;

  for (let name in factoryContract.abiModel.getMethods()) {
    let method = factoryContract.abiModel.getMethod(name)

    method.decodeInputs = hexData => decodeParameters(factoryContract, method.inputs, hexData);
    method.decodeOutputs = hexData => decodeParameters(factoryContract, method.outputs, hexData);
  }

  var decodedInput = decodeInput(factoryContract, input);

  if (decodedInput && decodedInput.abiItem) {
    decodedInput = decodedInput.abiItem;
    console.log(`Method: ${decodedInput.name}`);
    console.log(`Method signature:`);
    console.log(decodedInput.inputs);
    console.log(`Method parameters:`);
    console.log(decodedInput.contractMethodParameters);

    outputInfo(decodedInput);
  }
}

function outputInfo(decodedInput) {
  switch (decodedInput.name) {
    case 'addLiquidity':
      outputAddLiquidityInfo(decodedInput);
      break;
    case 'addLiquidityETH':
      outputAddLiquidityETHInfo(decodedInput);
      break;
    case 'removeLiquidity':
      outputRemoveLiquidityInfo(decodedInput);
      break;
    case 'removeLiquidityETH':
      outputRemoveLiquidityEthInfo(decodedInput);
      break;
    case 'swapExactTokensForTokens':
      outputSwapExactTokensForTokensInfo(decodedInput);
      break;
    case 'swapTokensForExactTokens':
      outputSwapTokensForExactTokensInfo(decodedInput);
      break;
    case 'swapExactETHForTokens':
      outputSwapExactETHForTokensInfo(decodedInput);
      break;
    case 'swapTokensForExactETH':
      outputSwapTokensForExactETHInfo(decodedInput);
      break;
    case 'swapExactTokensForETH':
      outputSwapExactTokensForETHInfo(decodedInput);
      break;
    case 'swapETHForExactTokens':
      outputSwapETHForExactTokensInfo(decodedInput);
      break;
  }
}

function outputAddLiquidityInfo(decodedInput) {
  var [ tokenAAddress, tokenBAddress, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ tokenAAddress, tokenBAddress, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline });
  amountADesired = web3.utils.fromWei(amountADesired);
  amountBDesired = web3.utils.fromWei(amountBDesired);
  amountAmin = web3.utils.fromWei(amountAMin);
  amountBmin = web3.utils.fromWei(amountBMin);

  let tokenA = findTokenBy(tokens, 'address', tokenAAddress);
  let tokenASymbol = (tokenA) ? tokenA.symbol : '';

  let tokenB = findTokenBy(tokens, 'address', tokenBAddress);
  let tokenBSymbol = (tokenB) ? tokenB.symbol : '';

  console.log(`Added Liquidity (method: 'addLiquidity') for token A ${tokenASymbol} (amount desired: ${amountADesired}, amount minimum: ${amountAmin}) and token B ${tokenBSymbol} (amount desired: ${amountBDesired}, amount minimum: ${amountBmin})`);
}

function outputAddLiquidityETHInfo(decodedInput) {
  var [ tokenAddress, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ tokenAddress, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline });
  amountTokenDesired = web3.utils.fromWei(amountTokenDesired);
  amountTokenMin = web3.utils.fromWei(amountTokenMin);
  amountETHMin = web3.utils.fromWei(amountETHMin);

  let token = findTokenBy(tokens, 'address', tokenAddress);
  let tokenSymbol = (token) ? token.symbol : '';

  console.log(`Added Liquidity (method: 'addLiquidityETH') for ONE/wONE (amount mininum: ${amountETHMin}) and token ${tokenSymbol} (amount desired: ${amountTokenDesired}, amount minimum: ${amountTokenMin})`);
}

function outputRemoveLiquidityInfo(decodedInput) {
  var [ tokenAAddress, tokenBAddress, liquidity, amountAMin, amountBMin, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ tokenAAddress, tokenBAddress, liquidity, amountAMin, amountBMin, to, deadline });
  liquidity = web3.utils.fromWei(liquidity);
  amountAmin = web3.utils.fromWei(amountAMin);
  amountBmin = web3.utils.fromWei(amountBMin);

  let tokenA = findTokenBy(tokens, 'address', tokenAAddress);
  let tokenASymbol = (tokenA) ? tokenA.symbol : '';

  let tokenB = findTokenBy(tokens, 'address', tokenBAddress);
  let tokenBSymbol = (tokenB) ? tokenB.symbol : '';

  console.log(`Removed ${liquidity} liquidity (method: 'removeLiquidity') for token A ${tokenASymbol} (amount minimum: ${amountAmin}) and token B ${tokenBSymbol} (amount minimum: ${amountBmin})`);
}

function outputRemoveLiquidityEthInfo(decodedInput) {
  var [ tokenAddress, liquidity, amountTokenMin, amountETHMin, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ tokenAddress, liquidity, amountTokenMin, amountETHMin, to, deadline });
  liquidity = web3.utils.fromWei(liquidity);
  amountTokenMin = web3.utils.fromWei(amountTokenMin);
  amountETHMin = web3.utils.fromWei(amountETHMin);

  let token = findTokenBy(tokens, 'address', tokenAddress);
  let tokenSymbol = (token) ? token.symbol : '';

  console.log(`Removed ${liquidity} liquidity (method: 'removeLiquidityETH') for ONE/wONE (amount mininum: ${amountETHMin}) and token ${tokenSymbol} (amount minimum: ${amountTokenMin})`);
}

function outputSwapExactTokensForTokensInfo(decodedInput) {
  var [ amountIn, amountOutMin, path, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ amountIn, amountOutMin, path, to, deadline });
  amountIn = web3.utils.fromWei(amountIn);
  amountOutMin = web3.utils.fromWei(amountOutMin);

  let startToken = findTokenBy(tokens, 'address', path[0]);
  let startTokenSymbol = (startToken) ? startToken.symbol : '';

  let endToken = findTokenBy(tokens, 'address', path[path.length - 1]);
  let endTokenSymbol = (endToken) ? endToken.symbol : '';

  console.log(`Swapped (method: 'swapExactTokensForTokens') ${amountIn} ${startTokenSymbol} (${path[0]}) for ${endTokenSymbol} (${path[path.length - 1]}) (amount minimum: ${amountOutMin})`)
}

function outputSwapTokensForExactTokensInfo(decodedInput) {
  var [ amountOut, amountInMax, path, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ amountOut, amountInMax, path, to, deadline });
  amountOut = web3.utils.fromWei(amountOut);
  amountInMax = web3.utils.fromWei(amountInMax);

  let startToken = findTokenBy(tokens, 'address', path[0]);
  let startTokenSymbol = (startToken) ? startToken.symbol : '';

  let endToken = findTokenBy(tokens, 'address', path[path.length - 1]);
  let endTokenSymbol = (endToken) ? endToken.symbol : '';

  console.log(`Swapped (method: 'swapTokensForExactTokens' ${startTokenSymbol} (${path[0]}) (amount maximum: ${amountInMax}) for ${amountOut} ${endTokenSymbol} (${path[path.length - 1]})`)
}

function outputSwapExactETHForTokensInfo(decodedInput) {
  var [ amountOutMin, path, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ amountOutMin, path, to, deadline })
  amountOutMin = web3.utils.fromWei(amountOutMin);

  let endToken = findTokenBy(tokens, 'address', path[path.length - 1]);
  let endTokenSymbol = (endToken) ? endToken.symbol : '';

  console.log(`Swapped (method: 'swapExactETHForTokens') ONE/wONE for ${endTokenSymbol} (${path[path.length - 1]}) (amount minimum: ${amountOutMin})`)
}

function outputSwapTokensForExactETHInfo(decodedInput) {
  var [ amountOut, amountInMax, path, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ amountOut, amountInMax, path, to, deadline });
  amountOut = web3.utils.fromWei(amountOut);
  amountInMax = web3.utils.fromWei(amountInMax);

  let startToken = findTokenBy(tokens, 'address', path[0]);
  let startTokenSymbol = (startToken) ? startToken.symbol : '';

  console.log(`Swapped (method: 'swapTokensForExactETH' ${startTokenSymbol} (${path[0]}) (amount maximum: ${amountInMax}) for ${amountOut} ONE`)
}

function outputSwapExactTokensForETHInfo(decodedInput) {
  var [ amountIn, amountOutMin, path, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ amountIn, amountOutMin, path, to, deadline });
  amountIn = web3.utils.fromWei(amountIn);
  amountOutMin = web3.utils.fromWei(amountOutMin);

  let startToken = findTokenBy(tokens, 'address', path[0]);
  let startTokenSymbol = (startToken) ? startToken.symbol : '';

  console.log(`Swapped (method: 'swapExactTokensForETH') ${amountIn} ${startTokenSymbol} (${path[0]}) for ONE/wONE (amount minimum: ${amountOutMin})`)
}

function outputSwapETHForExactTokensInfo(decodedInput) {
  var [ amountOut, path, to, deadline ] = decodedInput.contractMethodParameters;
  console.log({ amountOut, path, to, deadline });
  amountOut = web3.utils.fromWei(amountOut);

  let endToken = findTokenBy(tokens, 'address', path[path.length - 1]);
  let endTokenSymbol = (endToken) ? endToken.symbol : '';

  console.log(`Swapped (method: 'swapTokensForExactTokens' ONE/wONE for ${amountOut} ${endTokenSymbol} (${path[path.length - 1]})`)
}

status()
  .then(() => {
    process.exit(0);
  })
  .catch(function(err){
    console.log(err);
    process.exit(0);
  });
