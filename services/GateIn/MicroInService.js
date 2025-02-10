const { tcpWriteLog } = require("../../utils/helpers");

require('dotenv').config();
const net = require('net');

// Konfigurasi untuk TCP/IP connection
const TCP_HOST = process.env.TCP_SERVER_HOST || '192.168.1.1';
const TCP_PORT = parseInt(process.env.TCP_SERVER_PORT || '5023', 10);
const RECONNECT_DELAY = parseInt(process.env.RECONNECT_DELAY || '3000', 10);


let tcpClient = null;
let reconnectTimeout = null;

function connectTcpServer() {
    if (!tcpClient) {
        createTcpClient();
    }

    tcpWriteLog(`[GATE MASUK] Connecting to TCP Server at ${TCP_HOST}:${TCP_PORT}...`);

    tcpClient.connect(TCP_PORT, TCP_HOST, function () {
        tcpWriteLog('[GATE MASUK] Connected to TCP Server at ' + TCP_HOST + ':' + TCP_PORT);
        tcpClient.write(`<Action>Connected</Action>`);
    });

    tcpClient.on('data', function (data) {
        tcpWriteLog('[GATE MASUK] <<<< Data received from TCP Server : ' + data.toString() + ' <<<<');
    });
}

function createTcpClient() {
    cleanupTcpClient();

    tcpClient = new net.Socket();

    // Event handlers
    tcpClient.on('error', (err) => {
        tcpWriteLog(`[GATE MASUK] TCP Error: ${err.message}`);
        cleanupTcpClient();
        reconnectTcpServer();
    });

    tcpClient.on('close', () => {
        tcpWriteLog('[GATE MASUK] Connection closed');
        cleanupTcpClient();
        reconnectTcpServer();
    });

    tcpClient.on('end', () => {
        tcpWriteLog('[GATE MASUK] Connection ended by server');
        cleanupTcpClient();
        reconnectTcpServer();
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

function sendTcpCommand(command) {
    if (tcpClient.connecting) {
        tcpWriteLog("[GATE MASUK] TCP Client not connected to listener server");
    } else {
        command += `,${DATA_CARD_TYPE}</Emoney>`;

        tcpClient.write(command, function (err) {
            if (err) {
                tcpWriteLog('[GATE MASUK] Failed to send data to TCP Server:', err.message);
            } else {
                tcpWriteLog('[GATE MASUK] >>>> Data sent to TCP Server >>>>');
            }
        });
    }
}

module.exports = {
    connectTcpServer,
    sendTcpCommand
};