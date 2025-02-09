const connectBtn = document.getElementById("connectBtn");
const logDiv = document.getElementById("log");

let device, server, gattService, heartRateChar;

// Elasticsearch API Endpoint
const ELASTICSEARCH_URL = "https://es.eac-services.host.ualr.edu/banglejs_data/_doc";

// Function to log messages
function logMessage(message) {
    logDiv.innerHTML += `<p>${message}</p>`;
    console.log(message);
}

// Function to send data to Elasticsearch
async function sendToElasticsearch(data) {
    try {
        let response = await fetch(ELASTICSEARCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        let result = await response.json();
        logMessage("Data sent to Elasticsearch: " + JSON.stringify(result));
    } catch (error) {
        logMessage("Error sending data: " + error);
    }
}

// Connect to Bangle.js 2
async function connectToBangle() {
    try {
        logMessage("Requesting Bluetooth device...");
        device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['heart_rate']
        });

        logMessage("Connecting to device...");
        server = await device.gatt.connect();

        logMessage("Getting Heart Rate Service...");
        gattService = await server.getPrimaryService('heart_rate');

        logMessage("Getting Heart Rate Characteristic...");
        heartRateChar = await gattService.getCharacteristic('heart_rate_measurement');

        logMessage("Connected! Listening for heart rate data...");

        // Start Notifications
        heartRateChar.addEventListener('characteristicvaluechanged', async (event) => {
            let value = event.target.value;
            let heartRate = value.getUint8(1); // Extract heart rate value
            let timestamp = new Date().toISOString();

            let data = { timestamp, heartRate, device: "Bangle.js 2" };
            logMessage(`Heart Rate: ${heartRate} BPM`);

            // Send to Elasticsearch
            sendToElasticsearch(data);
        });

        await heartRateChar.startNotifications();
    } catch (error) {
        logMessage("Error: " + error);
    }
}

// Attach event listener to the button
connectBtn.addEventListener("click", connectToBangle);
