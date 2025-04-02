const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    // Parse the URL and query parameters
    const parsedUrl = url.parse(req.url, true);

    // Only handle GET requests
    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
    }

    // Check if there's a query parameter 'q'
    if (!parsedUrl.query.q) {
        res.writeHead(400);
        res.end('Missing query parameter "q"');
        return;
    }

    try {
        // Special case for @nostrops
        if (parsedUrl.query.q === '@nostrops') {
            res.writeHead(302, { 'Location': 'http://70.251.209.207' });
            res.end();
            return;
        } else {
            res.writeHead(302, { 'Location': 'https://search.brave.com/search?q=' + parsedUrl.query.q + '&source=desktop' });
            res.end();
            return;
        }

    } catch (error) {
        res.writeHead(400);
        res.end('Invalid URL provided');
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
}); 