// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

function getPackageDependencies(): Set<string> {
    const pkgJson: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> } = JSON.parse(
        fs.readFileSync(path.join(pkgRoot, "package.json"), "utf-8"),
    );
    const deps = new Set<string>();
    for (const name of Object.keys(pkgJson.dependencies ?? {})) {
        deps.add(name);
    }
    for (const name of Object.keys(pkgJson.peerDependencies ?? {})) {
        deps.add(name);
    }
    return deps;
}

function getSourceImports(dir: string): Map<string, string[]> {
    const imports = new Map<string, string[]>();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));

    for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), "utf-8");
        const importRegex = /(?:import|export)\s+.*?from\s+["']([^"']+)["']/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const specifier = match[1];
            // Skip relative imports
            if (specifier.startsWith(".") || specifier.startsWith("/")) continue;
            // Extract package name (handle scoped packages)
            const parts = specifier.split("/");
            const pkgName = specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
            // Skip node built-in modules
            if (["fs", "path", "stream", "url", "zlib", "crypto", "os", "http", "https", "buffer", "util", "events"].includes(pkgName)) continue;

            if (!imports.has(pkgName)) {
                imports.set(pkgName, []);
            }
            imports.get(pkgName)!.push(file);
        }
    }
    return imports;
}

describe("Dependency declarations", () => {
    it.concurrent("all imported packages should be declared in package.json", () => {
        const declared = getPackageDependencies();
        const sourceImports = getSourceImports(path.join(pkgRoot, "src"));
        const undeclared: string[] = [];

        for (const [pkg, files] of sourceImports) {
            if (!declared.has(pkg)) {
                undeclared.push(`"${pkg}" imported by ${files.join(", ")} but not declared in package.json`);
            }
        }

        assert.strictEqual(undeclared.length, 0, `Undeclared dependencies found:\n${undeclared.join("\n")}`);
    });
});
