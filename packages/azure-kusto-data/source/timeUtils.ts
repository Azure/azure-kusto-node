// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const toMilliseconds = (hours: number, minutes: number, seconds: number) => (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
