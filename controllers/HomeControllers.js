const serialPortService = require('../services/serialPortService');
const parisServerService = require('../services/parisServerService');
const config = require('../config/config');

require('dotenv').config();

const index = async (req, res) => {
    const appName = process.env.APP_NAME || 'PARIS Operator Express v2';
    const listPort = await serialPortService.listPorts();
    const selected = config.getConfigValue('nodeSerialPort');
    
    res.render('index', { title: appName, port_list: listPort, selected_port: selected });
}

const apiLoopEvent = async (req, res) => {
    try {
        const result = await parisServerService.loopEvent(req.query.event);
        res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    index,
    apiLoopEvent
}