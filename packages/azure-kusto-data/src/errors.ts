// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AxiosError } from "axios";

/**
 * The error object Kusto returns in the body of a failed request.
 */
export interface OneApiError {
    code: string;
    message: string;
    "@type"?: string;
    "@message"?: string;
    "@context"?: Record<string, unknown>;
    "@permanent"?: boolean;
    [key: string]: unknown;
}

/**
 * Thrown when Kusto rejects a request with a OneApiError body, such as a syntax or semantic error.
 * It extends AxiosError, so `response` and `axios.isAxiosError()` keep working.
 */
export class KustoApiError extends AxiosError {
    constructor(
        public error: OneApiError,
        inner: AxiosError,
    ) {
        super(error["@message"] || error.message, inner.code, inner.config, inner.request, inner.response);
        this.name = "KustoApiError";
        this.cause = inner;
    }

    get isPermanent(): boolean {
        return this.error["@permanent"] === true;
    }
}

export class KustoAuthenticationError extends Error {
    constructor(
        message: string,
        public inner: Error | undefined,
        public tokenProviderName: string,
        public context: Record<string, any>,
    ) {
        super(message);
        this.name = "KustoAuthenticationError";
    }
}

export class ThrottlingError extends Error {
    constructor(
        message: string,
        public inner: Error | undefined,
    ) {
        super(message);
        this.name = "ThrottlingError";
    }
}
