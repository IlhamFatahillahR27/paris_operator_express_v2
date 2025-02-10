const { SerialPort } = require("serialport");
const { tcpWriteLog, hextodec, moneyFormat, hexreverse } = require("../../utils/helpers");
const { getConfigValue } = require("../../config/config");
const { connectTcpServer, sendTcpCommand } = require("./MicroInService");

require('dotenv').config();

let serialPort = null;
let reconnectSerialTimeout = null;

let buffer = Buffer.alloc(0);

const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY || '3000', 10);
let arrayAvailableEmoney;

const AVAILABLE_EMONEY = process.env.EMONEY_CARD_AVAILABLE || '02';

async function initializeSerialPortEmoney() {
    const serialPortEmoney = getConfigValue("PortEmoneyIn");
    const baudRateEmoney = getConfigValue("BaudRateEmoneyIn");

    cleanupSerialPort();

    serialPort = new SerialPort({
        path: serialPortEmoney,
        baudRate: baudRateEmoney,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
    });

    serialPort.on("open", function () {
        tcpWriteLog("####################################");
        tcpWriteLog("[GATE MASUK] Serial Port E-Money Opened");

        // Get available emoney into array
        arrayAvailableEmoney = AVAILABLE_EMONEY.split(',');

        // Initialize TCP/IP connection
        connectTcpServer();
    });

    serialPort.on("error", function (err) {
        tcpWriteLog("[GATE MASUK] Serial Port E-Money Error: ", err.message);
        reconnectSerial();
    });

    // Handle unexpected disconnections
    serialPort.on('disconnect', function () {
        tcpWriteLog("[GATE MASUK] Serial Port E-Money Disconnected");
        reconnectSerial();
    });

    serialPort.on('data', function (data) {
        buffer = Buffer.concat([buffer, data]);

        // Check if buffer has enough data to process
        while (buffer.length > 3) {
            // Check for STX (0x02)
            if (buffer[0] !== 0x02) {
                // Remove invalid data from the start
                buffer = buffer.slice(1);
                continue;
            }

            // Extract LEN-H and LEN-L
            const lenH = buffer[1];
            const lenL = buffer[2];
            const dataLength = (lenH << 8) | lenL; // Combine high and low bytes to get total length of data

            // Calculate total frame size: STX(1) + LEN-H(1) + LEN-L(1) + Data[n] + LRC(1)
            const frameSize = 1 + 1 + 1 + dataLength + 1;

            // Check if the buffer contains a complete frame
            if (buffer.length < frameSize) {
                // Wait for more data
                break;
            }

            // Extract the frame
            const frame = buffer.slice(0, frameSize);

            // Verify LRC
            const lrc = frame[frameSize - 1]; // Last byte is LRC
            let calculatedLRC = 0;

            // Calculate LRC from LEN-H to Data[n]
            for (let i = 1; i < frameSize - 1; i++) {
                calculatedLRC ^= frame[i];
            }

            if (calculatedLRC === lrc) {
                // Frame is valid; convert to hex and log it
                const hexFrame = frame.toString('hex').toUpperCase();
                const ST = hexFrame.slice(0, 2);
                const LENH = hexFrame.slice(2, 4);
                const LENL = hexFrame.slice(4, 6);
                const DATA = hexFrame.slice(6, -2);
                const LRC = hexFrame.slice(-2);

                const DATA_CARD_TYPE = DATA.slice(0, 2);
                const DATA_CARD_UID = DATA.slice(2, 16);
                const DATA_CARD_VALIDITY_FLAG = DATA.slice(16, 18);
                const DATA_CARD_NUMBER = DATA.slice(18, 34);
                const DATA_CARD_BALANCE = DATA.slice(-8);

                tcpWriteLog("====================================");
                // tcpWriteLog("STX: " + STX);
                // tcpWriteLog("LEN-H: " + LENH);
                // tcpWriteLog("LEN-L: " + LENL);
                // tcpWriteLog("DATA: " + DATA);
                // tcpWriteLog("LRC: " + LRC);
                tcpWriteLog("[GATE MASUK] CARD TYPE: " + DATA_CARD_TYPE);
                tcpWriteLog("[GATE MASUK] CARD UID: " + DATA_CARD_UID);
                tcpWriteLog("[GATE MASUK] VALIDITY FLAG: " + DATA_CARD_VALIDITY_FLAG);
                tcpWriteLog("[GATE MASUK] CARD NUMBER: " + DATA_CARD_NUMBER);
                tcpWriteLog("[GATE MASUK] BALANCE: " + moneyFormat(hextodec(DATA_CARD_BALANCE)));

                let command = '';

                if (arrayAvailableEmoney.includes(DATA_CARD_TYPE)) {
                    command += `<Emoney>${DATA_CARD_NUMBER}`;
                } else {
                    let cardFormatted = DATA_CARD_NUMBER;

                    if (DATA_CARD_TYPE === "FF" && !DATA_CARD_UID.startsWith('000000')) {
                        cardFormatted = (hextodec(hexreverse(DATA_CARD_UID)) + '').padStart(10, '0')
                    }

                    command += `<Emoney>${cardFormatted}`;
                }

                command += `,${DATA_CARD_TYPE}</Emoney>`;

                sendTcpCommand(command);

            } else {
                console.error('Invalid LRC:', { frame, calculatedLRC, lrc });
            }

            // Remove the processed frame from the buffer
            buffer = buffer.slice(frameSize);
        }
    })
}

function reconnectSerial() {
    // Prevent multiple reconnection attempts
    if (reconnectSerialTimeout) {
        return;
    }

    reconnectSerialTimeout = setTimeout(() => {
        tcpWriteLog("[GATE MASUK] Attempting to reconnect serial port E-Money...");
        initializeSerialPortEmoney();
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
                    tcpWriteLog('[GATE MASUK] Error closing port E-Money : ' + err.message);
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

module.exports = {
    initializeSerialPortEmoney
};