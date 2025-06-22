import fs from 'fs';

export function uid() {
  return (Date.now() + Math.random())
    .toString(36)
    .replace(".", "")
    .toUpperCase();
}




export function isFile(str: string): boolean {
  // Check if string exists and length is within limit
  if (!str || str.length >= 1000) {
      return false;
  }

  // Validate path format for both Windows and Unix systems
  if (!isValidPathFormat(str)) {
      return false;
  }

  // Check if file exists using fs.stat
  try {
      const stats = fs.statSync(str);
      return stats.isFile();
  } catch (error) {
      // File doesn't exist or permission denied
      return false;
  }
}

/**
* Validates if a string is in a valid file path format for both Windows and Unix systems
* Supports both absolute and relative paths
*/
export function isValidPathFormat(path: string): boolean {
  // Check for invalid characters that are not allowed in file paths
  const invalidChars = /[\0<>"|?*]/;
  if (invalidChars.test(path)) {
      return false;
  }

  // Windows path patterns
  const windowsAbsolute = /^[a-zA-Z]:[\\\/]/; // C:\ or C:/
  const windowsUNC = /^\\\\[^\\]+\\[^\\]+/; // \\server\share
  const windowsRelative = /^\.{1,2}[\\\/]/; // .\ or ..\ or ./ or ../
  
  // Unix path patterns
  const unixAbsolute = /^\//; // /path/to/file
  const unixHome = /^~[\/]/; // ~/path/to/file
  const unixRelative = /^\.{1,2}\//; // ./ or ../
  
  // Relative paths without leading ./ or .\
  const genericRelative = /^[^\\\/]/; // path/to/file or path\to\file

  // Check if path matches any valid pattern
  return (
      windowsAbsolute.test(path) ||
      windowsUNC.test(path) ||
      windowsRelative.test(path) ||
      unixAbsolute.test(path) ||
      unixHome.test(path) ||
      unixRelative.test(path) ||
      genericRelative.test(path)
  );
}
