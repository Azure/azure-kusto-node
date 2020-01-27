const {AzureCliCredentials} = require("@azure/ms-rest-nodeauth");

module.exports = function acquireToken(connectionString, callback) {
    
    AzureCliCredentials.create({ resource: connectionString }).then((res)=>{

        const tokenData = res.tokenInfo;
        return callback(null, { tokenType: tokenData.token_type, accessToken: tokenData.access_token });

    }).catch(err=>callback(err));
};
