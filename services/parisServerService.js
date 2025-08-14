const { writeLog } = require("../utils/helpers");

require('dotenv').config();

const apiUrl = process.env.SERVER_API_URL || 'http://127.0.0.1/api/v1/emoney/';

async function loopEvent(event) {
    try {
        const url = apiUrl + 'loop?event=' + event;
        console.log(url);
        const response = await fetch(apiUrl + 'loop?event=' + event);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        writeLog(`Error looping event: ${error.message}`);
        return { success: false, error: error.message };
    }
}

module.exports = { loopEvent };