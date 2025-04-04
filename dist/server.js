"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fabric_1 = require("@spacesprotocol/fabric");
const anchor_1 = require("@spacesprotocol/fabric/dist/anchor");
const dns_packet_1 = __importDefault(require("dns-packet"));
const buffer_1 = require("buffer");
const app = (0, express_1.default)();
const port = 3000;
// Create Fabric instance with anchor setup
let fabric;
// Initialize Fabric
async function initFabric() {
    try {
        fabric = new fabric_1.Fabric({
            anchor: await anchor_1.AnchorStore.create({
                localPath: 'data/root-anchors.json'
            })
        });
        await fabric.ready();
        console.log('Fabric initialized');
    }
    catch (error) {
        console.error('Failed to initialize Fabric:', error);
        throw error;
    }
}
// Query DNS records
async function queryDNS(space) {
    try {
        // Use the correct API to get DNS records
        const DNS_EVENT_KIND = 871222; // DNS event kind
        const res = await fabric.eventGet(space, DNS_EVENT_KIND, '', { latest: true });
        if (!res || !res.event) {
            throw new Error('No records found');
        }
        // Decode the DNS packet from the event content
        const zone = dns_packet_1.default.decode(res.event.binary_content ?
            res.event.content :
            buffer_1.Buffer.from(res.event.content, 'base64'));
        return zone;
    }
    catch (error) {
        console.error('Error querying DNS:', error);
        throw error;
    }
}
// Express route handler
app.get('/', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spaces Query Error</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1 { color: #e74c3c; }
            .error { 
              background-color: #f8d7da;
              border: 1px solid #f5c6cb;
              color: #721c24;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            .example {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <h1>Spaces Query Error</h1>
          <div class="error">
            <p>Query parameter "q" is required</p>
          </div>
          <div class="example">
            <h2>Example Usage:</h2>
            <p>Try querying a space by adding the "q" parameter:</p>
            <p><code>http://127.0.0.1:${port}/?q=@example</code></p>
          </div>
        </body>
      </html>
    `);
    }
    try {
        const records = await queryDNS(query);
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
});
// Start server
async function startServer() {
    try {
        await initFabric();
        app.listen(port, () => {
            console.log(`Server running at http://127.0.0.1:${port}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
