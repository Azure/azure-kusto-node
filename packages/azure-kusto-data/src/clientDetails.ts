// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { isNode } from "@azure/core-util";
import { userInfo } from "os";
import { SDK_VERSION } from "./version";

// eslint-disable-next-line @typescript-eslint/no-namespace,@typescript-eslint/no-unused-vars -- This is the correct way to augment the global namespace
declare namespace NodeJS {
    interface ProcessEnv {
        npm_package_name?: string;
        USERNAME?: string;
        USERDOMAIN?: string;
    }
}

// REPLACE_REGEX = re.compile(r"[\r\n\s{}|]+")
const ReplaceRegex = /[\r\n\s{}|]+/g;
const None = "[none]";

export class ClientDetails {
    readonly versionForTracing: string;

    constructor(public applicationNameForTracing: string | null, public userNameForTracing: string | null) {
        if (this.applicationNameForTracing === null) {
            this.applicationNameForTracing = ClientDetails.defaultApplication();
        }
        if (this.userNameForTracing === null) {
            this.userNameForTracing = ClientDetails.defaultUser();
        }
        this.versionForTracing = ClientDetails.defaultVersion();
    }

    static defaultApplication(): string {
        if (isNode) {
            return process?.env?.npm_package_name || process.title || None;
        } else {
            return window?.location?.href || None;
        }
    }

    static defaultUser(): string {
        if (isNode) {
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
        return this.formatHeader([
            ["Kusto.JavaScript.Client", SDK_VERSION],
            ["Runtime." + (isNode ? "Node" : "Browser"), (isNode ? process.version : window?.navigator?.userAgent) || None],
        ]);
    }

    static escapeHeader(header: string): string {
        return `{${header.replace(ReplaceRegex, "_")}}`;
    }

    static formatHeader(args: [string, string][]): string {
        return args
            .filter(([key, val]) => key && val)
            .map(([key, val]) => `${key}:${this.escapeHeader(val)}`)
            .join("|");
    }

    static setConnectorDetails(
        name: string,
        version: string,
        app_name: string | null = null,
        app_version: string | null = null,
        send_user: boolean = false,
        override_user: string | null = null,
        additional_fields: [string, string][] | null = null
    ): ClientDetails {
        const params: [string, string][] = [["Kusto." + name, version]];

        app_name = app_name || this.defaultApplication();
        app_version = app_version || None;

        params.push(["App." + this.escapeHeader(app_name), app_version]);
        params.push(...(additional_fields || []));

        let user = None;

        if (send_user) {
            user = override_user || this.defaultUser();
        }

        return new ClientDetails(this.formatHeader(params), user);
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
}
