const server = require('http').createServer();
const io = require('socket.io')(server);
const fs = require('fs');
const pgcli = require('./pg-client');
const rpccli = require('./rpc-client');

var config = JSON.parse(fs.readFileSync('./explorer.conf'));
console.assert(config.node, "node is not exist. check explorer.conf");
pgcli.init(config.postgresql);
rpccli.init(config.node);

let blockQueue = [];
function updateBlockQueue(block) {
	if (4 < blockQueue.length)
		blockQueue.splice(0, 1);
	blockQueue.push(block);
	io.emit('blocks', { block: blockQueue });
}

async function updateBlock() {
	try {
		let dbHeight = await pgcli.getLastBlockHeight();
		let rpcHeight = await rpccli.getHeight();
		while (dbHeight < rpcHeight.blockheight) {
			let diff = rpcHeight.blockheight - dbHeight;
			diff = 100 < diff ? 100 : diff;
			let res = await rpccli.getBlocks(dbHeight + 1, dbHeight + 1 + diff);
			let blocks = res.blocks;
			console.log(res);
			await pgcli.beginTransaction();
			for (let i = 0; i < blocks.length; ++i) {
				await pgcli.insertBlock(blocks[i]);
				updateBlockQueue(blocks[i]);
			}
			await pgcli.commit();
			dbHeight += diff;
		}
		setTimeout(updateBlock, 1000);
	} catch (e) {
		pgcli.rollback();
		setTimeout(updateBlock, 1000);
		throw e;
	}
}

async function mainFunc() {
	try {
		io.on('connection', (socket) => {					
			console.log('connection');
			socket.emit('blocks', { block: blockQueue });
		});
		io.listen(3001);
				
		updateBlock();
	} catch(e) {
		console.log(e);
		throw e;
	}
}

mainFunc();