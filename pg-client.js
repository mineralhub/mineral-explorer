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
	return res.rowCount == 0 ? 0 : res.rows[0].height;
};

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


	let accounts = {};
	let values = '';
	for (let i = 0; i < block.transactions.length; ++i) {
		let tx = block.transactions[i];
		if (0 < values.length)
			values += ',';
		let from = common.addressHashToAddr(tx.data.from);

		values += `(${tx.version}, ${tx.type}, '${from}', to_timestamp(${tx.timestamp}), '${JSON.stringify(tx.data)}', '${tx.hash}', ${block.header.height})`;

		switch (tx.type) {
			case 1: {
				if (accounts[from]) {
					accounts[from].amount += tx.data.reward;
					accounts[from].txs.push(tx.hash);
				}
				else {
					accounts[from] = { amount: tx.data.reward, txs: [tx.hash] };
				}
			}
			break;
			case 2: {
				let t = 0;
				for (let k = 0; k < tx.data.to.length; ++k) {
					let to = tx.data.to[k];
					let addr = common.addressHashToAddr(to.addr);
					if (accounts[addr]) {
						accounts[addr].amount += to.amount;
						accounts[addr].txs.push(tx.hash);
					}
					else {
						accounts[addr] = { amount: to.amount, txs: [tx.hash] };
					}
					t += to.amount;
				}
				if (accounts[from]) {
					accounts[from].amount -= t;
					accounts[from].txs.push(tx.hash);
				}
				else {
					accounts[from] = { amount: -t, txs: [tx.hash] };
				}
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
	for (let addr in accounts) {
		if (0 < values.length) {
			values += ',';
		}
		values += `('${addr}', ${accounts[addr].amount})`;
		for (let i = 0; i < accounts[addr].txs.length; ++i) {
			if (0 < idxvalues.length) {
				idxvalues += ',';
			}
			idxvalues += `('${addr}', '${accounts[addr].txs[i]}')`;
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
		SET balance = accounts.balance + EXCLUDED.balance`);
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
	return res.rowCount == 0 ? null : res.rows[0];
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
	return res.rowCount == 0 ? null : res.rows[0];
};

module.exports.getTransactions = async(address, offset, limit) => {
	let res = await pgcli.query(`SELECT 
			version, 
			type, 
			extract(epoch from created_time) as created_time, 
			data, 
			hash,
			block_height
		FROM transactions 
		WHERE from_address='${address}' 
		ORDER BY created_time DESC 
		LIMIT ${limit} 
		OFFSET ${offset}`);
	return res.rows;
};

module.exports.getAccountBalance = async (address) => {
	let res = await pgcli.query(`SELECT
			balance
		FROM accounts
		WHERE address='${address}'`);
	if (res.rowCount == 0) {
		return {
			balance : 0
		}
	}
	res.rows[0].balance = Number(res.rows[0].balance);
	return res.rows[0];
};

module.exports.getAccount = async(address) => {
	let res = await pgcli.query(`SELECT
		*
	FROM accounts
	WHERE address='${address}'`);
	if (res.rowCount == 0)
		return null;

	res.rows[0].balance = Number(res.rows[0].balance);
	return res.rows[0];
};