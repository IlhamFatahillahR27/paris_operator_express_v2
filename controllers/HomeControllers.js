const microOutService = require('../services/GateOut/MicroOutService');
const config = require('../config/config');

require('dotenv').config();

const index = async (req, res) => {
    const appName = process.env.APP_NAME || 'PARIS Operator Express v2';
    const listPort = await microOutService.listPorts();
    const selected = config.getConfigValue('PortMicroOut');
    
    res.render('index', { title: appName, port_list: listPort, selected_port: selected });
}

module.exports = {
    index
}