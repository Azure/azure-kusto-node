// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoHeaders } from "./clientDetails.js";

const SDK_API_VERSION = "2024-12-12"; // TODO: Update when new API version is released

export class ClientRequestProperties {
    private _options: { [option: string]: any };
    private _parameters: { [option: string]: any };
    private _clientTimeOut?: number;
    public clientRequestId: string | null;
    public user: string | null;
    public application: string | null;
    public raw?: boolean;

    constructor(options?: Record<string, unknown>, parameters?: Record<string, unknown>, clientRequestId?: string, user?: string, application?: string) {
        this._options = options || {};
        this._parameters = parameters || {};
        this.clientRequestId = clientRequestId || null;
        this.user = user || null;
        this.application = application || null;
    }

    setOption(name: string, value: any) {
        this._options[name] = value;
    }

    getOption(name: string, defaultValue?: any) {
        if (!this._options || this._options[name] === undefined) return defaultValue;

        return this._options[name];
    }

    setParameter(name: string, value: any) {
        this._parameters[name] = value;
    }

    getParameter(name: string, defaultValue?: any) {
        if (!this._parameters || this._parameters[name] === undefined) {
            return defaultValue;
        }

        return this._parameters[name];
    }

    clearParameters() {
        this._parameters = {};
    }

    setTimeout(timeoutMillis: number) {
        this.setOption("servertimeout", timeoutMillis);
    }

    getTimeout(): number | undefined {
        return this.getOption("servertimeout");
    }

    setClientTimeout(timeoutMillis: number) {
        this._clientTimeOut = timeoutMillis;
    }

    getClientTimeout() {
        return this._clientTimeOut;
    }

    clearOptions() {
        this._options = {};
    }

    /**
     * @deprecated use the compliant toJSON() instead
     */
    toJson() {
        return this.toJSON();
    }

    toJSON() {
        const json: {
            Options?: { [option: string]: any };
            Parameters?: { [option: string]: any };
        } = {};

        if (Object.keys(this._options).length !== 0) {
            json.Options = { ...this._options };
            if (json.Options.servertimeout) {
                json.Options.servertimeout = this._msToTimespan(json.Options.servertimeout as number);
            }
        }

        if (Object.keys(this._parameters).length !== 0) {
            json.Parameters = { ...this._parameters };
        }

        return Object.keys(json).length !== 0 ? json : null;
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }

    _msToTimespan(duration: number): string {
        const milliseconds = duration % 1000;
        const seconds = Math.floor((duration / 1000) % 60);
        const minutes = Math.floor((duration / (1000 * 60)) % 60);
        const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

        const hoursStr = String(hours).padStart(2, "0");
        const minutesStr = String(minutes).padStart(2, "0");
        const secondsStr = String(seconds).padStart(2, "0");
        const millisecondsStr = String(milliseconds).padStart(3, "0");

        return `${hoursStr}:${minutesStr}:${secondsStr}.${millisecondsStr}`;
    }

    getHeaders(): Partial<KustoHeaders> {
        const headers: Partial<KustoHeaders> = {};
        if (this.clientRequestId) {
            headers["x-ms-client-request-id"] = this.clientRequestId;
        }
        if (this.user) {
            headers["x-ms-user"] = this.user;
        }
        if (this.application) {
            headers["x-ms-app"] = this.application;
        }
        headers["x-ms-version"] = SDK_API_VERSION;
        return headers;
    }
}

export default ClientRequestProperties;
