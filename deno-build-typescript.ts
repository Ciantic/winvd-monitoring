import * as esbuild from "npm:esbuild";
// import { solidPlugin } from "npm:esbuild-plugin-solid";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.8.1/mod.ts";

async function buildTsFile(file: string, outFile: string) {
    if (!file) {
        console.error("Please provide a file to bundle.");
        return false;
    }

    if (!outFile) {
        console.error("Please provide an output file.");
        return false;
    }

    if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
        console.error("Please provide a .ts file to bundle.");
        console.error("Given file: ", file);
        return false;
    }

    if (!outFile.endsWith(".js")) {
        console.error("Please provide a .js output file.");
        console.error("Given file: ", outFile);
        return false;
    }

    await esbuild.build({
        plugins: [
            // solidPlugin({
            //     solid: {
            //         moduleName: "npm:solid-js/web",
            //     },
            // }),
            ...denoPlugins(),
        ],
        entryPoints: [file],
        outfile: outFile,
        bundle: true,
        format: "esm",
        jsx: "automatic",
        // treeShaking: true,
        // minify: true,

        // Minify is required for dead code elimination, tree shaking doesn't
        // remove: `if (false) { ... }` statements.
        // minifySyntax: true,
        // minifyWhitespace: true,
        // minify: true,
        define: {
            // Deno: "false",
            Deno: JSON.stringify({
                build: {
                    os: "browser",
                },
            }),
        },
    });
}

// Get first argument
const file = Deno.args[0];
const outFile = Deno.args[1];

await buildTsFile(file, outFile);
