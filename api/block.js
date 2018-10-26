const express = require('express');
const router = express.Router();
const eah = require('express-async-handler');
const pgcli = require('./../pg-client');
router.get('/:height', eah(async (req, res, next) => {
  let block = await pgcli.getBlock(req.params.height);
  res.send(block);
}));

module.exports = router;