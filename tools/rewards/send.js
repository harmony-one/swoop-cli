// Args
const yargs = require('yargs');
const argv = yargs
  .option('network', {
    alias: 'n',
    description: 'Which network to use',
    type: 'string',
    default: 'testnet'
  })
  .option('dryrun', {
    alias: 'd',
    description: 'If to run in dryrun mode = not sending actual transactions',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h')
  .argv;

const networkName = argv.network.toLowerCase();
const dryrun = argv.dryrun;

// Libs
const web3 = require('web3');
const { fromBech32 } = require("@harmony-js/crypto");
const { HmyEnv} = require("@swoop-exchange/utils");
const glob = require("glob");
const fs = require('fs');
const parse = require('csv-parse/lib/sync');
const ObjectsToCsv = require('objects-to-csv');

// Vars
const network = new HmyEnv(networkName);
const basePath = `data/rewards/${networkName}`;
const tokenAddress = (networkName === 'mainnet') ? '0xE176EBE47d621b984a73036B9DA5d834411ef734' : '0x0E80905676226159cC3FF62B1876C907C91F7395';
const tokenContract = network.loadContract(`@swoop-exchange/core/build/contracts/ERC20.json`, tokenAddress, 'deployer');
const tokenInstance = tokenContract.methods;

async function processRewards() {
  const rewards = parseRewards();
  const processed = [];

  var [totalCount, successfulCount, failedCount, totalRewards] = [0, 0, 0, 0.0];
  
  for (let address in rewards) {
    let reward = rewards[address];

    console.log(`Found reward for address ${address} - reward: ${reward}`);

    const item = {address: address, reward: reward, status: 'dryrun'};

    if (!dryrun) {
      // Txs will be sent here since we're not running using dryrun mode
      const txHash = await sendReward(address, reward);
      
      if (txHash && txHash !== '') {
        item.status = 'success';
        item.txHash = txHash;
        successfulCount++;
      } else {
        item.status = 'failed';
        failedCount++;
      }
    }

    processed.push(item);
    totalCount++;
    totalRewards = (totalRewards + reward);
  }

  console.log(`Processed a total of ${totalCount} reward entries. Successful: ${successfulCount}, failed: ${failedCount}. Total rewards: ${totalRewards} BUSD.`);

  if (processed && processed.length > 0) {
    const csvPath = `${basePath}/processed-rewards-${timestampString()}.csv`;
    console.log(`Exporting reward data to ${csvPath}`);
    await exportToCSV(csvPath, processed);
  }
}

async function exportToCSV(path, items) {
  if (items && items.length > 0) {
    const csv = new ObjectsToCsv(items);
    await csv.toDisk(path);
  }
}

async function sendReward(address, reward) {
  var txHash = null;
  const rewardWei = web3.utils.toWei(reward.toString());
  const base16Address = fromBech32(address);

  try {
    console.log(`Attempting to send ${reward} BUSD to ${address} (${base16Address}) ...`);
    
    let result = await tokenInstance.transfer(base16Address, rewardWei).send(network.gasOptions());
    let status = result.status.toLowerCase();
    let txStatus = result.transaction.txStatus.toLowerCase();

    txHash = (status === 'called' && txStatus === 'confirmed' && result.transaction.receipt.transactionHash && result.transaction.receipt.transactionHash !== '') ? result.transaction.receipt.transactionHash : null;
    
    if (txHash && txHash !== '') {
      console.log(`Successfully sent ${reward} BUSD to ${address} (${base16Address}), tx hash: ${txHash}\n`);
    } else {
      console.log(`Failed to send ${reward} BUSD to ${address} (${base16Address})\n`);
    }    
  } catch (error) {
    console.log(`Failed to send ${reward} BUSD to ${address} (${base16Address}) - error: ${error}\n`);
  }

  return txHash;
}

function parseRewards() {
  const csvFiles = glob.sync(`${basePath}/rewards/*.csv`);
  const combinedRewards = {};
  const inegibleAddresses = parseInegibleAddresses(`${basePath}/inegible.txt`);
  const replacements = parseReplacements(`${basePath}/replacements.csv`);

  for (let csvFile of csvFiles) {
    const fileContent = fs.readFileSync(csvFile);
    const records = parse(fileContent, {columns: true});

    for (let record of records) {
      let address = record.address;
      let rewards = record.rewards;

      if (address && address !== '' && rewards && rewards !== '' && !inegibleAddresses.includes(address)) {
        rewards = Number(rewards);
        address = (replacements && replacements.length > 0) ? replaceAddressIfNecessary(address, replacements) : address;
        let currentRewards = !(address in combinedRewards) ? rewards : (combinedRewards[address] + rewards);
        combinedRewards[address] = currentRewards;
      }
    }
  }

  return combinedRewards;
}

function parseInegibleAddresses(path) {
  return fileExists(path) ? fs.readFileSync(path).toString().split("\n").filter(function (el) { return el !== null && el !== '' }) : [];
}

function parseReplacements(path) {
  var replacements = {}

  if (fileExists(`${basePath}/replacements.csv`)) {
    const fileContent = fs.readFileSync(`${basePath}/replacements.csv`);
    const records = parse(fileContent, {columns: true});
    replacements = (records && records.length > 0) ? records : [];
  }

  return replacements;
}

function replaceAddressIfNecessary(address, replacements) {
  for (let replacement of replacements) {
    if (replacement && replacement.from && replacement.from !== '' && replacement.to && replacement.to !== '' && replacement.from === address) {
      console.log(`Replacing original address ${address} with ${replacement.to}`);
      address = replacement.to;
    }
  }

  return address;
}

function fileExists(path) {
  var exists = false;

  try {
    if (fs.existsSync(path)) {
      exists = true;
    }
  } catch(err) {
  }

  return exists
}

function timestampString() {
  return new Date().toUTCString().replace(/[\s:,]+/gi, '-');
}

async function tokenBalance(contractInstance, token, address, oneAddress) {
  let senderBalanceOf = await contractInstance.balanceOf(address).call(network.gasOptions());
  console.log(`${token.name} Balance for address ${oneAddress} (${address}) is: ${web3.utils.fromWei(senderBalanceOf)} ${token.name}\n`);
}

processRewards().then(() => {
  process.exit(0);
})
.catch(function(err){
  console.log(err);
  process.exit(0);
});
