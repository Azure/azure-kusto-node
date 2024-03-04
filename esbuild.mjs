import * as esbuild from "esbuild";
import { nodeModulesPolyfillPlugin } from "esbuild-plugins-node-modules-polyfill";

if (process.argv.includes("--node")) {
    console.log("building for node");
    console.log(
        await esbuild.build({
            entryPoints: ["src/index.ts"],
            bundle: true,
            minify: true,
            platform: "node",
            target: "node18",
            format: "esm",
            outdir: "dist/node",
            tsconfig: "tsconfig.json",
            outExtension: { ".js": ".mjs" },
            packages: "external",
            sourcemap: true,
        })
    );
} else {
    console.log("building for browser");
    console.log(
        await esbuild.build({
            entryPoints: ["src/index.ts"],
            bundle: true,
            minify: true,
            platform: "browser",
            target: "es2017",
            format: "esm",
            outdir: "dist/browser",
            tsconfig: "tsconfig.browser.json",
            outExtension: { ".js": ".mjs" },
            plugins: [
                nodeModulesPolyfillPlugin({
                    sourcemap: true,
                }),
            ],
        })
    );
}
