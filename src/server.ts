import express, { Request, Response } from 'express';
import { Fabric } from '@spacesprotocol/fabric';
import { AnchorStore } from '@spacesprotocol/fabric/dist/anchor';
import dns from 'dns-packet';
import { Buffer } from 'buffer';

const app = express();
const port = 3000;

// Create Fabric instance with anchor setup
let fabric: InstanceType<typeof Fabric>;

// Initialize Fabric
async function initFabric(): Promise<void> {
  try {
    fabric = new Fabric({
      anchor: await AnchorStore.create({
        localPath: 'data/root-anchors.json'
      })
    });
    
    await fabric.ready();
    console.log('Fabric initialized');
  } catch (error) {
    console.error('Failed to initialize Fabric:', error);
    throw error;
  }
}

// Query DNS records
async function queryDNS(space: string): Promise<dns.Packet> {
  try {
    // Use the correct API to get DNS records
    const DNS_EVENT_KIND = 871222; // DNS event kind
    const res = await fabric.eventGet(space, DNS_EVENT_KIND, '', { latest: true });
    
    if (!res || !res.event) {
      throw new Error('No records found');
    }
    
    // Decode the DNS packet from the event content
    const zone = dns.decode(res.event.binary_content ? 
      res.event.content : 
      Buffer.from(res.event.content, 'base64'));
      
    return zone;
  } catch (error) {
    console.error('Error querying DNS:', error);
    throw error;
  }
}

// Express route handler
app.get('/', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  
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
    if (records?.authorities?.length === 0) {
      res.json(records);
    } else {
      // Loop through authorities and get the A records
      var found = false;
      for (const authority of records?.authorities ?? []) {
        // Just get the first A record  
        if (authority.type === 'A') {
          const ip_addr = authority.data;
          const space_name = authority.name;
          console.log(space_name + ' is redirecting to:', 'http://'+ip_addr);
          res.writeHead(302, { 'Location': 'http://'+ip_addr });
          res.end();
          found = true;
        }
      }
      if (!found) {
        res.json(records);
      }
    }
  } catch (error) {
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 