const { Client } = require('pg');
const pgcli = new Client(require('./configure').explorer.postgresql);
const blockchain = require('./common/blockchain');
const bigInt = require("big-integer");

const RoundBlock = 100;

pgcli.connect();

module.exports.beginTransaction = async () => {
	await pgcli.query(`BEGIN`);
}

module.exports.commit = async () => {
	await pgcli.query(`COMMIT`);
}

module.exports.rollback = async () => {
	await pgcli.query(`ROLLBACK`);
}

module.exports.getLastBlockHeight = async () => {
	let res = await pgcli.query(`SELECT height FROM blocks ORDER BY height DESC LIMIT 1`);
	return res.rowCount === 0 ? 0 : res.rows[0].height;
};

async function loadAccount(list, address) {
	if (list[address])
		return list[address];
	let res = await pgcli.query(`SELECT
	address, balance, lock, vote
	FROM accounts
	WHERE address='${address}'`);
	if (res.rowCount === 0) {
		list[address] = {
			address: address,
			balance: bigInt(0),
			lock: bigInt(0),
			vote: {},
			txs: []
		}
	} else {
		res.rows[0].balance = bigInt(res.rows[0].balance);
		res.rows[0].lock = bigInt(res.rows[0].lock);
		res.rows[0].txs = [];
		list[address] = res.rows[0];
	}
	return list[address];
}

async function loadDelegate(list, address) {
	if (list[address])
		return list[address];
	let res = await pgcli.query(`SELECT
	address, name, total_vote
	FROM delegates
	WHERE address='${address}'`);
	if (res.rowCount === 0) {
		list[address] = {
			address: address,
			name: undefined,
			total_vote: bigInt(0),
		}
	} else {
		res.rows[0].total_vote = bigInt(res.rows[0].total_vote);
		list[address] = res.rows[0];
	}
	return list[address];
}

function addBalance(account, add, txhash) {
	account.balance = account.balance.add(add);
	if (txhash) {
		account.txs.push(txhash);
	}
}

function lockBalance(account, lock, txhash) {
	account.balance = account.balance.add(-lock);
	account.lock += lock;
	account.txs.push(txhash);
}

function unlockBalance(account, txhash) {
	account.balance = account.balance.add(account.lock);
	account.lock = bigInt(0);
	account.txs.push(txhash);
}

function addVote(account, delegate, add) {
	delegate.total_vote = delegate.total_vote.add(add);
	if (0 < add) {
		account.vote[delegate.address] = add;
	}
}

function registerDelegate(account, delegate, name, txhash) {
	delegate.name = name;
	account.txs.push(txhash);
}

