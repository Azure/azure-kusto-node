// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

module.exports = class ClientRequestProperties {
    constructor(options, parameters) {
        this._options = options || {};
        this._parameters = parameters || {};
    }

    setOption(name, value) {
        this._options[name] = value;
    }

    getOption(name, defaultValue) {
        if (!this._options || this._options[name] === undefined)
            return defaultValue;

        return this._options[name];
    }

    setParameter(name, value) {
        this._parameters[name] = value;
    }

    getParameter(name, defaultValue) {
        if (!this._parameters || this._parameters[name] === undefined) {
            return defaultValue;
        }

        return this._parameters[name];
    }

    clearParameters() {
        this._parameters = {};
    }

    setTimeout(timeoutMillis) {
        this.setOption("servertimeout", timeoutMillis);
    }

    getTimeout() {
        return this.getOption("servertimeout");
    }

    clearOptions() {
        this._options = {};
    }

    toJson() {
        let json = {};

        if (Object.keys(this._options).length !== 0) {
            json.Options = this._options;
        }

        if (Object.keys(this._parameters).length !== 0) {
            json.Parameters = this._parameters;
        }

        return Object.keys(json).length !== 0 ? json : null;
    }

    toString() {
        return JSON.stringify(this.toJson());
    }
};
