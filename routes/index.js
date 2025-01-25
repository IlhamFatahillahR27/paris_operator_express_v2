var express = require('express');
var router = express.Router();
var SerialPortController = require('../controllers/SerialPortControllers');
var HomeController = require('../controllers/HomeControllers');

/* GET home page. */
router.get('/', HomeController.index);

router.get('/test-connect', SerialPortController.openGate);

router.get('/ports', SerialPortController.listPort);
router.post('/ports', SerialPortController.changePort);

router.get('/open', SerialPortController.openGate);

module.exports = router;
