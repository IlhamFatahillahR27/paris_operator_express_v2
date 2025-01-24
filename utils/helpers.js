const path = require("path");
const fs = require("fs");

function hexreverse(hex) {
  /**
   * 1. Gabungkan tiap 2 digit hex menjadi array
   * 2. Balikkan urutan array tersebut
   * 3. Gabungkan kembali menjadi string hex
   * 4. Potong 6 digit terakhir (CRC)
   */

  const bytes = hex.match(/.{2}/g);
  const reversedBytes = bytes.reverse();
  const reversedHex = reversedBytes.join("");
  return reversedHex.slice(0, reversedHex.length - 6);
}

function hextodec(hex) {
  return parseInt(hex, 16);
}

function moneyFormat(money) {
  return "Rp " + money.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function writeLog(message) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    const LOG_FILE = path.join(__dirname, "../logs/express_" + formattedDate + ".log");
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}\n`;
    fs.appendFileSync(LOG_FILE, logMessage);
}

module.exports = {
  writeLog,
  hextodec,
  moneyFormat,
  hexreverse
};
