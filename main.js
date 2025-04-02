const express = require('express');
const https = require('https');
const http = require('http');
const url = require('url');

const app = express();
const port = 3000;

app.get('/query', (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).send('Query parameter "q" is required.');
  }

  const parsedUrl = url.parse(query);
  const protocol = parsedUrl.protocol === 'https:' ? https : http;
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    method: 'GET',
  };

  const externalReq = protocol.request(options, (externalRes) => {
    res.writeHead(externalRes.statusCode, externalRes.headers);
    externalRes.pipe(res);
  });

  externalReq.on('error', (error) => {
    console.error('Error forwarding request:', error);
    res.status(500).send('Error forwarding request.');
  });

  externalReq.end();
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

