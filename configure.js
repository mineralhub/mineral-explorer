const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./explorer.conf'));

module.exports = config;