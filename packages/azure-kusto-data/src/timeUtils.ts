// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export function toMilliseconds(hours: number, minutes: number, seconds: number) {
    return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
}
