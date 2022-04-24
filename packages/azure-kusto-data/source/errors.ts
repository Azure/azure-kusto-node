// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/* eslint-disable max-classes-per-file -- gather all exceptions in one file */

export class KustoAuthenticationError extends Error {
    constructor(message: string, public inner: Error | undefined, public tokenProviderName: string, public context: Record<string, any>) {
        super(message);
        this.name = "KustoAuthenticationError";
    }
}

export class ThrottlingError extends Error {
    constructor(message: string, public inner: Error | undefined) {
        super(message);
        this.name = "ThrottlingError";
    }
}
