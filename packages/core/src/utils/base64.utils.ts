import { fileTypeFromBuffer } from 'file-type';
import { MAX_FILE_SIZE } from '@sre/constants';

/**
 * This function converts a text string to a base64 URL.
 * @param text
 * @returns
 */
export function textToBase64Url(text) {
    // Create a Buffer from the string
    const buffer = Buffer.from(text, 'utf-8');

    // Convert the Buffer to a base64 string
    const base64String = buffer.toString('base64');

    // Construct the data URL
    const base64Url = `data:text/plain;base64,${base64String}`;

    return base64Url;
}

//=== Legacy code below ===
//@Forhad the functions below need to be reviewed and refactored

/**
 ** It's common practice to split base64 data into multiple lines for better readability and to avoid issues with systems that can't handle very long lines.
 ** So we need to clean up newline characters from the base64 data before processing it.
 * @param {string} str - The input string.
 * @returns {string} The input string with all newline characters and escaped newline strings removed.
 */
const _cleanUpBase64Data = (str: string): string => {
    // Check if the input is a string and is not excessively large
    if (typeof str !== 'string' || str.length > MAX_FILE_SIZE) {
        throw new Error('Invalid input');
    }

    // Remove all whitespace characters and literal \n and \s sequences
    return str.replace(/\s|\\n|\\s/g, '');
};

export const isBase64 = (str: string): boolean => {
    if (!str || !(typeof str === 'string')) return false;

    str = _cleanUpBase64Data(str);

    try {
        // * sometimes word like 'male' and hash like md5, sha1, sha256, sha512 are detected as base64
        if (str?.length < 128) return false;

        const buffer = Buffer.from(str, 'base64');

        return buffer.toString('base64').replace(/=+$/, '') === str.replace(/=+$/, '');
    } catch {
        return false;
    }
};

export const isBase64FileUrl = (url: string): boolean => {
    if (typeof url !== 'string') return false;

    const regex = /^data:([\w+\-\.]+\/[\w+\-\.]+);base64,(.*)$/;
    const match = url.match(regex);
    if (!match) return false;
    const [, , base64Data] = match;

    return isBase64(base64Data);
};

export const getMimetypeFromBase64Data = async (data: string) => {
    try {
        data = _cleanUpBase64Data(data);

        // Convert the base64 string back to a Buffer
        const imageBuffer = Buffer.from(data, 'base64');

        const type = await fileTypeFromBuffer(imageBuffer);
        return type?.mime || '';
    } catch (error) {
        console.error('Error getting mimetype from base64 data: ', error);
        return '';
    }
};

export const getSizeOfBase64 = (str: string): number => {
    try {
        const buffer = Buffer.from(str, 'base64');
        return buffer.byteLength;
    } catch {
        return 0;
    }
};

export const makeBase64Url = (data: string, mimetype: string = 'application/octet-stream'): string => {
    if (!data || typeof data !== 'string') return '';

    return `data:${mimetype};base64,${data.replace(/\n/g, '')}`;
};

export async function extractBase64DataAndMimeType(data: string): Promise<{ data: string; mimetype: string }> {
    if (typeof data !== 'string' || data?.length > MAX_FILE_SIZE) {
        return { data: '', mimetype: '' };
    }

    if (isBase64FileUrl(data)) {
        const regex = /^data:([^;]+);base64,(.*)$/;
        const match = data.match(regex);
        if (!match) return { data: '', mimetype: '' };
        const [, mimetype, base64Data] = match;

        return { data: _cleanUpBase64Data(base64Data), mimetype };
    } else if (isBase64(data)) {
        return { data: _cleanUpBase64Data(data), mimetype: await getMimetypeFromBase64Data(data) };
    }

    return { data: '', mimetype: '' };
}
