// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { findUndeclaredDependencies } from "../../../test/dependencyDeclarations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

describe("Dependency declarations", () => {
    it("all imported packages should be declared in package.json", () => {
        const missing = Object.entries(findUndeclaredDependencies(pkgRoot)).map(
            ([pkg, files]) => `"${pkg}" imported by ${files.map((f) => path.relative(pkgRoot, f)).join(", ")}`,
        );
        assert.strictEqual(missing.length, 0, `Undeclared dependencies found:\n${missing.join("\n")}`);
    });
});

describe("Dependency declaration scanner", () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(path.join(tmpdir(), "kusto-dependency-declarations-"));
        writeFileSync(
            path.join(directory, "package.json"),
            JSON.stringify({
                dependencies: { declared: "1.0.0", "@scope/declared": "1.0.0" },
                devDependencies: { development: "1.0.0" },
                optionalDependencies: { optional: "1.0.0" },
                peerDependencies: { peer: "1.0.0" },
            }),
        );
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    it("recognizes module imports, package subpaths, built-ins and declaration kinds", () => {
        writeFileSync(
            path.join(directory, "index.ts"),
            [
                'import "declared/subpath";',
                'import type { Value } from "@scope/declared/types";',
                'export { value } from "peer";',
                'import("optional");',
                'const dependency = require("development");',
                'import "node:fs/promises";',
                'import "fs/promises";',
                'import "./local.js";',
                'import "@types/ignored";',
            ].join("\n"),
        );

        assert.deepStrictEqual(findUndeclaredDependencies(directory), {});
    });

    it("reports undeclared import forms without duplicate files", () => {
        const source = path.join(directory, "index.ts");
        writeFileSync(
            source,
            [
                'import "missing/subpath";',
                'import("missing/other");',
                'import("dynamic-only");',
                'import type { Value } from "type-only";',
                'export { value } from "reexport-only";',
                'const dependency = require("@scope/missing/subpath");',
            ].join("\n"),
        );

        assert.deepStrictEqual(findUndeclaredDependencies(directory), {
            missing: [source],
            "dynamic-only": [source],
            "type-only": [source],
            "reexport-only": [source],
            "@scope/missing": [source],
        });
    });

    it("keeps test, generated, installed and example files out of the declaration check", () => {
        for (const name of ["test", "dist-esm", "types", "node_modules"]) {
            const ignored = path.join(directory, name);
            mkdirSync(ignored);
            writeFileSync(path.join(ignored, "index.ts"), 'import "missing";');
        }
        writeFileSync(path.join(directory, "example.js"), 'require("missing");');

        assert.deepStrictEqual(findUndeclaredDependencies(directory), {});
    });
});
