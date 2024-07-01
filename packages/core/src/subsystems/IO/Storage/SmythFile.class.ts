import axios from 'axios';
import fs from 'fs';
import mime, { Mime } from 'mime';
import { promisify } from 'util';
import config from '@sre/config';
import { MAX_FILE_SIZE } from '@sre/constants';
import {
    extractBase64DataAndMimeType,
    getSizeFromBinary,
    isBase64,
    isBase64FileUrl,
    isBase64Object,
    isBinaryData,
    isBinaryMimeType,
    isBuffer,
    isBufferObject,
    isPlainObject,
    isSmythFileObject,
    isUrl,
    uid,
} from '@sre/utils';
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { SmythFS } from './SmythFS.class';

export type SmythFileObject = {
    mimetype: string;
    size: number;
    url: string;
    error?: string;
};

type BufferObject = {
    filename: string;
    mimetype: string;
    size: number;
    buffer: Buffer | null;
};

type Base64Object = {
    mimetype: string;
    size: number;
    base64: string;
};

type _Error = {
    type: string;
    message: string;
};

type _Data = Blob | SmythFileObject | ArrayBuffer | string;

export type Metadata = {
    teamid: string;
    agentid: string;
    userid?: string;
    acl?: string;
};

interface StringReaderParams {
    str?: string;
    outputType: 'Blob' | 'SmythFileObject' | 'BufferObject' | 'Base64Object';
    metadata?: Metadata;
    baseUrl?: string;
}

type StringReaderOutput = {
    data?: Blob | SmythFileObject | BufferObject | Base64Object | string;
    error?: _Error;
};
const MAX_SIZE_ERROR = `File size is too big. Maximum file size allowed is ${MAX_FILE_SIZE / 1000000} MB`;
const customMime = new Mime({ 'audio/flac': ['flac'], 'application/x-rar': ['rar'] });

const TEMP_DIR = config?.env?.DATA_PATH + '/temp';

const writeFile = promisify(fs.writeFile);

class MaxSizeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MaxSizeError';
    }
}

class InvalidInputError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidInputError';
    }
}

class UnknownError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UnknownError';
    }
}

export const getFileContentFromUrl = async (url: string): Promise<{ mimetype: string; content: Buffer | null }> => {
    if (!url) return { mimetype: '', content: null };

    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const data = response.data || '';
        const buffer = Buffer.from(data, 'binary');

        return { mimetype: response.headers['content-type'], content: buffer };
    } catch (error) {
        console.log(`Error in getFileContentFromUrl function for ${url} `, error, '\n');

        return { mimetype: '', content: null };
    }
};
export class SmythFile {
    public mimetype: string = 'application/octet-stream';
    public size: number = 0;
    #data;

    constructor(data: _Data, mimetype?: string) {
        if (!SmythRuntime.Instance?.ready()) {
            throw new Error('SRE not available');
        }
        const isValidType = [
            data instanceof Blob,
            isSmythFileObject(data),
            data instanceof ArrayBuffer,
            isBuffer(data),
            typeof data === 'string' && (isBase64FileUrl(data) || isBase64(data) || isUrl(data)),
        ].some(Boolean);

        if (!isValidType) {
            throw new Error('ERR_MSG_INVALID_BINARY');
        }

        // Initialization, set data, mimetype and size of the file
        this.init(data, mimetype);
    }
    private init(data: _Data, mimetype?: string) {
        this.#data = data;

        if (data instanceof Blob) {
            this.mimetype = data.type;
            this.size = data.size;
        } else if (isSmythFileObject(data as SmythFileObject)) {
            this.mimetype = (data as SmythFileObject).mimetype;
            this.size = (data as SmythFileObject).size;
        } else if (isBuffer(data) || isBinaryMimeType(mimetype) || isBinaryData(data)) {
            this.mimetype = mimetype || this.mimetype;
            this.size = getSizeFromBinary(data);
        } else if (typeof data === 'string') {
            this.#data = data.trim();
            this.mimetype = mimetype || this.mimetype;
            this.size = Buffer.byteLength(data);
        }

        if (this.size > MAX_FILE_SIZE) {
            throw new MaxSizeError(MAX_FILE_SIZE);
        }
    }

