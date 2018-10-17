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

	let accounts = {};
	let values = '';
	for (let i = 0; i < block.transactions.length; ++i) {
		let tx = block.transactions[i];
		if (0 < values.length)
			values += ',';
		let to = '';
		if (tx.data.to)
			to = common.addressHashToAddr(tx.data.to);
		let from = common.addressHashToAddr(tx.data.from);

		values += `(${tx.version}, ${tx.type}, '${from}', '${to}', to_timestamp(${tx.timestamp}), '${JSON.stringify(tx.data)}', '${tx.hash}', ${block.header.height})`;

		switch (tx.type) {
			case 1: {
				if (accounts[from])
					accounts[from] += tx.data.reward;
				else 
					accounts[from] = tx.data.reward;
			}
			break;
			case 2: {
				let t = 0;
				for (let k in tx.data.to) {
					let addr = common.addressHashToAddr(k);
					if (accounts[addr])
						accounts[addr] += tx.data.to[k];
					else
						accounts[addr] = tx.data.to[k];
					t += tx.data.to[k];
				}
				if (accounts[from])
					accounts[from] -= t;
				else
					accounts[from] = -t;
			}
			break;
		}
	}
	await pgcli.query(`INSERT INTO transactions
    (
			version,
			type,
			from_address,
			to_address,
      created_time,
      data,
			hash,
			block_height
    )
		VALUES ` + values);

	values = '';
	for (let k in accounts) {
		if (0 < values.length)
			values += ',';
		values += `('${k}', ${accounts[k]})`
	}

	await pgcli.query(`INSERT INTO accounts
		(
			address,
			balance
		) 
		VALUES ` + values + `
		ON CONFLICT (address) DO UPDATE
		SET balance = accounts.balance + EXCLUDED.balance`);
};

module.exports.getBlock = async (hash) => {
	let res = await pgcli.query(`SELECT 
			height, 
			version, 
			transactions, 
			hash, 
			prevhash, 
			extract(epoch from created_time) as created_time 
		FROM blocks 
		WHERE hash='${hash}'`);
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
		WHERE to_address='${address}' OR from_address='${address}' 
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