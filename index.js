var http = require("http"),
    url = require("url"),
    path = require("path"),
	request = require('request'),
    fs = require("fs");

http.createServer(function(req, response) {

  var uri = url.parse(req.url).pathname
    , filename = path.join(process.cwd(), uri);
  
  if (uri == '/allequipments')
	  request.get('http://advisory.mtanyct.info/eedevwebsvc/allequipments.aspx').pipe(response);
  else if (uri == '/stationstatus')
	  request.get('http://web.mta.info/developers/data/nyct/nyct_ene.xml').pipe(response);
  else if (uri == '/linestatus')
	  request.get('http://web.mta.info/status/serviceStatus.txt').pipe(response);
  else {
	  fs.exists(filename, function(exists) {
		if(!exists) {
		  response.writeHead(404, {"Content-Type": "text/plain"});
		  response.write("404 Not Found\n");
		  response.end();
		  return;
		}

		if (fs.statSync(filename).isDirectory()) filename += '/index.html';

		fs.readFile(filename, "binary", function(err, file) {
		  if(err) {
			response.writeHead(500, {"Content-Type": "text/plain"});
			response.write(err + "\n");
			response.end();
			return;
		  }
		  if (filename.includes(".css")) {
			response.writeHead(200, {"Content-Type": "text/css"});
			response.write(file);
			response.end();
			return;
		  }
		  if (filename.includes(".js")) {
			response.writeHead(200, {"Content-Type": "text/javascript"});
			response.write(file);
			response.end();
			return;
		  }
		  response.writeHead(200);
		  response.write(file, "binary");
		  response.end();
		});
	  });
  }
}).listen(process.env.PORT || 8888);