    private getExtension(mimetype?: string) {
        if (!mimetype) mimetype = this.mimetype;

        const extension = mime.getExtension(mimetype) || customMime.getExtension(mimetype);

        return extension;
    }

    private generateFilename(extension?: string | null) {
        const name = uid().toLowerCase();

        return `${name}${extension ? '.' + extension : ''}`;
    }

    private async saveFileToSmythStorage(body, metadata) {
        const extension = this.getExtension();
        const filename = this.generateFilename(extension);

        //FIXME : not implemented, implement using SmythFS
        console.warn('Save file to Smyth Storage not implemented');

        return { filename };
    }

    private async bufferToSmythFileObj(buffer: Buffer, metadata: Metadata, baseUrl: string): Promise<SmythFileObject> {
        // input validation
        if (!buffer) throw new Error('Buffer is required to convert to SmythFileObject');
        if (!metadata || Object.keys(metadata).length === 0) {
            throw new Error('Metadata is required to convert to SmythFileObject');
        }
        if (!metadata?.teamid) throw new Error('Team ID is required to convert to SmythFileObject');
        if (!baseUrl) throw new Error('Base URL is required to convert to SmythFileObject');

        try {
            const saveFile = await this.saveFileToSmythStorage(buffer, metadata);
            const smythFileObj = {
                mimetype: this.mimetype,
                size: this.size,
                url: SmythFile.generateTempPublicUrl({
                    filename: saveFile.filename,
                    baseUrl,
                }),
            };
            return smythFileObj;
        } catch (error: any) {
            throw error;
        }
    }

    private async bufferToBlob(buffer: Buffer) {
        try {
            const blob = new Blob([buffer], { type: this.mimetype });

            return blob;
        } catch (error: any) {
            throw error;
        }
    }

    private async urlOrBase64ToBuffer(str: string): Promise<{ buffer: Buffer | null; mimetype: string }> {
        let buffer: Buffer | null;
        let mimetype: string;

        try {
            if (isUrl(str)) {
                const file = await getFileContentFromUrl(str);

                buffer = file?.content as Buffer;
                mimetype = file?.mimetype || '';
            } else {
                let { data: base64Data, mimetype: extractedMimeType } = await extractBase64DataAndMimeType(str);

                if (!base64Data) return { buffer: null, mimetype: '' };

                buffer = Buffer.from(base64Data, 'base64');
                mimetype = extractedMimeType;
            }

            return {
                buffer,
                mimetype,
            };
        } catch {
            return {
                buffer: null,
                mimetype: '',
            };
        }
    }

    private async stringReader({ str, outputType, metadata, baseUrl }: StringReaderParams): Promise<StringReaderOutput> {
        let mimetype: string = '';
        if (!str) {
            str = this.#data;

            // In case SmythFile is initialized with base64 data and mimetype
            mimetype = this.mimetype;
        }

        try {
            const { buffer, mimetype: extractedMimeType } = await this.urlOrBase64ToBuffer(str as string);
            if (!buffer) return { data: str };

            // Check file size, return error if file size is greater than component maximum file size
            const size = buffer.byteLength || 0;
            if (size > MAX_FILE_SIZE) {
                return {
                    error: {
                        type: 'MAX_SIZE_ERROR',
                        message: MAX_SIZE_ERROR,
                    },
                };
            }

            // Set mimetype and size
            this.mimetype = extractedMimeType || mimetype;
            this.size = size;

            switch (outputType) {
                case 'SmythFileObject':
                    return {
                        data: await this.bufferToSmythFileObj(buffer, metadata as Metadata, baseUrl as string),
                    };
                case 'Blob':
                    return {
                        data: await this.bufferToBlob(buffer),
                    };
                case 'BufferObject':
                    return {
                        data: {
                            filename: this.generateFilename(this.getExtension(this.mimetype)),
                            mimetype: this.mimetype,
                            size: this.size,
                            buffer,
                        },
                    };
                case 'Base64Object':
                    return {
                        data: {
                            mimetype: this.mimetype,
                            size: this.size,
                            base64: buffer.toString('base64'),
                        },
                    };
                default:
                    return { data: str };
            }
        } catch (error: any) {
            return { error };
        }
    }

