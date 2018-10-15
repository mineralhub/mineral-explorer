const express = require('express');
const router = express.Router();
const eah = require('express-async-handler');
const pgcli = require('./../pg-client');
router.get('/balance/:address', eah(async (req, res, next) => {
  let account = await pgcli.getAccountBalance(req.params.address);
  res.send(account);
}));

router.get('/:address', eah(async (req, res, next) => {
  let account = await pgcli.getAccount(req.params.address);
  res.send(account);
}));

module.exports = router;