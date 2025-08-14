var express = require('express');
var router = express.Router();
var HomeController = require('../controllers/HomeControllers');

const eventLoopValidate = require('../middlewares/eventLoopValidator');

router.get('/loop', eventLoopValidate, HomeController.apiLoopEvent);

module.exports = router;