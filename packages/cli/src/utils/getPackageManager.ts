/**
 * SRE CLI Tool - Package Manager Detection
 *
 * This utility helps in identifying the package manager (npm, pnpm, or yarn)
 * used to install the SRE CLI. This is crucial for providing the correct
 * update instructions to the user.
 */

/**
 * Detects the package manager used to run the CLI.
 *
 * It checks the path of the executed script. If the package is installed
 * globally via pnpm, its path will contain '.pnpm'. This is a reliable
 * way to detect pnpm.
 *
 * For yarn, it checks the `npm_config_user_agent` environment variable,
 * which is a standard way to detect yarn.
 *
 * If neither pnpm nor yarn is detected, it defaults to npm.
 *
 * @returns {'npm' | 'pnpm' | 'yarn'} The detected package manager.
 */
export const getPackageManager = (): 'npm' | 'pnpm' | 'yarn' => {
    try {
        // `__filename` is a CJS global. It's the path to the current module file.
        // When a package is installed globally with pnpm, its location will be
        // in a path that contains `.pnpm`.
        if (__filename.includes('.pnpm')) {
            return 'pnpm';
        }
    } catch (error) {
        // `__filename` is not available in ESM, so we ignore the error.
    }

    // `process.env.npm_config_user_agent` is set by yarn and npm.
    if (process.env.npm_config_user_agent?.startsWith('yarn')) {
        return 'yarn';
    }

    return 'npm';
};
