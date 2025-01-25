var express = require('express');
var router = express.Router();
var SerialPortController = require('../controllers/SerialPortControllers');

require('dotenv').config();

/* GET home page. */
router.get('/', function(req, res, next) {
  const appName = process.env.APP_NAME || 'PARIS Operator Express v2';
  res.render('index', { title: appName });
});

router.get('/test-connect', SerialPortController.openGate);

router.get('/ports', SerialPortController.listPort);
router.post('/ports', SerialPortController.changePort);

router.get('/open', SerialPortController.openGate);

module.exports = router;
