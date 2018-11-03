const { Client } = require('pg');
const pgcli = new Client(require('./configure').postgresql);
const common = require('./common');
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

function addAccountBalance(list, addr, txhash, amount) {
	if (list[addr] === undefined)
		list[addr] = {amount:0, txs: []};
	
	list[addr].amount += amount;
	if (txhash)
		list[addr].txs.push(txhash);
}

function addDelegateVote(list, addr, amount) {
	if (list[addr])
		list[addr].amount += amount;
	else
		list[addr] = {amount: amount};
}

function lockBalance(list, addr, txhash, amount) {
	if (list[addr] === undefined)
		list[addr] = {amount: 0, txs: []};

	list[addr].amount = amount;
	list[addr].txs.push(txhash);
}

function unlockBalance(list, addr, txhash) {
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

	let changeBalanceList = {};
	let lockBalanceList = {};
	let unlockBalanceList = {};
	let registerDelegateList = {};
	let voteDelegateList = {};
	let values = '';
	for (let i in block.transactions) {
		let tx = block.transactions[i];
		if (0 < values.length)
			values += ',';
		let from = common.addressHashToAddr(tx.data.from);
		values += `(${tx.version}, ${tx.type}, '${from}', to_timestamp(${tx.timestamp}), '${JSON.stringify(tx.data)}', '${tx.hash}', ${block.header.height})`;

		switch (tx.type) {
			case 1: {
				addAccountBalance(changeBalanceList, from, tx.hash, tx.data.reward);
			}
			break;
			case 2: {
				let t = 0;
				for (let j in tx.data.to) {
					let to = tx.data.to[j];
					addAccountBalance(changeBalanceList, common.addressHashToAddr(to.addr), tx.hash, to.amount);
					t -= to.amount;
				}
				addAccountBalance(changeBalanceList, from, tx.hash, t);
			}
			break;
			case 3: {
				for (let addr in tx.data.votes) {
					addDelegateVote(voteDelegateList, common.addressHashToAddr(addr), tx.data.votes[addr]);
				}
			}
			case 4: {
				if (tx.data.fee)
					addAccountBalance(changeBalanceList, from, tx.hash, -tx.data.fee);
				registerDelegateList[from] = tx.data.name;
			}
			break;
			case 7: {
				lockBalance(lockBalanceList, from, tx.hash, tx.data.locks);
				addAccountBalance(changeBalanceList, from, undefined, -tx.data.locks);
			}
			break;
			case 8: {
				//lockBalance(lockBalanceList, from, tx.hash, 0);
				//addAccountBalance(changeBalanceList, from, undefined, -tx.data.locks);
			}
			break;
		}
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
			block_height
    )
		VALUES ` + values);
	} catch (e) {
		console.log('exception. insert transactions');
		throw e;
	}

	values = '';
	let idxvalues = '';
	for (let addr in changeBalanceList) {
		if (0 < values.length)
			values += ',';
		values += `('${addr}', ${changeBalanceList[addr].amount})`;
		for (let i in changeBalanceList[addr].txs) {
			if (0 < idxvalues.length)
				idxvalues += ',';
			idxvalues += `('${addr}', '${changeBalanceList[addr].txs[i]}')`;
		}
	}

	try {
		await pgcli.query(`INSERT INTO accounts
		(
			address,
			balance
		) 
		VALUES ` + values + `
		ON CONFLICT (address) DO UPDATE
		SET 
		balance = accounts.balance + EXCLUDED.balance`);
	} catch (e) {
		console.log('exception. insert accounts');
		throw e;
	}

	values = '';
	for (let addr in lockBalanceList) {
		if (0 < values.length)
			values += ',';
		values += `('${addr}', ${lockBalanceList[addr].amount})`;
		for (let i in lockBalanceList[addr].txs) {
			if (0 < idxvalues.length)
				idxvalues += ',';
			idxvalues += `('${addr}', '${lockBalanceList[addr].txs[i]}')`;
		}
	}

	try {
		if (0 < values.length) {
			await pgcli.query(`UPDATE accounts as a
			SET 
				lock=v.lock
			FROM (values
				${values}
			) as v(address, lock)
			WHERE a.address = v.address`);
		}
	} catch (e) {
		console.log('exception. insert accounts (lock)');
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
	for (let addr in registerDelegateList) {
		if (0 < values.length)
			values += ',';
		values += `('${addr}', '${registerDelegateList[addr]}', 0)`;
	}

	try {
		if (0 < values.length) {
			await pgcli.query(`INSERT INTO delegates
			(
				address,
				name,
				total_vote
			)
			VALUES ` + values);
		}
	} catch (e) {
		console.log('exception. insert delegates');
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
			block_height
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
			block_height
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