const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "default.json");

// Fungsi untuk memuat konfigurasi
function loadConfig() {
    const data = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(data);
}

// Fungsi untuk menulis ulang (rewrite) konfigurasi
function updateConfig(newConfig) {
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
}

// Mengambil konfigurasi spesifik, misalnya serialPort
function getConfigValue(key) {
    const config = loadConfig();
    return config[key];
}

// Mengubah konfigurasi spesifik, lalu menyimpan
function setConfigValue(key, value) {
    const config = loadConfig();
    config[key] = value;
    updateConfig(config);
    return getConfigValue(key);
}

module.exports = {
    loadConfig,
    getConfigValue,
    setConfigValue,
};
