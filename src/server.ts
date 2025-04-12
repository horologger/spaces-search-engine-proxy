import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { Fabric } from '@spacesprotocol/fabric';
import { AnchorStore } from '@spacesprotocol/fabric/dist/anchor';
import dns from 'dns-packet';
import { Buffer } from 'buffer';

// Global variables
let globalExternalAddress: string | null = null;

const app = express();

// Middleware setup
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// const sep_host = '127.0.0.1';
// const sep_host = '192.168.1.69';
// export SPACES_SEP_HOST='192.168.1.87'
// export SPACES_SEP_PORT='3000'
const sep_host = process.env.SPACES_SEP_HOST ? process.env.SPACES_SEP_HOST : '127.0.0.1';
const sep_port = process.env.SPACES_SEP_PORT ? parseInt(process.env.SPACES_SEP_PORT, 10) : 3000;
const spaced_host = process.env.SPACED_HOST ? process.env.SPACED_HOST : '127.0.0.1';
const spaced_port = process.env.SPACED_PORT ? parseInt(process.env.SPACED_PORT, 10) : 7225;


// Log environment variable status
if (!process.env.SPACES_SEP_HOST) {
  console.warn('WARNING: SPACES_SEP_HOST environment variable not set. Using default: 127.0.0.1');
}
if (!process.env.SPACES_SEP_PORT) {
  console.warn('WARNING: SPACES_SEP_PORT environment variable not set. Using default: 3000');
}
if (!process.env.SPACED_HOST) {
  console.warn('WARNING: SPACED_HOST environment variable not set. Using default: 127.0.0.1');
}
if (!process.env.SPACED_PORT) {
  console.warn('WARNING: SPACED_PORT environment variable not set. Using default: 7225');
}

const search_engine_google = process.env.SPACES_SEP_GOOGLE ? process.env.SPACES_SEP_GOOGLE : '{google:baseURL}search?q=%s&{google:RLZ}{google:originalQueryForSuggestion}{google:assistedQueryStats}{google:searchFieldtrialParameter}{google:language}{google:prefetchSource}{google:searchClient}{google:sourceId}{google:contextualSearchVersion}ie={inputEncoding}';
const search_engine_duckduckgo = process.env.SPACES_SEP_DUCKDUCKGO ? process.env.SPACES_SEP_DUCKDUCKGO : 'https://duckduckgo.com/?q=%s';
const search_engine_bing = process.env.SPACES_SEP_BING ? process.env.SPACES_SEP_BING : 'https://www.bing.com/search?q=%s';
const search_engine_yahoo = process.env.SPACES_SEP_YAHOO ? process.env.SPACES_SEP_YAHOO : 'https://search.yahoo.com/search{google:pathWildcard}?ei={inputEncoding}&fr=crmas_sfp&p=%s';
const search_engine_yandex = process.env.SPACES_SEP_YANDEX ? process.env.SPACES_SEP_YANDEX : 'https://yandex.com/{yandex:searchPath}?text=%s';
// const search_engine_ask = process.env.SPACES_SEP_ASK ? process.env.SPACES_SEP_ASK : 'https://www.ask.com/web?q=%s';
// const search_engine_baidu = process.env.SPACES_SEP_BAIDU ? process.env.SPACES_SEP_BAIDU : 'https://www.baidu.com/s?wd=%s';
// const search_engine_qwant = process.env.SPACES_SEP_QWANT ? process.env.SPACES_SEP_QWANT : 'https://www.qwant.com/?q=%s';
// const search_engine_ecosia = process.env.SPACES_SEP_ECOCIA ? process.env.SPACES_SEP_ECOCIA : 'https://www.ecosia.org/search?q=%s';
// const search_engine_startpage = process.env.SPACES_SEP_STARTPAGE ? process.env.SPACES_SEP_STARTPAGE : 'https://www.startpage.com/do/search?q=%s';
// const search_engine_brave = process.env.SPACES_SEP_BRAVE ? process.env.SPACES_SEP_BRAVE : 'https://search.brave.com/search?q=%s';

