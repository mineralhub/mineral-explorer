const express = require('express');
const router = express.Router();
const eah = require('express-async-handler');
const pgcli = require('./../pg-client');
const rpccli = require('./../rpc-client');

router.get('/:hash', eah(async (req, res, next) => {
  let tx = await pgcli.getTransaction(req.params.hash);
  res.send(tx);
}));

router.get('/:address/:page', eah(async (req, res, next) => {
  let txs = await pgcli.getTransactions(req.params.address, (req.params.page - 1) * 20, 20);
  res.send(txs);
}));

router.post('/sendto', eah(async (req, res, next) => {
  let rpc = await rpccli.sendTo(req.body.bytes);
  res.send(rpc);
}));

module.exports = router;