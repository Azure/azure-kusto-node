// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function getStringTailLowerCase(val: string, tailLength: number): string {
    if (tailLength <= 0) {
        return "";
    }

    if (tailLength >= val.length) {
        return val.toLowerCase();
    }

    return val.substring(val.length - tailLength).toLowerCase();
}

export function sanitizeUrlForLogging(kustoUri: string): string {
    try {
        const url = new URL(kustoUri);
        // Remove query parameters to avoid logging sensitive information like sig=
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        // If URL parsing fails, return a safe fallback
        return "[invalid-url]";
    }
}
