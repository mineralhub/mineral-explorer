const bs58check = require('bs58check');

module.exports.addressHashToAddr = (hash) => {
  let buf = Buffer.alloc(21);
  buf[0] = 0;
  if (typeof(hash) === 'string') {
    hash = Buffer.from(hash, 'hex');
  }
  hash.copy(buf, 1, 0, 20);
  return bs58check.encode(buf);
}