console.log("sep_host: " + sep_host);
console.log("sep_port: " + sep_port);
console.log("spaced_host: " + spaced_host);
console.log("spaced_port: " + spaced_port);

const cookie_name = 'spaces_search_engine_proxy';
const spaces_explorer_url = process.env.SPACES_EXPLORER_URL ? process.env.SPACES_EXPLORER_URL : 'https://explorer.spacesprotocol.org/space/';
const spaces_pinning_url = process.env.SPACES_PINNING_URL ? process.env.SPACES_PINNING_URL : 'http://70.251.209.207/pin/';

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

// Function to get space details via JSON-RPC
async function getSpace(spaceName: string): Promise<any> {
  const url = `http://${spaced_host}:${spaced_port}`; // Use backticks for template literal
  const requestBody = {
    jsonrpc: "2.0",
    id: "1", // You might want a dynamic ID in a real application
    method: "getspace",
    params: [spaceName]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Basic JSON-RPC error handling
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message} (Code: ${data.error.code})`);
    }

    return data.result; // Return the result part of the JSON-RPC response
  } catch (error) {
    console.error(`Error calling getSpace for ${spaceName}:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

// Express route handler
app.get('/', async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const searchCookie = req.cookies[cookie_name];

  if (!searchCookie) {
    // Cookie doesn't exist, show the selection form
    // Pre-fill query if it exists in the URL already
    const currentQuery = query || ''; 
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Select Search Engine</title>
          <style>
            body { font-family: sans-serif; max-width: 600px; margin: 2em auto; padding: 1em; border: 1px solid #ccc; border-radius: 5px; }
            label { display: block; margin-bottom: 0.5em; }
            select, input[type="text"] { width: 100%; padding: 0.5em; margin-bottom: 1em; box-sizing: border-box; }
            button { padding: 0.7em 1.5em; cursor: pointer; }
          </style>
      </head>
      <body>
          <h1>Choose Your Default Search Engine</h1>
          <p>Since you haven't set a default search engine preference for non-Space queries, please select one below.</p>
          <form action="/set_search_cookie" method="POST">
              <label for="search_engine_url">Search Engine:</label>
              <select id="search_engine_url" name="search_engine_url" required>
                  <option value="${search_engine_google}">Google</option>
                  <option value="${search_engine_duckduckgo}">DuckDuckGo</option>
                  <option value="${search_engine_bing}">Bing</option>
                  <option value="${search_engine_yahoo}">Yahoo</option>
                  <option value="${search_engine_yandex}">Yandex</option>
                  // Add other engines here if uncommented above
              </select>

              <label for="q">Custom Search Engine Query:</label>
              <input type="text" id="search_engine_custom" name="search_engine_custom" value="" placeholder="Enter your search engine with %s for the query">

              <button type="submit">Set Preference & Search</button>
          </form>
      </body>
      </html>
    `);
  }

  if (!query) {
    // Create a fallback URL in case globalExternalAddress is not available
    const exampleUrl = globalExternalAddress 
      ? `http://${globalExternalAddress}/?q=@space`
      : `http://${sep_host}:${sep_port}/?q=@space`;
      
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
      console.log(query + " : No DNS records found. Checking space details...");
      try {
        const spaceInfo = await getSpace(query);

        if (spaceInfo && spaceInfo.covenant) {
          const covenantType = spaceInfo.covenant.type;
          if (covenantType === 'transfer') {
             // Restore transfer message -> Change to HTML page suggesting pinning service
             //return res.status(200).json({ message: `Space '${query}' is currently in a transfer state. No active DNS records found.` }); 
             res.setHeader('Content-Type', 'text/html');
             return res.status(200).send(`
              <!DOCTYPE html>
              <html>
              <head>
                  <title>Space Transferring - ${query}</title>
                  <style>
                    body { font-family: sans-serif; max-width: 700px; margin: 2em auto; padding: 1.5em; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; text-align: center; }
                    h1 { color: #cc3300; margin-bottom: 0.5em; }
                    p { line-height: 1.6; color: #333; }
                    a { color: #007bff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    .pinning-link { display: inline-block; margin-top: 1.5em; padding: 0.8em 1.5em; background-color: #007bff; color: white; border-radius: 5px; font-weight: bold; }
                    .pinning-link:hover { background-color: #0056b3; color: white; text-decoration: none; }
                  </style>
              </head>
              <body>
                  <h1>Are you the owner of ${query}?</h1>
                  <p>This space is currently in a transfer state and has no active DNS records.</p>
                  <p>If you are the owner, consider using the <strong>Spaces Pinning Service</strong> to ensure your records remain available even during transfers or lapses.</p>
                  <a href="${spaces_pinning_url}" target="_blank" class="pinning-link">Learn about the Pinning Service</a> 
                  
              </body>
              </html>
            `);
          } else if (covenantType === 'bid') {
             // Restore bid message -> Change to HTML page suggesting pinning service
             //return res.status(200).json({ message: `Space '${query}' is currently up for bidding. No active DNS records found.` });
             res.setHeader('Content-Type', 'text/html');
             return res.status(200).send(`
              <!DOCTYPE html>
              <html>
              <head>
                  <title>Space Bidding - ${query}</title>
                  <style>
                    body { font-family: sans-serif; max-width: 700px; margin: 2em auto; padding: 1.5em; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; text-align: center; }
                    h1 { color: #007bff; margin-bottom: 0.5em; }
                    p { line-height: 1.6; color: #333; }
                    a { color: #007bff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    .pinning-link { display: inline-block; margin-top: 1.5em; padding: 0.8em 1.5em; background-color: #007bff; color: white; border-radius: 5px; font-weight: bold; }
                    .pinning-link:hover { background-color: #0056b3; color: white; text-decoration: none; }
                  </style>
              </head>
              <body>
                  <h1>Are you bidding on ${query}?</h1>
                  <p>This space is currently open for bidding.</p>
                  <p>If you are interested in bidding on ${query}, please visit the <a href="${spaces_explorer_url}${query.substring(1)}" target="_blank">Spaces Explorer</a> to learn more.</p>
                  <p>If you are the winner, consider using the <strong>Spaces Pinning Service</strong> to ensure your content remains available to the public.</p>
                   <a href="${spaces_pinning_url}" target="_blank" class="pinning-link">Learn about the Pinning Service</a> 
              </body>
              </html>
            `);
          } else {
             // Not transfer or bid: redirect to Explorer
             console.log(`Space '${query}' state is '${covenantType}'. No DNS records found. Redirecting to explorer.`);
             const searchTerm = query.startsWith('@') ? query.substring(1) : query; // Remove leading '@' if present
             const explorerRedirectUrl = spaces_explorer_url + searchTerm;

             console.log(`Redirecting to Spaces Explorer: ${explorerRedirectUrl}`);
             res.writeHead(302, { 'Location': explorerRedirectUrl });
             return res.end(); // Stop execution
          }
        } else {
          // Space found by getSpace, but no covenant info or unexpected structure -> Redirect to Explorer
          console.error(`Space info for '${query}' found but structure unclear. Redirecting to explorer.`);
          
          const searchTerm = query.startsWith('@') ? query.substring(1) : query; // Remove leading '@' if present
          const explorerRedirectUrl = spaces_explorer_url + searchTerm;
          
          console.log(`Redirecting to Spaces Explorer: ${explorerRedirectUrl}`);
          res.writeHead(302, { 'Location': explorerRedirectUrl });
          return res.end(); // Stop execution
        }
      } catch (error) {
        // Handle errors from getSpace (e.g., space doesn't exist at all) -> Redirect to Explorer
        console.error(`Error calling getSpace for ${query} after no DNS records found. Redirecting to explorer:`, error);
        
        const searchTerm = query.startsWith('@') ? query.substring(1) : query; // Remove leading '@' if present
        const explorerRedirectUrl = spaces_explorer_url + searchTerm;
        
        console.log(`Redirecting to Spaces Explorer: ${explorerRedirectUrl}`);
        res.writeHead(302, { 'Location': explorerRedirectUrl });
        return res.end(); // Stop execution
      }
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
        console.log(query + " : No A or TXT:path: or TXT:pkar: record found. Falling back to web search.");
        // Fallback: Use the search engine URL from the cookie
        const searchUrlTemplate = req.cookies[cookie_name];
        const searchTerm = query.startsWith('@') ? query.substring(1) : query; // Remove leading '@' if present
        if (searchUrlTemplate) {
          const searchUrl = searchUrlTemplate.replace('%s', encodeURIComponent(searchTerm));
          console.log(`Redirecting to web search: ${searchUrl}`);
          res.writeHead(302, { 'Location': searchUrl });
          return res.end();
        } else {
          // Should not happen if the initial cookie check works, but handle defensively
          console.error("Search cookie missing unexpectedly.");
          res.status(500).json({ error: "Search preference cookie is missing." });
        }
      }
    }
  } catch (error) {
    // Catch all for errors during DNS query or initial processing -> Treat as search
    console.error(`Unhandled error during request processing for query '${query}'. Falling back to web search:`, error);
    // res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); // Old behavior
    
    // Fallback to web search
    // Need access to req here, but it's not available in this catch scope directly 
    // unless we restructure or pass req/res down. Let's assume req is accessible for now.
    // NOTE: This requires `req` to be available in this scope.
    //       A better approach might be to structure the try/catch differently.
    try {
        const searchCookie = req.cookies[cookie_name]; // Assuming req is available
        const searchTerm = query.startsWith('@') ? query.substring(1) : query; 
        if (searchCookie) {
          const searchUrl = searchCookie.replace('%s', encodeURIComponent(searchTerm));
          console.log(`Redirecting to web search due to error: ${searchUrl}`);
          res.writeHead(302, { 'Location': searchUrl });
          return res.end();
        } else {
          console.error("Search cookie missing when handling main processing error.");
          // Cannot redirect without cookie, send error
          res.status(500).json({ error: "An unexpected error occurred and search preference cookie is missing." });
        }
    } catch (fallbackError) {
        // Catch error during the fallback itself
        console.error("Error during fallback search redirection:", fallbackError);
        res.status(500).json({ error: "An unexpected error occurred during fallback processing." });
    }
  }
});

