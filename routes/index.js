var express = require('express');
var router = express.Router();

require('dotenv').config();

/* GET home page. */
router.get('/', function(req, res, next) {
  const appName = process.env.APP_NAME || 'PARIS Operator Express v2';
  res.render('index', { title: appName });
});

module.exports = router;
