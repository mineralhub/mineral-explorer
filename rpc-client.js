const rp = require('request-promise');
var node = null;

module.exports.init = function(config) {
    node = config;
}

module.exports.getHeight = async () => {
    try {
        let res = await rp({
            method: 'GET',
            uri: `http://${node.host}:${node.rpc_port}?id=1&method=getheight&params=[]`,
            json: true
        });
        return res.result;
    } catch (e) {
        throw e;
    }
};

module.exports.getBlock = async(height) => {
    try {
        let res = await rp({
            method: 'GET',
            uri: `http://${node.host}:${node.rpc_port}?id=2&method=getblock&params=[${height + 1}]`,
            json: true
        });
        return res.result;
    } catch (e) {
        throw e;
    }
}