import json from '@rollup/plugin-json';
import { createFilter } from '@rollup/pluginutils';
import path from 'path';
import copy from 'rollup-plugin-copy';
import esbuild from 'rollup-plugin-esbuild';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import typescriptPaths from 'rollup-plugin-typescript-paths';
import { createResolver } from 'tsconfig-paths';

import javascriptObfuscator from 'rollup-plugin-javascript-obfuscator';

import fs from 'fs';
const projectRootDir = __dirname;
export default {
    input: 'src/index.ts',
    output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true,
    },
    plugins: [
        json(),
        typescriptPaths({
            tsconfig: './tsconfig.json', // Ensure this points to your tsconfig file
            preserveExtensions: true,
            nonRelative: false,
        }),
        esbuild({
            sourceMap: true,
            minify: false,
            treeShaking: true,
        }),
        // typescript({
        //     tsconfig: 'tsconfig.json',
        //     clean: true,
        // }),
        filenameReplacePlugin(),
        sourcemaps(),
        terser(),
        copy({
            targets: [
                { src: 'src/data/*', dest: 'dist/data' },
                /*{ src: 'src/static/*', dest: 'dist/static' },*/
            ],
        }),
    ],
};

// this is used to replace the ___FILENAME___ placeholder with source filename
//it's used by the logger to set the appropriate module name
function filenameReplacePlugin() {
    const filter = createFilter('**/*.ts', 'node_modules/**');

    return {
        name: 'filename-replace',
        transform(code, id) {
            if (!filter(id)) return null;

            // Normalize the path for different environments
            const normalizedId = path.normalize(id);

            // Extract the part of the path after '/src' and remove the file extension
            const relativePath = path.relative(path.resolve('src'), normalizedId);
            const filenameWithoutExtension = relativePath.replace(path.extname(relativePath), '');

            // Replace backslashes with forward slashes if on Windows
            const unixStylePath = filenameWithoutExtension.replace(/\\/g, '/');

            const modifiedCode = code.replace(/___FILENAME___/g, unixStylePath);

            return {
                code: modifiedCode,
                map: null, // Handle source maps if necessary
            };
        },
    };
}
