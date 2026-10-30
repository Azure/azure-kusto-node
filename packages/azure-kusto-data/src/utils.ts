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

const isNumberChar = (ch: string) => (ch >= "0" && ch <= "9") || ch === "-" || ch === "+" || ch === "." || ch === "e" || ch === "E";

/**
 * Parses JSON like `JSON.parse`, except that integer literals outside the safe integer range are returned as their exact decimal strings.
 * Works on every JavaScript engine, unlike a reviver relying on the `context.source` argument.
 */
export function parseJsonWithLargeIntegersAsStrings(text: string): unknown {
    // Number.MAX_SAFE_INTEGER has 16 digits, so a text without a 16-digit run has nothing to preserve.
    if (!/\d{16}/.test(text)) {
        return JSON.parse(text);
    }

    let result = "";
    let copiedUpTo = 0;
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (ch === "\\") {
                i++;
            } else if (ch === '"') {
                inString = false;
            }
        } else if (ch === '"') {
            inString = true;
        } else if (ch === "-" || (ch >= "0" && ch <= "9")) {
            let end = i + 1;
            while (end < text.length && isNumberChar(text[end])) {
                end++;
            }
            const token = text.slice(i, end);
            if (/^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token))) {
                result += `${text.slice(copiedUpTo, i)}"${token}"`;
                copiedUpTo = end;
            }
            i = end - 1;
        }
    }

    return JSON.parse(result + text.slice(copiedUpTo));
}
