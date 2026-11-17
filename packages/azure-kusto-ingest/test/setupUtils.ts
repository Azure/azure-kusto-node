// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { KustoDataErrors } from "azure-kusto-data";
import { isAxiosError } from "axios";
import { ExponentialRetry } from "../src/retry.js";

export const runSetupTasks = async <T>(items: readonly T[], initialize: (item: T) => Promise<void>): Promise<void> => {
    const concurrency = 4;
    for (let start = 0; start < items.length; start += concurrency) {
        const results = await Promise.allSettled(items.slice(start, start + concurrency).map(async (item) => initialize(item)));
        const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
        if (failure) {
            throw failure.reason;
        }
    }
};

const isTransientManagementError = (error: unknown): boolean => {
    if (error instanceof KustoDataErrors.ThrottlingError) {
        return true;
    }
    if (!isAxiosError(error) || (error instanceof KustoDataErrors.KustoApiError && error.isPermanent)) {
        return false;
    }
    if (error.response) {
        return [408, 429, 500, 502, 503, 504].includes(error.response.status);
    }
    return ["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN"].includes(error.code ?? "");
};

export const retryManagementCommand = async <T>(operation: () => Promise<T>): Promise<T> => {
    const retry = new ExponentialRetry(3, 1, 2);
    while (true) {
        try {
            return await operation();
        } catch (error) {
            if (!isTransientManagementError(error)) {
                throw error;
            }
            await retry.backoff();
            if (!retry.shouldTry()) {
                throw error;
            }
        }
    }
};
