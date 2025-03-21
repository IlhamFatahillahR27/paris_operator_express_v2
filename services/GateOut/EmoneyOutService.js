const LRCParser = require('./LRCParser');
const { SerialPort } = require("serialport");

const { getConfigValue } = require("../../config/config");
const { writeLog } = require("../../utils/helpers");
const { stopLoop } = require("./variable");

let serialPort = null;
let reconnectSerialTimeout = null;

async function initializeSerialPort() {
    const nodeSerialPort = getConfigValue("PortEmoneyOut");
    const nodeBaudRate = getConfigValue("BaudRateEmoneyOut");

    cleanupSerialPort();

    serialPort = new SerialPort({
        path: nodeSerialPort,
        baudRate: nodeBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
    });

    serialPort.open(() => {
        writeLog("####################################");
        writeLog("[GATE KELUAR | E-Money] Serial Port E-Money Opened");
    });
    
    serialPort.on("error", function (err) {
        writeLog("[GATE KELUAR | E-Money] Serial Port E-Money Error:" + err.message);
        reconnectSerial();
    });

    serialPort.on('disconnect', function () {
        writeLog("[GATE KELUAR | E-Money] Serial Port E-Money Disconnected");
        reconnectSerial();
    });

    const parser = new LRCParser();
    serialPort.pipe(parser);

    const init = await firstConnect();
    if (init) {
        buzzerSuccess();
    }
}

function reconnectSerial() {
    // Prevent multiple reconnection attempts
    if (reconnectSerialTimeout) {
        return;
    }

    reconnectSerialTimeout = setTimeout(() => {
        writeLog("[GATE KELUAR | E-Money] Attempting to reconnect serial port E-Money...");
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

        // Close port jika masih terbuka
        if (serialPort.isOpen) {
            serialPort.close((err) => {
                if (err) {
                    writeLog('[GATE KELUAR | E-Money] Error closing port E-Money : ' + err.message);
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

/** END OF INITIALITATION SERIAL PORT */

/** START OF COMMAND COLLECTION */
async function firstConnect() {
    return await sendCommand(
        [0xef, 0x01, 0x01],
        [
            0x75, 0x8f, 0x40, 0xd4, 0x6d, 0x95, 0xd1, 0x64, 0x14, 0x48, 0xaa, 0x19,
            0xb9, 0x28, 0x2c, 0x05,
        ],
    );
}

async function buzzerSuccess() {
    return await sendCommand([0xef, 0x01, 0x09], [0x02, 0x00]);
}

async function buzzerError() {
    return await sendCommand([0xef, 0x01, 0x09], [0x02, 0x12]);
}

async function enableBuzzer() {
    return await sendCommand([0xef, 0x01, 0x09], [0x02, 0x10]);
}

async function disableBuzzer() {
    return await sendCommand([0xef, 0x01, 0x09], [0x02, 0x11]);
}

async function getLastTransaction() {
    return await sendCommand([0xef, 0x01, 0x05]);
}

async function deductTransaction(created_date, created_time, amount, timeout) {
    const dateBuffer = dateToBCD(created_date);
    const timeBuffer = timeToBCD(created_time);
    const amountBuffer = amountToHex(amount);
    const timeoutBuffer = timeoutToBCD(timeout);

    const params = Buffer.concat([
        dateBuffer,
        timeBuffer,
        amountBuffer,
        timeoutBuffer,
    ]);

    return await sendCommand([0xef, 0x01, 0x03], Array.from(params));
}

async function cancelDeductTransaction() {
    return await sendCommand([0xef, 0x01, 0x04]);
}

async function getCardInfo() {
    return await sendCommand([0xef, 0x01, 0x0A]);
}

async function getCardBalance(date, time, timeout) {
    const dateBuffer = dateToBCD(date);
    const timeBuffer = timeToBCD(time);
    const timeoutBuffer = timeoutToBCD(timeout);

    const params = Buffer.concat([
        dateBuffer,
        timeBuffer,
        timeoutBuffer,
    ]);

    return await sendCommand([0xef, 0x01, 0x02], Array.from(params));
}

async function getMifareInfo(timeout) {
    const timeoutBuffer = timeoutToBCD(timeout);

    const params = Buffer.concat([
        Buffer.from([0x00]),
        timeoutBuffer,
    ]);

    return await sendCommand([0xef, 0x01, 0x07], Array.from(params));
}
/** END OF COMMAND COLLECTION */

function sendCommand(command, data = []) {
    return new Promise((resolve, reject) => {
        const length = command.length + data.length;
        const len_h = (length >> 8) & 0xff;
        const len_l = length & 0xff;

        let frame = [0x02, len_h, len_l, ...command, ...data];
        const lrc = calculateLRC(frame.slice(1));
        frame.push(lrc);

        serialPort.write(Buffer.from(frame), (err) => {
            if (err) {
                writeLog('[GATE KELUAR | E-Money] Error on write command: ' + err.message);
                console.log("Error on write: ", err.message);
            } else {
                console.log("Message written (HEX):", Buffer.from(frame).toString("hex"));
            }
        });

        parser.removeAllListeners("data");
        parser.removeAllListeners("error");

        parser.once("data", (data) => {
            console.log("Response received (HEX):", data.toString("hex"));
            resolve(data.toString("hex"));
        });

        parser.once("error", function (err) {
            writeLog('[GATE KELUAR | E-Money] Parser Error: ' + err.message);
            console.log("Parser Error: ", err.message);
            reject(err);
        });

    });
}

function handleLoopDetected() {
    let counter = 0;
    let condition = false;

    do {
        condition = processLoopEvent();
        
        if (stopLoop) {
            break;
        }

        counter++;

        if (counter > 5) {
            condition = true;
        }
    } while (!condition);
}

async function processLoopEvent() {
    let complete = false;

    disableBuzzer();
    
    const data = await getLastTransaction();
}

module.exports = {
    initializeSerialPort,
    buzzerSuccess,
    buzzerError,
    enableBuzzer,
    disableBuzzer,
    getLastTransaction,
    deductTransaction,
    cancelDeductTransaction,
    getCardInfo,
    getCardBalance,
    getMifareInfo,
    handleLoopDetected
};