import express, { Request, Response } from 'express';
import { Fabric } from '@spacesprotocol/fabric';
import { AnchorStore } from '@spacesprotocol/fabric/dist/anchor';
import dns from 'dns-packet';
import { Buffer } from 'buffer';

// Global variables
let globalExternalAddress: string | null = null;

const app = express();
// const host = '127.0.0.1';
// const host = '192.168.1.69';
// export SPACES_SEP_HOST='192.168.1.87'
// export SPACES_SEP_PORT='3000'
const host = process.env.SPACES_SEP_HOST ? process.env.SPACES_SEP_HOST : '127.0.0.1';
const port = process.env.SPACES_SEP_PORT ? parseInt(process.env.SPACES_SEP_PORT, 10) : 3000;

// Log environment variable status
if (!process.env.SPACES_SEP_HOST) {
  console.warn('WARNING: SPACES_SEP_HOST environment variable not set. Using default: 127.0.0.1');
}
if (!process.env.SPACES_SEP_PORT) {
  console.warn('WARNING: SPACES_SEP_PORT environment variable not set. Using default: 3000');
}

// Create Fabric instance with anchor setup
let fabric: InstanceType<typeof Fabric>;

// Initialize Fabric
async function initFabric(): Promise<void> {
  try {
    fabric = new Fabric({
      anchor: await AnchorStore.create({
        // localPath: 'data/root-anchors.json',
        remoteUrls: ['http://70.251.209.207:7225/root-anchors.json']
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
async function queryDNS(space: string): Promise<dns.Packet | null> {
  try {
    // Use the correct API to get DNS records
    const DNS_EVENT_KIND = 871222; // DNS event kind
    const res = await fabric.eventGet(space, DNS_EVENT_KIND, '', { latest: true });
    
    if (!res || !res.event) {
      // throw new Error('No records found');
      console.log("No records found for " + space);
      return null;
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
    // Create a fallback URL in case globalExternalAddress is not available
    const exampleUrl = globalExternalAddress 
      ? `http://${globalExternalAddress}/?q=@space`
      : `http://${host}:${port}/?q=@space`;
      
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spaces Search Engine Proxy</title>
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
          <h1>Spaces Search Engine Proxy</h1>
          <div class="error">
            <p>Query parameter "q" is required</p>
          </div>
          <div class="example">
            <h2>Example Usage:</h2>
            <p>Try querying a space by adding the "q" parameter:</p>
            <p><a href="${exampleUrl}">${exampleUrl}</a></p>
          </div>
        </body>
      </html>
    `);
  }

  try {
    const records = await queryDNS(query);
    
    if (!records) {
      console.log(query + " : No records found.");
      return res.status(404).json({ error: `No records found for ${query}` });
    }
    
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
          if (!found) { 
            res.writeHead(302, { 'Location': 'http://'+ip_addr });
            res.end();
            found = true;
          }
        }
        if (authority.type === 'TXT') {
          const data_arr = authority.data;
          // const data_arr = [
          //   {
          //     "type": "Buffer",
          //     "data": [58, 112, 97, 116, 104, 58, 55, 48, 46, 50, 53, 49, 46, 50, 48, 57, 46, 50, 48, 55, 47, 108, 117, 110, 100, 101, 47]
          //   }
          // ]
              
          const space_name = authority.name;
          for (const data_elem of data_arr ?? []) {
            // Check if the element is a Buffer
            if (Buffer.isBuffer(data_elem)) {
                const buffer = data_elem; // It's already a Buffer
                const txt_str = buffer.toString('utf8');
                console.log(space_name + ' txt (Buffer): ' + txt_str);
                if (txt_str.startsWith(':path:')) {
                  const path_str = txt_str.substring(6);
                  if (!found) {
                    res.writeHead(302, { 'Location': 'http://'+path_str });
                    res.end();
                    found = true;
                  }
                }
                else if (txt_str.startsWith(':pkar:')) {
                  const path_str = txt_str.substring(6);
                  if (!found) {
                    res.writeHead(302, { 'Location': 'http://'+path_str+'./' });
                    res.end();
                    found = true;
                  }
                }
                else {
                  console.log('No path or pkar found in TXT: ' + txt_str );
                }
            } else if (typeof data_elem === 'string') {
                // Handle if it's already a string
                const txt_str = data_elem;
                console.log(space_name + ' txt (string):' + txt_str);
            } else {
                // Handle other unexpected types if necessary
                console.log(space_name + ' txt (unknown type):', data_elem);
            }
          }
          // console.log(space_name + ' txt:' + txt_str); // txt_str is only available inside the loop/if block
          // res.writeHead(302, { 'Location': 'http://'+ip_addr });
          // res.end();
          // found_txt = true;
        }
      }
      if (!found) {
        console.log(query + " : No A or TXT:path: or TXT:pkar: record found.");
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

    console.log("Starting IP address lookup...");
    var ip = require('whatismyip');
    // console.log("whatismyip module loaded:", ip);
    
    var options = {
      url: 'http://checkip.dyndns.org/',
      truncate: '',
      timeout: 60000,
      matchIndex: 0
    };
    // console.log("Using options:", options);

    ip.whatismyip(options, function(err: Error | null, data: string){
      console.log("whatismyip callback received");
      if (err === null) {
        // console.log("Raw data received:", data);
        try {
          // Check if data is already an object
          let parsedData;
          if (typeof data === 'string') {
            parsedData = JSON.parse(data);
          } else {
            parsedData = data;
          }
          
          // console.log("Parsed data:", parsedData);
          
          // Extract IP address based on the structure
          let ipAddress;
          if (parsedData.ip) {
            ipAddress = parsedData.ip;
          } else if (typeof parsedData === 'string' && parsedData.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
            ipAddress = parsedData;
          } else {
            console.log("Could not extract IP address from data");
            return;
          }
          
          // Store the IP address in the global variable
          globalExternalAddress = ipAddress;
          
          console.log("Search Engine URL: " + "http://" + ipAddress + "/?q=%s");
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
          console.log("Data that failed to parse:", data);
        }
      } else {
        console.log("Error getting IP address:", err);
      }
    });
    
    await initFabric();
    app.listen(port, () => {
      if (globalExternalAddress) {
        console.log(`Public IP address: ${globalExternalAddress}`);
      }
      console.log(`Server running at http://${host}:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 