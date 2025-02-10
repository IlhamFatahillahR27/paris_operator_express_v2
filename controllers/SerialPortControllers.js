const microOutService = require('../services/GateOut/MicroOutService');
const config = require('../config/config');
const helpers = require('../utils/helpers');

const listPort = async (req, res) => {
    try {
        const data = await microOutService.listPorts();
        helpers.writeLog('[GATE OUT] Successfully listed ports');
        helpers.writeLog('[GATE OUT] Port : ' + data);
        res.status(200).json({
            success: true,
            ports: data,
            message: 'Successfully listed ports',
            error: null
        });
    } catch (error) {
        helpers.writeLog(`[GATE OUT] Failed to list ports. Error : ${error.message}`);
        res.status(500).json({ 
            success: false,
            ports : [],
            message: 'Failed to list ports',
            error: error.message
        });
    }
}

const changePort = async (req, res) => {
    const portName = req.body.port;

    try {
        config.setConfigValue('PortMicroOut', portName);
        const newConfig = config.getConfigValue('PortMicroOut');

        if (newConfig != portName) {
            throw new Error('Failed to change port');
        }

        helpers.writeLog(`[GATE OUT] Port changed to ${portName}`);
        microOutService.initializeSerialPort();

        res.status(200).json({
            success: true,
            message: `Successfully changed port to ${portName}`,
            error: null
        });
    } catch (error) {
        helpers.writeLog(`[GATE OUT] Failed to change port to ${portName}. Error : ${error.message}`);
        res.status(500).json({ 
            success: false,
            message: `Failed to change port to ${portName}`,
            error: error.message
        });
    }
}

const openGate = async (req, res) => {
    try {
        const message = ":OPEN1;";

        const data = await microOutService.sendCommand(message);

        if (!data) {
            throw new Error('Failed to open gate');
        }

        helpers.writeLog('[GATE OUT] Successfully opened gate. Response : ' + data);
        res.status(200).json({
            success: true,
            message: 'Successfully opened gate',
            error: null
        });
    } catch (error) {
        helpers.writeLog('[GATE OUT] Failed to open gate. Error : ' + error.message);
        res.status(500).json({ 
            success: false,
            message: 'Failed to open gate',
            error: error.message
        });
    }
}

module.exports = {
    listPort,
    changePort,
    openGate
}