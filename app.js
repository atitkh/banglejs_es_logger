// Elasticsearch URL without credentials in the URL
const ELASTICSEARCH_URL = "https://es.eac-services.host.ualr.edu/banglejs_data/_doc";

// Your Elasticsearch credentials
const USERNAME = "";
const PASSWORD = "";

let dataBuffer = "";

async function sendToElasticsearch(hrmData = {}, gpsData = {}) {
    try {
        const combinedData = {
            timestamp: new Date().toISOString(),
            hrm: hrmData,  // Heart rate data
            gps: gpsData   // GPS data
        };

        // Send the combined data to Elasticsearch
        let response = await fetch(ELASTICSEARCH_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Basic " + btoa(`${USERNAME}:${PASSWORD}`)  // Basic Authentication
            },
            body: JSON.stringify(combinedData)
        });

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
const startGPSBtn = document.getElementById("startGPS");
const stopGPSBtn = document.getElementById("stopGPS");
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

    dataBuffer += data; // Append data to buffer
    console.log("Data: " + data);
    console.log("Data Buffer: " + dataBuffer);

    let cleanData = dataBuffer.replace(/[\x1B\x5B\x4A]/g, "").trim(); // Remove ANSI escape codes
    cleanData = cleanData.replace(/=undefined/g, "").replace(/^[^\{]*/, "").replace(/[^}]*$/, "");
    cleanData = cleanData.replace(/^[^\{]*/, "").replace(/[^}]*$/, "");

    console.log("Cleaned Data: " + cleanData);

    // check databuffer ends with } and parse it
    if (cleanData.endsWith("}")) {
        try {
            let parsedData = JSON.parse(cleanData);
            logMessage("Parsed: " + JSON.stringify(parsedData));
            dataBuffer = ""; // Clear the buffer

            if (parsedData.bpm > 0) {
                sendToElasticsearch(parsedData);
            } else if (parsedData.lat && parsedData.lon) {
                sendToElasticsearch({}, parsedData);
            }
            else {
                logMessage("Invalid data received: " + JSON.stringify(parsedData));
            }
        }
        catch (error) {
            logMessage("Error parsing data: " + error);
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
startHRMBtn.addEventListener("click", () => sendCommand(`Bangle.buzz(1000);Bangle.setHRMPower(1);
Bangle.on('HRM',function(hrm) {
  console.log(hrm);
});`));
stopHRMBtn.addEventListener("click", () => sendCommand('Bangle.buzz(1000);Bangle.setHRMPower(0); Bangle.removeAllListeners("HRM");'));

// GPS Commands
startGPSBtn.addEventListener("click", () => sendCommand(`Bangle.buzz(1000);Bangle.setGPSPower(1);
Bangle.on('GPS',function(gps) {
    console.log(gps);
});`));
stopGPSBtn.addEventListener("click", () => sendCommand('Bangle.buzz(1000);Bangle.setGPSPower(0); Bangle.removeAllListeners("GPS");'));

// Vibrate Bangle.js
vibrateBtn.addEventListener("click", () => sendCommand('Bangle.buzz(1000);'));

// Attach event listener to Connect button
connectBtn.addEventListener("click", connectToBangle);
