const fs = require('fs');
const pgcli = require('./pg-client');
const rpccli = require('./rpc-client');

var config = JSON.parse(fs.readFileSync('./explorer.conf'));
console.assert(config.node, "node is not exist. check explorer.conf");
pgcli.init(config.postgresql);
rpccli.init(config.node);

async function updateBlock() {
    try {
        let dbHeight = await pgcli.getLastBlockHeight();
        let rpcHeight = await rpccli.getHeight();
        while (dbHeight < rpcHeight.blockheight) {
            let block = await rpccli.getBlock(dbHeight);
            // insert block
            pgcli.insertBlock(block);
            console.log(block);
            ++dbHeight;
        }
        setTimeout(updateBlock, 1000);
    } catch (e) {
        throw e;
    }
}

async function mainFunc() {
    try {
        updateBlock();
    } catch(e) {
        console.log(e);
        throw e;
    }
}

mainFunc();