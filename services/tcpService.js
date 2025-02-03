const { SerialPort } = require("serialport");
const { tcpWriteLog, hextodec, moneyFormat, hexreverse } = require("../utils/helpers");
const { getConfigValue } = require("../config/config");

require('dotenv').config();
const net = require('net');

let serialPort = null;
let reconnectSerialTimeout = null;

let buffer = Buffer.alloc(0);

let arrayAvailableEmoney;

// Konfigurasi untuk TCP/IP connection
const TCP_HOST = process.env.TCP_SERVER_HOST || '192.168.1.1';
const TCP_PORT = parseInt(process.env.TCP_SERVER_PORT || '5023', 10);
const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY || '3000', 10);

const AVAILABLE_EMONEY = process.env.EMONEY_CARD_AVAILABLE || '02';

let tcpClient = null;
let reconnectTimeout = null;

function cleanupTcpClient() {
    if (tcpClient) {
        // Remove semua event listeners
        tcpClient.removeAllListeners('error');
        tcpClient.removeAllListeners('connect');
        tcpClient.removeAllListeners('data');
        tcpClient.removeAllListeners('close');
        tcpClient.removeAllListeners('end');

        // Destroy socket
        tcpClient.destroy();
        tcpClient = null;
    }

    // Clear timeout yang pending
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
}

function createTcpClient() {
    // Cleanup existing connection jika ada
    cleanupTcpClient();

    tcpClient = new net.Socket();

    // Event handlers
    tcpClient.on('error', (err) => {
        tcpWriteLog(`TCP Error: ${err.message}`);
        cleanupTcpClient();
        reconnectTcpServer();
    });

    tcpClient.on('close', () => {
        tcpWriteLog('Connection closed');
        cleanupTcpClient();
        reconnectTcpServer();
    });

    tcpClient.on('end', () => {
        tcpWriteLog('Connection ended by server');
        cleanupTcpClient();
        reconnectTcpServer();
    });
}

function connectTcpServer() {
    if (!tcpClient) {
        createTcpClient();
    }

    tcpWriteLog(`Connecting to TCP Server at ${TCP_HOST}:${TCP_PORT}...`);

    tcpClient.connect(TCP_PORT, TCP_HOST, function () {
        tcpWriteLog('Connected to TCP Server at ' + TCP_HOST + ':' + TCP_PORT);
        tcpClient.write(`<Action>OK!</Action>`);
    });

    tcpClient.on('data', function (data) {
        tcpWriteLog('<<<< Data received from TCP Server : ' + data.toString() + ' <<<<');
    });
}

function reconnectTcpServer() {
    // Prevent multiple reconnection attempts
    if (reconnectTimeout) {
        return;
    }

    reconnectTimeout = setTimeout(() => {
        connectTcpServer();
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
                    tcpWriteLog('Error closing port: ', err.message);
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
        tcpWriteLog("Attempting to reconnect serial port...");
        initializeSerialPortEmoney();
    }, RECONNECT_DELAY);
}

async function initializeSerialPortEmoney() {
    const serialPortEmoney = getConfigValue("serialPortEmoney");
    const baudRateEmoney = getConfigValue("baudRateEmoney");

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
        tcpWriteLog("Serial Port E-Money Opened");

        // Get available emoney into array
        arrayAvailableEmoney = AVAILABLE_EMONEY.split(',');

        // Initialize TCP/IP connection
        connectTcpServer();
    });

    serialPort.on("error", function (err) {
        tcpWriteLog("Serial Port E-Money Error: ", err.message);
        reconnectSerial();
    });

    // Handle unexpected disconnections
    serialPort.on('disconnect', function () {
        tcpWriteLog("Serial Port E-Money Disconnected");
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
                tcpWriteLog("CARD TYPE: " + DATA_CARD_TYPE);
                tcpWriteLog("CARD UID: " + DATA_CARD_UID);
                tcpWriteLog("VALIDITY FLAG: " + DATA_CARD_VALIDITY_FLAG);
                tcpWriteLog("CARD NUMBER: " + DATA_CARD_NUMBER);
                tcpWriteLog("BALANCE: " + moneyFormat(hextodec(DATA_CARD_BALANCE)));

                // Perlu dikirim ke TCP IP-nya dengan cek terlebih dahulu apakah sudah terkoneksi atau belum
                if (tcpClient.connecting) {
                    tcpWriteLog("TCP Client not connected");
                } else {
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

                    tcpClient.write(command, function (err) {
                        if (err) {
                            tcpWriteLog('Failed to send data to TCP Server:', err.message);
                        } else {
                            tcpWriteLog('>>>> Data sent to TCP Server >>>>');
                        }
                    });
                }

            } else {
                console.error('Invalid LRC:', { frame, calculatedLRC, lrc });
            }

            // Remove the processed frame from the buffer
            buffer = buffer.slice(frameSize);
        }
    })
}

module.exports = {
    initializeSerialPortEmoney
};
