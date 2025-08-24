// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { isNodeLike } from "@azure/core-util";
import { userInfo } from "node:os";
import { SDK_VERSION } from "./version.js";

// eslint-disable-next-line @typescript-eslint/no-namespace,@typescript-eslint/no-unused-vars -- This is the correct way to augment the global namespace
declare namespace NodeJS {
    interface ProcessEnv {
        npm_package_name?: string;
        USERNAME?: string;
        USERDOMAIN?: string;
    }
}

// This regex allows all printable ascii, except spaces and chars we use in the format
const ReplaceRegex = /[^\w.\-()]/g;
const None = "[none]";

export class ClientDetails {
    readonly versionForTracing: string;

    constructor(
        public applicationNameForTracing: string | null,
        public userNameForTracing: string | null,
    ) {
        if (this.applicationNameForTracing === null) {
            this.applicationNameForTracing = ClientDetails.defaultApplication();
        }
        if (this.userNameForTracing === null) {
            this.userNameForTracing = ClientDetails.defaultUser();
        }
        this.versionForTracing = ClientDetails.defaultVersion();
    }

    static defaultApplication(): string {
        if (isNodeLike) {
            return process?.env?.npm_package_name || process?.argv[1] || None;
        } else {
            return window?.location?.href || None;
        }
    }

    static defaultUser(): string {
        if (isNodeLike) {
            let username: string | undefined;
            try {
                username = userInfo().username;
            } catch (err: any) {
                /* Ignore possible errors like "uv_os_get_passwd returned ENOMEM" that may occur in some environments. */

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (err.info?.code !== "ENOMEM") {
                    throw err;
                }
            }

            return username || (process.env?.USERDOMAIN ? `${process.env?.USERDOMAIN}\\${process.env?.USERNAME}` : process?.env?.USERNAME) || None;
        } else {
            return None;
        }
    }

    static defaultVersion(): string {
        return ClientDetails.formatHeader([
            ["Kusto.JavaScript.Client", SDK_VERSION],
            [`Runtime.${isNodeLike ? "Node" : "Browser"}`, (isNodeLike ? process.version : window?.navigator?.userAgent) || None],
        ]);
    }

    static escapeHeader(header: string, wrapInBrackets: boolean = true): string {
        const clean = header.substring(0, 100).replace(ReplaceRegex, "_");
        return wrapInBrackets ? `{${clean}}` : clean;
    }

    static formatHeader(args: [string, string][]): string {
        return args
            .filter(([key, val]) => key && val)
            .map(([key, val]) => `${key}:${ClientDetails.escapeHeader(val)}`)
            .join("|");
    }

    static setConnectorDetails(
        name: string,
        version: string,
        app_name: string | null = null,
        app_version: string | null = null,
        send_user: boolean = false,
        override_user: string | null = null,
        additional_fields: [string, string][] | null = null,
    ): ClientDetails {
        const params: [string, string][] = [[`Kusto.${ClientDetails.escapeHeader(name, false)}`, version]];

        app_name = app_name || ClientDetails.defaultApplication();
        app_version = app_version || None;

        params.push([`App.${ClientDetails.escapeHeader(app_name)}`, app_version]);
        params.push(...(additional_fields || []));

        let user = None;

        if (send_user) {
            user = override_user || ClientDetails.defaultUser();
        }

        return new ClientDetails(ClientDetails.formatHeader(params), user);
    }

    getHeaders(): Partial<KustoHeaders> {
        return {
            "x-ms-client-version": this.versionForTracing,
            "x-ms-app": this.applicationNameForTracing,
            "x-ms-user": this.userNameForTracing,
        };
    }
}

export interface KustoHeaders {
    "x-ms-client-version": string | null;
    "x-ms-app": string | null;
    "x-ms-user": string | null;
    "x-ms-client-request-id": string | null;
    "x-ms-version": string | null;
}