// Endpoint to handle setting the search engine cookie
app.post('/set_search_cookie', (req: Request, res: Response) => {
  const { search_engine_url, q, search_engine_custom } = req.body;

  // Determine which URL to use: prioritize custom input
  const final_search_engine_url = search_engine_custom?.trim() || search_engine_url;

  if (!final_search_engine_url) {
    return res.status(400).send("Search engine URL (either selected or custom) is required.");
  }

  // Set the cookie
  // You might want to configure options like maxAge, httpOnly, secure (for HTTPS) etc.
  res.cookie(cookie_name, final_search_engine_url, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // Expires in 1 year

  // Redirect back to the main page with the query, if provided
  const redirectUrl = q ? `/?q=${encodeURIComponent(q)}` : '/';
  res.redirect(redirectUrl);
});

// Endpoint to delete the search engine cookie
app.get('/del_search_cookie', (req: Request, res: Response) => {
  if (req.cookies[cookie_name]) {
    res.clearCookie(cookie_name);
    res.send("Search engine preference cookie deleted.");
  } else {
    res.send("Search engine preference cookie not found.");
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
    app.listen(sep_port, () => {
      if (globalExternalAddress) {
        console.log(`Public IP address: ${globalExternalAddress}`);
      }
      console.log(`Server running at http://${sep_host}:${sep_port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 