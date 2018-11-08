const fs = require('fs');
const explorer = JSON.parse(fs.readFileSync('./explorer.conf'));
var blockchain = undefined;

module.exports.explorer = explorer;
module.exports.blockchain = blockchain;