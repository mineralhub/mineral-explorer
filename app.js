const app = require('express')();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const pgcli = require('./pg-client');
const rpccli = require('./rpc-client');

let queueSize = 15;
let blockQueue = [];
let txQueue = [];

function updateBlockQueue(block) {
	if (queueSize < blockQueue.length)
		blockQueue.splice(0, 1);
	blockQueue.push(block);
	io.emit('block', { block: block });
	for (let i = 0; i < block.transactions.length; ++i)
		updateTxQueue(block.transactions[i]);
}

function updateTxQueue(tx) {
	if (queueSize < txQueue.length)
		txQueue.splice(0, 1);
	txQueue.push(tx);
	io.emit('transaction', {transaction : tx });
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
			await pgcli.beginTransaction();
			for (let i = 0; i < blocks.length; ++i) {
				await pgcli.insertBlock(blocks[i]);
				updateBlockQueue(blocks[i]);
			}
			io.emit('lastblocks', {block: blockQueue.slice().reverse()});
			io.emit('lasttransactions', {transaction: txQueue.slice().reverse()});
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
		app.use(require('cors')());
		app.use('/transaction', require('./api/transaction.js'));
		app.use('/block', require('./api/block.js'));
		app.use('/account', require('./api/account.js'));
		server.listen(80);

		io.on('connection', (socket) => {					
			console.log('connection');
			socket.emit('lastblocks', {block: blockQueue.slice().reverse()});
			socket.emit('lasttransactions', {transaction: txQueue.slice().reverse()});
		});
		io.listen(3001);
				
		updateBlock();
	} catch(e) {
		console.log(e);
		throw e;
	}
}

mainFunc();