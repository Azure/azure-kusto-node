const request = require("request");

module.exports = function acquireToken(resource, msiEndpoint, msiClientId, callback) {
    // provided endpoint should be of the following format http://169.254.169.254/metadata/identity/oauth2/token
    // or http://localhost/oauth2/token (to be deprecated)
    // for more info refer to: https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview
    let msiUri = `${msiEndpoint}/?resource=${resource}&api-version=2018-02-01`;

    if (msiClientId != null) {
        msiUri += `&client_id=${msiClientId}`;
    }

    request({
        method: "GET",
        url: msiUri
    }, (error, response, body) => {
        if (error) return callback(error);

        if (response.statusCode < 200 || response.statusCode >= 400) {
            return callback(`Unexpected status ${response.statusCode}.\n ${response.body}`);
        }

        return callback(null, { tokenType: body.token_type, accessToken: body.access_token });
    });
};
