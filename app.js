// Elasticsearch URL without credentials in the URL
const ELASTICSEARCH_URL = "https://es.eac-services.host.ualr.edu/banglejs_data/_doc";

// Your Elasticsearch credentials
const USERNAME = "";
const PASSWORD = "";

// Function to send data to Elasticsearch
async function sendToElasticsearch(data) {
    try {
        // Encode the username and password in Base64 for Basic Auth
        const auth = "Basic " + btoa(`${USERNAME}:${PASSWORD}`);

        let response = await fetch(ELASTICSEARCH_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": auth  // Add authorization header
            },
            body: JSON.stringify(data)
        });

        // Handle response
        let result = await response.json();
        logMessage("Data sent to Elasticsearch: " + JSON.stringify(result));
    } catch (error) {
        logMessage("Error sending data: " + error);
    }
}

// Function to log messages
function logMessage(message) {
    logDiv.innerHTML += `<p>${message}</p>`;
    console.log(message);
}

const connectBtn = document.getElementById("connectBtn");
const startHRMBtn = document.getElementById("startHRM");
const stopHRMBtn = document.getElementById("stopHRM");
const vibrateBtn = document.getElementById("vibrate");

const logDiv = document.getElementById("log");

let device, server, uartService, txCharacteristic, rxCharacteristic;

// Function to log messages in the browser
function logMessage(message) {
    logDiv.innerHTML += `<p>${message}</p>`;
    console.log(message);
}

// Connect to Bangle.js via Bluetooth
async function connectToBangle() {
    try {
        logMessage("Requesting Bluetooth device...");
        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] // Nordic UART Service UUID
        });

        logMessage("Connecting to device...");
        server = await device.gatt.connect();

        logMessage("Getting UART Service...");
        uartService = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');

        logMessage("Getting TX Characteristic...");
        txCharacteristic = await uartService.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e'); // Write

        logMessage("Getting RX Characteristic...");
        rxCharacteristic = await uartService.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e'); // Notify

        logMessage("Connected! Enabling notifications...");
        await rxCharacteristic.startNotifications();
        rxCharacteristic.addEventListener('characteristicvaluechanged', handleData);

        logMessage("You can now send commands to Bangle.js.");
    } catch (error) {
        logMessage("Error: " + error);
    }
}

// Handle incoming data from Bangle.js
function handleData(event) {
    let decoder = new TextDecoder("utf-8");
    let data = decoder.decode(event.target.value);

    if (data.includes("bpm") && data.includes("confidence")) {
        let cleanData = data.replace(/[\x1B\x5B\x4A]/g, "").trim(); // Remove ANSI escape codes
        cleanData = cleanData.replace(/^[^\{]*/, "").replace(/[^}]*$/, "");

        logMessage("Cleaned: " + cleanData);

        try {
            let hrData = JSON.parse(cleanData);
            logMessage("Heart Rate: " + hrData.bpm + " bpm");

            if (hrData.bpm > 0) {
                hrData.timestamp = new Date().toISOString();
                sendToElasticsearch(hrData);
            }
        } catch (err) {
            logMessage("Error parsing HRM data: " + err);
        }
    }

    logMessage("Received: " + data);
}


// Function to send commands to Bangle.js
async function sendCommand(command) {
    if (!txCharacteristic) return;
    let encoder = new TextEncoder();
    let data = encoder.encode(command + "\n");
    await txCharacteristic.writeValue(data);
}

// Heart Rate Monitoring Commands
startHRMBtn.addEventListener("click", () => sendCommand(`Bangle.setHRMPower(1);
Bangle.on('HRM',function(hrm) {
  console.log(hrm);
});`));
stopHRMBtn.addEventListener("click", () => sendCommand('Bangle.setHRMPower(0); Bangle.removeAllListeners("HRM");'));

// Vibrate Bangle.js
vibrateBtn.addEventListener("click", () => sendCommand('Bangle.buzz(1000);'));

// Attach event listener to Connect button
connectBtn.addEventListener("click", connectToBangle);
