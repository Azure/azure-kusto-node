// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readFileSync } from "fs";
import { isBuiltin } from "module";
import path from "path";
import ts from "typescript";

/**
 * @typedef {object} PackageManifest
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, string>} [devDependencies]
 * @property {Record<string, string>} [optionalDependencies]
 * @property {Record<string, string>} [peerDependencies]
 */

/**
 * @param {string} pkgRoot
 * @returns {Record<string, string[]>}
 */
export function findUndeclaredDependencies(pkgRoot) {
    /** @type {PackageManifest} */
    const manifest = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8"));
    const declared = new Set(
        Object.keys({
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.optionalDependencies,
            ...manifest.peerDependencies,
        }),
    );
    /** @type {Map<string, Set<string>>} */
    const missing = new Map();
    const files = ts.sys.readDirectory(
        pkgRoot,
        [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"],
        ["**/test/**", "**/dist-esm/**", "**/types/**", "**/node_modules/**", "**/example*"],
        ["**/*"],
    );

    for (const file of files) {
        const importingFile = path.normalize(file);
        const imports = ts.preProcessFile(readFileSync(importingFile, "utf8"), true, true).importedFiles;
        for (const { fileName: specifier } of imports) {
            if (isBuiltin(specifier) || specifier.startsWith(".") || path.isAbsolute(specifier)) {
                continue;
            }
            const packageName = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
            if (declared.has(packageName) || packageName.startsWith("@types/")) {
                continue;
            }
            const importingFiles = missing.get(packageName) ?? new Set();
            importingFiles.add(importingFile);
            missing.set(packageName, importingFiles);
        }
    }

    return Object.fromEntries(Array.from(missing, ([packageName, files]) => [packageName, Array.from(files)]));
}
