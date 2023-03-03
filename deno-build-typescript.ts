import { emit, bundle } from "https://deno.land/x/emit/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild/mod.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader/mod.ts";

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

    const url = new URL(file, import.meta.url);

    // Emit (for 1:1 TS -> JS)
    // const result = await emit(url);
    // const code = result[url.href];
    await esbuild.build({
        plugins: [denoPlugin() as any],
        entryPoints: [file],
        outfile: outFile,
        bundle: true,
        format: "esm",
        jsx: "automatic",
    });

    await esbuild.stop();

    /*
    // Bundle (tries to roll dependencies to single file)
    const result = await bundle(url, {
        compilerOptions: {
            // NOTE: 2022-10-03: Switching following to false didn't disable
            // sourceMap tested
            //
            // inlineSourceMap: false,
            // sourceMap: false,
            // sourceMap: false,
            // inlineSources: false,
        },
    });

    if (outFile) {
        await Deno.writeTextFile(outFile, result.code);
    }
    */
}

// Get first argument
const file = Deno.args[0];
const outFile = Deno.args[1];

await buildTsFile(file, outFile);

/*

*/
