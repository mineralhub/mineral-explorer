const rp = require('request-promise');
const node = require('./configure').node;

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

module.exports.getBlock = async (height) => {
  try {
    let res = await rp({
      method: 'GET',
      uri: `http://${node.host}:${node.rpc_port}?id=2&method=getblock&params=[${height}]`,
      json: true
    });
    return res.result;
  } catch (e) {
    throw e;
  }
}

module.exports.getBlocks = async (start, end) => {
  try {
    let res = await rp({
      method: 'GET',
      uri: `http://${node.host}:${node.rpc_port}?id=2&method=getblocks&params=[${start},${end}]`,
      json: true
    });
    return res.result;
  } catch (e) {
    throw e;
  }
}

module.exports.sendTo = async (bytes) => {
  try {
    console.log(bytes);
    let res = await rp({
      method: 'POST',
      uri: `http://${node.host}:${node.rpc_port}`,
      body: {
        id: 3,
        method: 'sendto',
        params: [bytes]
      },
      json: true
    });
    if (res.error) {
      console.log(res.error);
      throw res.error;
    }
    return res.result;
  } catch (e) {
    throw e;
  }
}