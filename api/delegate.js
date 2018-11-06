const express = require('express');
const router = express.Router();
const eah = require('express-async-handler');
const pgcli = require('./../pg-client');
router.get('/all', eah(async (req, res, next) => {
  let delegates = await pgcli.getDelegates();
  res.send({delegates: delegates});
}));

module.exports = router;