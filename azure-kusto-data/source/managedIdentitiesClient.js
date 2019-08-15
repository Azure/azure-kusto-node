const request = require("request");

const MSI_API_VERSION = "2018-02-01";
const MSI_FUNCTION_API_VERSION = "2017-09-01";

module.exports = function acquireToken(resource, msiEndpoint, msiClientId, msiSecret, callback) {
    let msiUri = `${msiEndpoint}/?resource=${resource}&api-version=${msiSecret ? MSI_FUNCTION_API_VERSION : MSI_API_VERSION}`;

    if (msiClientId) {
        msiUri += `&client_id=${msiClientId}`;
    }

    const headers = {};

    if (msiSecret) {
        headers.Secret = msiSecret;
    }

    request({
        method: "GET",
        url: msiUri,
        headers
    }, (error, response, body) => {
        if (error) return callback(error);

        if (response.statusCode < 200 || response.statusCode >= 400) {
            return callback(`Unexpected status ${response.statusCode}.\n ${response.body}`);
        }

        return callback(null, { tokenType: body.token_type, accessToken: body.access_token });
    });
};
