const express = require('express');
const router = express.Router();
const eah = require('express-async-handler');
const pgcli = require('./../pg-client');
router.get('/:hash', eah(async (req, res, next) => {
  let tx = await pgcli.getTransaction(req.params.hash);
  res.send(tx);
}));

module.exports = router;