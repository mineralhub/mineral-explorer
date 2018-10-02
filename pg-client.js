const { Client } = require('pg');
var pgcli = null;

module.exports.init = function (config) {
	try {
		pgcli = new Client(config);
		pgcli.connect();
	} catch (e) {
		console.log(`pgcli connect error.`);
		throw e;
	}
}

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
	try {
		let res = await pgcli.query(`SELECT height FROM blocks ORDER BY height DESC LIMIT 1`);
		return res.rowCount == 0 ? 0 : res.rows[0].height;
	} catch (e) {
		throw e;
	}
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

	let values = '';
	for (let i = 0; i < block.transactions.length; ++i) {
		let tx = block.transactions[i];
		if (0 < values.length)
			values += ',';
		values += `(${tx.version}, ${tx.type}, to_timestamp(${tx.timestamp}), '${JSON.stringify(tx.data)}', '${tx.hash}')`
	}
	await pgcli.query(`INSERT INTO transactions
    (
			version,
      type,
      created_time,
      data,
      hash
    )
  	VALUES ` + values);
};