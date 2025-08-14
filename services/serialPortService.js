const { SerialPort } = require("serialport");
const { DelimiterParser } = require("@serialport/parser-delimiter");

const { loopEvent } = require("../services/parisServerService");
const { writeLog } = require("../utils/helpers");
const { getConfigValue } = require("../config/config");

require('dotenv').config();
const net = require('net');

let serialPort = null;
let reconnectSerialTimeout = null;
let parser = null;

let pendingCommand = null;
let incomingCommand = null;

const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY || '3000', 10);
const TEST_COMMAND = process.env.TEST_COMMAND || ':TEST;';
const LOOP_DETECTED_COMMAND = process.env.LOOP_DETECTED_COMMAND || ':IN1ON;';
const LOOP_UNDETECTED_COMMAND = process.env.LOOP_UNDETECTED_COMMAND || ':IN1OFF;';

async function initializeSerialPort() {
    await cleanupSerialPort();

    const nodeSerialPort = getConfigValue("nodeSerialPort");
    const nodeBaudRate = getConfigValue("baudRate");

    // Pastikan path port ada sebelum mencoba terhubung
    if (!nodeSerialPort) {
        writeLog("Serial port path is not configured. Aborting initialization.");
        reconnectSerial();
        return;
    }

    parser = new DelimiterParser({ delimiter: ";" });

    serialPort = new SerialPort({
        path: nodeSerialPort,
        baudRate: nodeBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
    });

    serialPort.pipe(parser);

    // ## LISTENER PERMANEN ##
    // Listener ini akan menangani SEMUA data yang masuk dari parser
    parser.on('data', (data) => {
        const receivedData = data.toString();
        
        // Cek apakah ada command yang sedang menunggu respons
        if (pendingCommand && typeof pendingCommand.resolve === 'function') {
            writeLog(`Response for command received: ${receivedData}`);
            clearTimeout(pendingCommand.timeoutId); // Batalkan timeout
            pendingCommand.resolve(data); // Penuhi promise dari sendCommand
            pendingCommand = null; // Kosongkan, karena sudah selesai
        } else {
            // Jika tidak ada command yang menunggu, ini adalah unsolicited data
            writeLog(`Unsolicited data received: ${receivedData}`);
            processIncomingEvent(receivedData);
        }
    });

    serialPort.on("open", function () {
        writeLog("####################################");
        writeLog(`Serial Port ${nodeSerialPort} Opened at ${nodeBaudRate} bps`);
        // Reset reconnect timeout on successful open
        if (reconnectSerialTimeout) {
            clearTimeout(reconnectSerialTimeout);
            reconnectSerialTimeout = null;
        }

        // Kirim test command setelah port benar-benar terbuka
        sendCommand(TEST_COMMAND)
            .then((response) => {
                writeLog("Test Command Response: ", response.toString());
            })
            .catch((error) => {
                writeLog("Error sending test command: ", error.message);
            });
    });

    serialPort.on("error", function (err) {
        writeLog(`Serial Port Error: ${err.message}`);
        if (pendingCommand && typeof pendingCommand.reject === 'function') {
            clearTimeout(pendingCommand.timeoutId);
            pendingCommand.reject(err);
            pendingCommand = null;
        }
        if (!serialPort.isOpen) {
            reconnectSerial();
        }
    });

    serialPort.on('close', function () {
        writeLog("Serial Port Closed/Disconnected.");
        if (pendingCommand && typeof pendingCommand.reject === 'function') {
            clearTimeout(pendingCommand.timeoutId);
            pendingCommand.reject(new Error('Serial port closed during command execution.'));
            pendingCommand = null;
        }
        reconnectSerial();
    });
}

function processIncomingEvent(data) {
    // Hilangkan ":" di awal dan ";" di akhir
    const cleanedData = data.replace(/^:/, "").replace(/;$/, "");
    const loopConnecteCommand = LOOP_DETECTED_COMMAND.replace(/^:/, "").replace(/;$/, "");
    const loopDisconnectCommand = LOOP_UNDETECTED_COMMAND.replace(/^:/, "").replace(/;$/, "");

    if (cleanedData !== loopConnecteCommand || cleanedData !== loopDisconnectCommand) {
        return;
    }

    if (incomingCommand !== loopConnecteCommand) {
        incomingCommand = cleanedData;

        if (cleanedData === loopConnecteCommand) {
            // Send command to Server API
            loopEvent("connect")
            return;
        }

        // Send command to Server API
        loopEvent("disconnect");
        incomingCommand = null;
        return;
    }
}

function cleanupSerialPort() {
    return new Promise((resolve) => {
        // Clear timeout reconnect jika ada
        if (reconnectSerialTimeout) {
            clearTimeout(reconnectSerialTimeout);
            reconnectSerialTimeout = null;
        }

        if (serialPort) {
            if (parser) {
                parser.removeAllListeners('data');
            }

            // Hapus semua event listeners dari serialPort
            serialPort.removeAllListeners();
    
            // Close port jika masih terbuka dan tunggu sampai benar-benar tertutup
            if (serialPort.isOpen) {
                serialPort.close((err) => {
                    if (err) {
                        writeLog('Error closing port: ', err.message);
                    } else {
                        writeLog('Serial Port closed successfully.');
                    }
                    serialPort = null;
                    resolve();
                });
            } else {
                serialPort = null;
                resolve();
            }
        } else {
            resolve();
        }
    });
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

async function listPorts() {
    const ports = await SerialPort.list();
    const portNames = ports.map((port) => port.path);
    return portNames;
}

function sendCommand(command) {
    return new Promise((resolve, reject) => {
        if (!serialPort || !serialPort.isOpen) {
            return reject(new Error('Serial port is not open or initialized'));
        }

        if (pendingCommand) {
            return reject(new Error('Another command is already in progress.'));
        }

        // Daftarkan promise ini untuk ditangani oleh listener permanen
        pendingCommand = {
            resolve: resolve,
            reject: reject,
            timeoutId: setTimeout(() => {
                if (pendingCommand) {
                    pendingCommand.reject(new Error(`Command timeout: ${command}`));
                    pendingCommand = null; // Hapus referensi agar tidak bocor
                }
            }, 5000) // 5 detik timeout
        };

        // Tulis command ke port
        serialPort.write(command, 'utf8', (err) => {
            if (err) {
                clearTimeout(pendingCommand.timeoutId);
                pendingCommand.reject(err); // Tolak promise jika ada error saat menulis
                pendingCommand = null;
            } else {
                writeLog(`Command sent: ${command}`);
            }
        });
    });
}

module.exports = {
    initializeSerialPort,
    sendCommand,
    listPorts
};