    /**
     * Convert to SmythFileObject
     * @returns {SmythFileObject | any} 'any' for - if no conversion is possible
     */
    public async toSmythFileObject({ metadata, baseUrl }: { metadata: Metadata; baseUrl: string }): Promise<SmythFileObject | any> {
        if (!this.#data) return '';

        try {
            if (isSmythFileObject(this.#data)) {
                // return if data is already a SmythFileObject
                return this.#data;
            } else if (this.#data instanceof Blob || isBuffer(this.#data)) {
                let buffer: Buffer | ArrayBuffer;

                if (this.#data instanceof Blob) {
                    buffer = await this.#data.arrayBuffer();
                } else {
                    buffer = Buffer.from(this.#data);
                }

                const saveFile = await this.saveFileToSmythStorage(buffer, metadata);

                const result: SmythFileObject = {
                    mimetype: this.mimetype,
                    size: this.size,
                    url: SmythFile.generateTempPublicUrl({
                        filename: saveFile.filename,
                        baseUrl,
                    }),
                };

                return result;
            } else if (typeof this.#data === 'string') {
                const readStr = await this.stringReader({
                    outputType: 'SmythFileObject',
                    metadata,
                    baseUrl,
                });

                if (readStr?.error) {
                    if (readStr?.error?.type === 'MAX_SIZE_ERROR') {
                        throw new MaxSizeError(readStr.error?.message);
                    } else {
                        throw new UnknownError(readStr.error?.message);
                    }
                }

                return readStr?.data;
            } else if (isPlainObject(this.#data)) {
                const newObj = {};

                for (const key in this.#data) {
                    const value = this.#data[key];

                    this.init(value);

                    newObj[key] = await this.toSmythFileObject({ metadata, baseUrl });
                }

                return newObj;
            } else if (Array.isArray(this.#data)) {
                const newArr: any[] = [];

                for (const value of this.#data) {
                    this.init(value);
                    newArr.push(this.toSmythFileObject({ metadata, baseUrl }));
                }

                return Promise.all(newArr);
            }

            // return data as it is, if no conversion is possible
            return this.#data;
        } catch (error: any) {
            console.log('Error converting to SmythFileObject: ', error);

            let msg = 'Something went wrong, please try again later.';

            if (error instanceof MaxSizeError || error instanceof InvalidInputError || error instanceof UnknownError) {
                msg = error?.message || '';
            }

            throw new Error(msg);
        }
    }

    public async toBlob(): Promise<Blob | any> {
        if (!this.#data) return '';

        try {
            if (this.#data instanceof Blob) {
                // return if data is already a Blob
                return this.#data;
            } else if (isSmythFileObject(this.#data) || typeof this.#data === 'string') {
                const str = isSmythFileObject(this.#data) ? this.#data.url : this.#data;

                const readStr = await this.stringReader({ str, outputType: 'Blob' });

                if (readStr?.error) {
                    if (readStr?.error?.type === 'MAX_SIZE_ERROR') {
                        throw new MaxSizeError(readStr.error?.message);
                    } else {
                        throw new UnknownError(readStr.error?.message);
                    }
                }

                return readStr.data;
            } else if (isBuffer(this.#data)) {
                const buffer = Buffer.from(this.#data);
                const blob = new Blob([buffer], { type: this.mimetype });
                return blob;
            } else if (isPlainObject(this.#data)) {
                const newObj = {};

                for (const key in this.#data) {
                    const value = this.#data[key];

                    this.init(value);

                    newObj[key] = await this.toBlob();
                }

                return newObj;
            } else if (Array.isArray(this.#data)) {
                const newArr: any[] = [];

                for (const value of this.#data) {
                    this.init(value);

                    newArr.push(this.toBlob());
                }

                return Promise.all(newArr);
            }

            // return data as it is, if no conversion is possible
            return this.#data;
        } catch (error) {
            console.log('Error converting to Blob: ', error);

            let msg = 'Something went wrong, please try again later.';

            if (error instanceof MaxSizeError || error instanceof InvalidInputError || error instanceof UnknownError) {
                msg = error?.message || '';
            }

            throw new Error(msg);
        }
    }

    public async toBufferObject(): Promise<BufferObject | any> {
        let result: BufferObject = {
            filename: this.generateFilename(this.getExtension()),
            mimetype: this.mimetype,
            size: this.size,
            buffer: null,
        };

        if (!this.#data) return '';

        try {
            if (isBufferObject(this.#data)) {
                // return if data is already a BufferObject
                return this.#data;
            } else if (isBuffer(this.#data)) {
                result.buffer = this.#data;

                return result;
            } else if (this.#data instanceof Blob) {
                const arrayBuffer = await this.#data.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                result.buffer = buffer;

                return result;
            } else if (isSmythFileObject(this.#data) || typeof this.#data === 'string') {
                const str = isSmythFileObject(this.#data) ? this.#data.url : this.#data;

                const readStr = await this.stringReader({ str, outputType: 'BufferObject' });

                if (readStr?.error) {
                    if (readStr?.error?.type === 'MAX_SIZE_ERROR') {
                        throw new MaxSizeError(readStr.error?.message);
                    } else {
                        throw new UnknownError(readStr.error?.message);
                    }
                }

                return readStr.data;
            } else if (isPlainObject(this.#data)) {
                const newObj = {};

                for (const key in this.#data) {
                    const value = this.#data[key];

                    this.init(value);

                    newObj[key] = await this.toBufferObject();
                }

                return newObj;
            } else if (Array.isArray(this.#data)) {
                const newArr: any[] = [];

                for (const value of this.#data) {
                    this.init(value);
                    newArr.push(this.toBufferObject());
                }

                return Promise.all(newArr);
            }

            // return data as it is, if no conversion is possible
            return this.#data;
        } catch (error) {
            console.log('Error converting to BufferObject: ', error);

            let msg = 'Something went wrong, please try again later.';

            if (error instanceof MaxSizeError || error instanceof InvalidInputError || error instanceof UnknownError) {
                msg = error?.message || '';
            }

            throw new Error(msg);
        }
    }

    public async toBase64Object() {
        let result: Base64Object = {
            mimetype: this.mimetype,
            size: this.size,
            base64: '',
        };

        if (!this.#data) return '';

        try {
            if (isBase64Object(this.#data)) {
                // return if data is already a Base64Object
                return this.#data;
            } else if (isBuffer(this.#data)) {
                result.base64 = this.#data.toString('base64');

                return result;
            } else if (this.#data instanceof Blob) {
                const arrayBuffer = await this.#data.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                result.base64 = buffer.toString('base64');

                return result;
            } else if (isSmythFileObject(this.#data) || typeof this.#data === 'string') {
                const str = isSmythFileObject(this.#data) ? this.#data.url : this.#data;

                const readStr = await this.stringReader({ str, outputType: 'Base64Object' });

                if (readStr?.error) {
                    if (readStr?.error?.type === 'MAX_SIZE_ERROR') {
                        throw new MaxSizeError(readStr.error?.message);
                    } else {
                        throw new UnknownError(readStr.error?.message);
                    }
                }

                return readStr.data;
            } else if (isPlainObject(this.#data)) {
                const newObj = {};

                for (const key in this.#data) {
                    const value = this.#data[key];

                    this.init(value);

                    newObj[key] = await this.toBase64Object();
                }

                return newObj;
            } else if (Array.isArray(this.#data)) {
                const newArr: any[] = [];

                for (const value of this.#data) {
                    this.init(value);
                    newArr.push(this.toBase64Object());
                }

                return Promise.all(newArr);
            }

            // return data as it is, if no conversion is possible
            return this.#data;
        } catch (error) {
            console.log('Error converting to Base64Object: ', error);

            let msg = 'Something went wrong, please try again later.';

            if (error instanceof MaxSizeError || error instanceof InvalidInputError || error instanceof UnknownError) {
                msg = error?.message || '';
            }

            throw new Error(msg);
        }
    }

    public async toFsReadStream() {
        const bufferObject = await this.toBufferObject();

        if ('data' in bufferObject && bufferObject?.data) {
            const buffer = bufferObject?.data;
            const extension = this.getExtension(bufferObject?.mimetype);

            const file = `${TEMP_DIR}/${this.generateFilename(extension)}`;

            await writeFile(file, buffer);

            const stream = fs.createReadStream(file);

            return stream;
        }
    }

    public static generateTempPublicUrl({ filename, baseUrl }) {
        return `${baseUrl}/storage/pub/smyth/teams/files/temp/${filename}`;
    }
}
