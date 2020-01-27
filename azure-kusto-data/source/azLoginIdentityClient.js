const {AzureCliCredentials} = require("@azure/ms-rest-nodeauth");

module.exports = function acquireToken(connectionString, callback) {
    
    AzureCliCredentials.create({ resource: connectionString }).then((res)=>{

        const tokenData = res.tokenInfo;
        return callback(null, { tokenType: tokenData.tokenType, accessToken: tokenData.accessToken });

    }).catch(err=>callback(err));
};
