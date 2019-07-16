const http = require("http");
const url = require("url");

module.exports = function acquireToken(resource, msi_endpoint, msi_secret, callback) {
    const msiResource = `${msi_endpoint}/?resource=${resource}&api-version=2017-09-01`;
    const msiUrl = url.parse(msiResource);

    const options = {
        host: msiUrl.host,
        hostname: msiUrl.hostname,
        port: msiUrl.port,
        path: msiUrl.path,
        headers: {
            secret: msi_secret
        }
    };

    const request = http.request(options, res => {
        let data = "";

        res.on("data", chunk => {
            data += chunk;
        });

        res.on("end", () => {
            let responseData = JSON.parse(data);
            responseData.tokenType = responseData.token_type;
            responseData.accessToken = responseData.access_token;

            return callback(null, responseData);
        });
    });

    request.on("error", err => {
        return callback(err);
    });

    request.end();
};
