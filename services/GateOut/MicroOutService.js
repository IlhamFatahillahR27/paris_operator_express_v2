const { SerialPort } = require("serialport");
const { DelimiterParser } = require("@serialport/parser-delimiter");

const EmoneyOutService = require("./EmoneyOutService");
const { writeLog } = require("../../utils/helpers");
const { getConfigValue } = require("../../config/config");
const { stopLoop } = require("./variable");

require('dotenv').config();

let serialPort = null;
let reconnectSerialTimeout = null;

let parser = null;

const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY || '3000', 10);
const TEST_COMMAND = process.env.TEST_COMMAND || ':TEST;';
const EMONEY_ACTIVE = process.env.EMONEY_GATE_OUT || false;

async function initializeSerialPort() {
    const serialPortMicro = getConfigValue("PortMicroOut");
    const baudRateMicro = getConfigValue("BaudRateMicroOut");

    cleanupSerialPort();

    parser = new DelimiterParser({ delimiter: ";" });

    serialPort = new SerialPort({
        path: serialPortMicro,
        baudRate: baudRateMicro,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
    });

    serialPort.pipe(parser);

    serialPort.on("open", function () {
        writeLog("####################################");
        writeLog("[GATE KELUAR] Serial Port Opened");

        if (EMONEY_ACTIVE) {
            EmoneyOutService.initializeSerialPort();
        }
    });

    serialPort.on("error", function (err) {
        writeLog("[GATE KELUAR] Serial Port Error: ", err.message);
        reconnectSerial();
    });

    // Handle unexpected disconnections
    serialPort.on('disconnect', function () {
        writeLog("[GATE KELUAR] Serial Port Disconnected");
        reconnectSerial();
    });

    if (EMONEY_ACTIVE) {
        parser.on("data", function (data) {
            const message = data.toString().trim();
            writeLog("[GATE KELUAR] Received Data: " + message);
    
            if (message === "IN1ON") {
                stopLoop = false;
                EmoneyOutService.handleLoopDetected();
            } else if (message === "OUT1ON") {
                stopLoop = true;
            }
        });
    }

    sendCommand(TEST_COMMAND)
        .then((response) => {
            writeLog("[GATE KELUAR] Test Command Response: " + response);
        })
        .catch((error) => {
            writeLog("[GATE KELUAR] Error sending test command: " + error.message);
        });
}

function reconnectSerial() {
    // Prevent multiple reconnection attempts
    if (reconnectSerialTimeout) {
        return;
    }

    reconnectSerialTimeout = setTimeout(() => {
        writeLog("[GATE KELUAR] Attempting to reconnect serial port...");
        initializeSerialPort();
    }, RECONNECT_DELAY);
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
                    writeLog('[GATE KELUAR] Error closing port: ', err.message);
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

async function listPorts() {
    const ports = await SerialPort.list();
    const portNames = ports.map((port) => port.path);
    return portNames;
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
    sendCommand,
    listPorts
};
