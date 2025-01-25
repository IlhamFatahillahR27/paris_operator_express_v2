const serialPortService = require('../services/serialPortService');
const config = require('../config/config');
const helpers = require('../utils/helpers');

const listPort = async (req, res) => {
    try {
        const data = await serialPortService.listPorts();
        helpers.writeLog('Successfully listed ports');
        res.status(200).json({
            success: true,
            ports: data,
            message: 'Successfully listed ports',
            error: null
        });
    } catch (error) {
        helpers.writeLog(`Failed to list ports. Error : ${error.message}`);
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
        config.setConfigValue('nodeSerialPort', portName);
        const newConfig = config.getConfigValue('nodeSerialPort');

        if (newConfig != portName) {
            throw new Error('Failed to change port');
        }

        helpers.writeLog(`Port changed to ${portName}`);
        serialPortService.initializeSerialPort();

        res.status(200).json({
            success: true,
            message: `Successfully changed port to ${portName}`,
            error: null
        });
    } catch (error) {
        helpers.writeLog(`Failed to change port to ${portName}. Error : ${error.message}`);
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

        const data = await serialPortService.sendCommand(message);

        if (!data) {
            throw new Error('Failed to open gate');
        }

        helpers.writeLog('Successfully opened gate. Response : ' + data);
        res.status(200).json({
            success: true,
            message: 'Successfully opened gate',
            error: null
        });
    } catch (error) {
        helpers.writeLog('Failed to open gate. Error : ' + error.message);
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