module.exports.insertBlock = async (block) => {
	try {
		await pgcli.query(`INSERT INTO blocks
  	(
      height,
      version,
      transactions,
      hash,
      prevhash,
      created_time
    ) 
    VALUES 
    (
      ${block.header.height},
      ${block.header.version},
      ${block.transactions.length}, 
      '${block.hash}', 
      '${block.header.prevhash}',
      to_timestamp(${block.header.timestamp})
    )`);
	} catch (e) {
		console.log('exception. insert blocks');
		throw e;
	}

	let values = '';
	let accounts = {};
	let delegates = {};
	for (let i in block.transactions) {
		let subdata = undefined;
		let tx = block.transactions[i];
		if (0 < values.length)
			values += ',';
		let from = await loadAccount(accounts, blockchain.toAddressFromHash(tx.data.from));
		let fee = bigInt(tx.data.fee);
		if (0 < fee)
			addBalance(from, -fee);

		switch (tx.type) {
			case 1: {
				addBalance(from, tx.data.reward, tx.hash);
			}
			break;
			case 2: {
				let t = 0;
				for (let j in tx.data.to) {
					let to = tx.data.to[j];
					addBalance(await loadAccount(accounts, blockchain.toAddressFromHash(to.addr)), to.amount, tx.hash);
					t -= to.amount;
				}
				addBalance(from, t, tx.hash);
			}
			break;
			case 3: {
				let old = from.vote;
				for (let addr in old)
					addVote(from, await loadDelegate(delegates, addr), -old[addr]);
				from.vote = {};
				for (let addr in tx.data.votes)
					addVote(from, await loadDelegate(delegates, blockchain.toAddressFromHash(addr)), tx.data.votes[addr]);
				from.txs.push(tx.hash);
			}
			break;
			case 4: {
				registerDelegate(
					from,
					await loadDelegate(delegates, from.address),
					tx.data.name,
					tx.hash
				);
			}
			break;
			case 7: {
				lockBalance(
					from,
					tx.data.locks,
					tx.hash
				);
			}
			break;
			case 8: {
				subdata = { lock : from.lock};
				unlockBalance(
					from,
					tx.hash
				);
			}
			break;
		}

		values += `(
			${tx.version}, 
			${tx.type}, 
			'${from}', 
			to_timestamp(${tx.timestamp}), 
			'${JSON.stringify(tx.data)}', 
			'${tx.hash}', 
			${block.header.height}, 
			${subdata === undefined ? 'null' : `'${JSON.stringify(subdata)}'`}
		)`;

	}
	try {
		await pgcli.query(`INSERT INTO transactions
    (
			version,
			type,
			from_address,
      created_time,
      data,
			hash,
			block_height,
			sub_data
    )
		VALUES ` + values);
	} catch (e) {
		console.log('exception. insert transactions');
		throw e;
	}

	values = '';
	idxvalues = '';
	for (let addr in accounts) {
		let account = accounts[addr];
		if (0 < values.length)
			values += ',';
		values += `(
			'${addr}', 
			${account.balance}, 
			${account.lock}, 
			'${JSON.stringify(account.vote)}'
			)`;
		for (let i in account.txs) {
			if (0 < idxvalues.length)
				idxvalues += ',';
			idxvalues += `('${addr}', '${account.txs[i]}')`;
		}
	}

	try {
		await pgcli.query(`INSERT INTO accounts
		(
			address,
			balance,
			lock,
			vote
		) 
		VALUES ` + values + `
		ON CONFLICT (address) DO UPDATE
		SET 
		balance = EXCLUDED.balance,
		lock = EXCLUDED.lock,
		vote = EXCLUDED.vote`);
	} catch (e) {
		console.log('exception. insert accounts');
		throw e;
	}

	try {
		await pgcli.query(`INSERT INTO txindex
		(
			address,
			hash
		)
		VALUES ` + idxvalues);
	} catch (e) {
		console.log('exception. insert txindex');
		throw e;
	}

	values = '';
	for (let addr in delegates) {
		let delegate = delegates[addr];
		if (0 < values.length)
			values += ',';
		values += `('${addr}', '${delegate.name}', ${delegate.total_vote})`;
	}

	try {
		if (0 < values.length) {
			await pgcli.query(`INSERT INTO delegates
			(
				address,
				name,
				total_vote
			)
			VALUES ` + values + `
			ON CONFLICT (address) DO UPDATE
			SET
			total_vote = EXCLUDED.total_vote`);
		}
	} catch (e) {
		console.log('exception. insert delegates');
		throw e;
	}

	try {
		if (block.header.height % RoundBlock === 0) {
			await pgcli.query(`UPDATE delegates SET round_vote=total_vote`);
		}
	} catch (e) {
		console.log('exception. update delegates');
		throw e;
	}
};

module.exports.getBlock = async (height) => {
	let res = await pgcli.query(`SELECT 
			height, 
			version, 
			transactions, 
			hash, 
			prevhash, 
			extract(epoch from created_time) as created_time 
		FROM blocks 
		WHERE height='${height}'`);
	return res.rowCount === 0 ? null : res.rows[0];
}

module.exports.getTransaction = async (hash) => {
	let res = await pgcli.query(`SELECT 
			version, 
			type, 
			extract(epoch from created_time) as created_time, 
			data, 
			hash,
			block_height,
			sub_data
		FROM transactions 
		WHERE hash='${hash}'`);
	return res.rowCount === 0 ? null : res.rows[0];
};

module.exports.getTransactions = async(address, offset, limit) => {
	let idx = await pgcli.query(`SELECT 
			hash
		FROM 
		 	txindex
		WHERE 
			address='${address}'
		ORDER BY num DESC
		LIMIT ${limit} 
		OFFSET ${offset}`);

	if (idx.rowCount === 0) {
		return null;
	}

	let values = '';
	for (let i in idx.rows) {
		if (0 < values.length)
			values += ',';
		values += `'${idx.rows[i].hash}'`;
	}
	let res = await pgcli.query(`SELECT 
			version, 
			type, 
			extract(epoch from created_time) as created_time, 
			data, 
			hash,
			block_height,
			sub_data
		FROM 
			transactions 
		WHERE 
			hash 
		IN 
			(${values})
		ORDER BY created_time DESC`);
	return res.rows;
};

module.exports.getAccountBalance = async (address) => {
	let res = await pgcli.query(`SELECT
			balance,
			lock
		FROM accounts
		WHERE address='${address}'`);
	if (res.rowCount === 0) {
		return {
			balance : 0,
			lock: 0
		}
	}
	return res.rows[0];
};

module.exports.getAccount = async(address) => {
	let res = await pgcli.query(`SELECT
		*
	FROM accounts
	WHERE address='${address}'`);
	if (res.rowCount === 0) {
		return {
			address: address,
			balance: 0,
			lock: 0
		}
	}

	return res.rows[0];
};

module.exports.getDelegates = async() => {
	let res = await pgcli.query(`SELECT
		*
	FROM delegates
	ORDER BY round_vote DESC`);
	return res.rowCount === 0 ? [] : res.rows;
}