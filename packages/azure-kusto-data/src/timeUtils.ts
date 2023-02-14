// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function toMilliseconds(hours: number, minutes: number, seconds: number) {
    return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
}

// Format: [+|-]d.hh:mm:ss[.fffffff]
const TimespanRegex = /^(-?)(?:(\d+).)?(\d{2}):(\d{2}):(\d{2}(\.\d+)?$)/;

export function parseKustoTimestampToMicros(t: string | null): number {
    if (t == null) {
        return 0;
    }
    const match = TimespanRegex.exec(t);
    if (match) {
        const sign = match[1] === "-" ? -1 : 1;
        const days = parseInt(match[2] || "0", 10);
        const hours = parseInt(match[3], 10);
        const minutes = parseInt(match[4], 10);
        const seconds = parseFloat(match[5]);
        return sign * 1000000 * (days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds);
    }
    throw new Error(`Timespan value '${t}' cannot be decoded`);
}
