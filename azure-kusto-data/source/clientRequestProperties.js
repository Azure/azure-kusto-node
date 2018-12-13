module.exports = class ClientRequestProperties {
    constructor() {
        this._options = {};      
    }

    setOption(name, value) {
        this._options[name] = value;
    }

    getOption(name, defaultValue) {
        if (!this._options || this._options[name] === undefined)
            return defaultValue;

        return this._options[name];
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
        if (!this._options || Object.keys(this._options).length == 0) {
            return null;
        }

        return { "Options" : this._options };
    }

    toString() {
        return JSON.stringify(this.toJson());
    }
};
