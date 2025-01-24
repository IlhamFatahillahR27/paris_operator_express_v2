const { SerialPort } = require("serialport");
const { DelimiterParser } = require("@serialport/parser-delimiter");

const { writeLog, hextodec, moneyFormat, hexreverse } = require("../utils/helpers");
const { setConfigValue, getConfigValue } = require("../config/config");

require('dotenv').config();
const net = require('net');

let serialPort = null;
let reconnectSerialTimeout = null;

let parser = null;

const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY || '3000', 10);
const TEST_COMMAND = process.env.TEST_COMMAND || ':TEST;';

async function initializeSerialPort() {
    const nodeSerialPort = getConfigValue("nodeSerialPort");
    const nodeBaudRate = getConfigValue("baudRate");

    cleanupSerialPort();

    parser = new DelimiterParser({ delimiter: ";" });

    serialPort = new SerialPort({
        path: nodeSerialPort,
        baudRate: nodeBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
    });

    serialPort.pipe(parser);

    serialPort.on("open", function () {
        writeLog("####################################");
        writeLog("Serial Port Opened");
    });

    serialPort.on("error", function (err) {
        writeLog("Serial Port Error: ", err.message);
        reconnectSerial();
    });

    // Handle unexpected disconnections
    serialPort.on('disconnect', function () {
        writeLog("Serial Port Disconnected");
        reconnectSerial();
    });

    sendCommand(TEST_COMMAND)
        .then((response) => {
            writeLog("Test Command Response: ", response);
        })
        .catch((error) => {
            writeLog("Error sending test command: ", error.message);
        });
}

function cleanupSerialPort() {
    if (serialPort) {
        // Remove semua event listeners
        serialPort.removeAllListeners('open');
        serialPort.removeAllListeners('error');
        serialPort.removeAllListeners('close');
        serialPort.removeAllListeners('data');

        if (parser) {
            parser.removeAllListeners('data');
        }

        // Close port jika masih terbuka
        if (serialPort.isOpen) {
            serialPort.close((err) => {
                if (err) {
                    writeLog('Error closing port: ', err.message);
                }
            });
        }

        serialPort = null;
    }

    // Clear timeout reconnect jika ada
    if (reconnectSerialTimeout) {
        clearTimeout(reconnectSerialTimeout);
        reconnectSerialTimeout = null;
    }
}

function reconnectSerial() {
    // Prevent multiple reconnection attempts
    if (reconnectSerialTimeout) {
        return;
    }

    reconnectSerialTimeout = setTimeout(() => {
        writeLog("Attempting to reconnect serial port...");
        initializeSerialPort();
    }, RECONNECT_DELAY);
}

function sendCommand(command) {
    return new Promise((resolve, reject) => {
        if (!serialPort) {
            reject(new Error('Serial port is not initialized'));
            return;
        }

        const responseHandler = (data) => {
            parser.removeListener('data', responseHandler);
            resolve(data);
        };

        const timeoutId = setTimeout(() => {
            parser.removeListener('data', responseHandler);
            reject(new Error('Command timeout'));
        }, 5000);

        parser.on('data', responseHandler);

        serialPort.write(command, 'utf8', (err) => {
            if (err) {
                clearTimeout(timeoutId);
                parser.removeListener('data', responseHandler);
                reject(err);
            }
        });
    });
}

module.exports = {
    initializeSerialPort,
    getSerialPort: () => serialPort
};
