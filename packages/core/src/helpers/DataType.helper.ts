import dayjs from 'dayjs';
import { jsonrepair } from 'jsonrepair';
import { isBase64, isBase64FileUrl } from '@sre/utils/base64.utils';
import { SmythFile } from '@sre/IO/Storage/SmythFile.class';
import { isBinaryData, isBuffer, isPlainObject, isSmythFileObject } from '../utils';
import { parseJson } from '@sre/services/utils';

export function isJson(str: string): boolean {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export const isUrlArray = (stringifiedTxt): boolean => {
    if (!stringifiedTxt) return false;

    try {
        const urls = JSON.parse(stringifiedTxt);

        if (!Array.isArray(urls)) return false;

        return true;
    } catch (error) {
        return false;
    }
};

const isNumber = (str: string): boolean => {
    if (typeof str === 'number') return true;

    if (typeof str !== 'string') return false;

    const numRegex = /^-?\d+(\.\d+)?$/;
    return numRegex.test(str.trim());
};

const isValidNumber = (str: string): boolean => {
    const num = parseFloat(str);
    return !isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER && num.toString() === str.trim();
};

function parseArray(val: any): any[] | undefined {
    if (Array.isArray(val)) return val;
    if (typeof val !== 'string') throw new Error('Invalid Array value');

    try {
        // We need to consider array with comma separated values like "item1, item2, item3", as it's provided by Swagger UI
        return val.trim().startsWith('[') ? parseJson(val) : val.split(',');
    } catch {
        throw new Error('Invalid Array value');
    }
}

export const inputErrMsg = (type, name) => `Invalid ${type} value for Input: ${name}`;
export async function ensureStrongDataType(inputs: Record<string, any>, inputConfig: Record<string, any>[]): Promise<Record<string, any>> {
    try {
        if (!inputConfig || Object.keys(inputConfig)?.length === 0) return inputs;

        // Clone the input object to avoid modifying the original object
        const _inputs = { ...inputs };
        const _inputConfig = {};

        for (const input of inputConfig) {
            if (input?.name) {
                _inputConfig[input.name] = { ...input };
            }
        }

        for (const [key, config] of Object.entries(_inputConfig)) {
            let value = inputs?.[key] || '';

            if (!value) continue;

            const type = (config as any)?.type?.toLowerCase();

            switch (type) {
                case 'string':
                    if (value === null || value === undefined || value === 'null' || value === 'undefined') {
                        _inputs[key] = '';
                    } else if (isBase64(value) || isBase64FileUrl(value)) {
                        // If the value is a base64 string then return the value as it is
                        _inputs[key] = value;
                    } else if (isSmythFileObject(value) || isBuffer(value) || isBinaryData(value)) {
                        const file = new SmythFile(value);
                        const base64Obj = await file.toBase64Object();
                        _inputs[key] = `data:${base64Obj.mimetype};base64,${base64Obj.base64}`;
                    } else if (typeof value === 'object' || Array.isArray(value)) {
                        _inputs[key] = JSON.stringify(value);
                    } else {
                        _inputs[key] = String(value);
                    }
                    break;
                case 'number':
                    const floatVal = parseFloat(value);

                    if (isNaN(floatVal)) throw new Error(inputErrMsg('Number', key));

                    _inputs[key] = floatVal;
                    break;
                case 'integer':
                    const intVal = parseInt(value);

                    if (isNaN(intVal)) throw new Error(inputErrMsg('Integer', key));

                    _inputs[key] = intVal;
                    break;
                case 'boolean':
                    if (typeof value === 'boolean') {
                        _inputs[key] = value;
                    } else if (typeof value === 'string' || typeof value === 'number') {
                        const lowerCaseValue = String(value).toLowerCase();
                        if (['true', '1'].includes(lowerCaseValue)) {
                            _inputs[key] = true;
                        } else if (['false', '0'].includes(lowerCaseValue)) {
                            _inputs[key] = false;
                        } else {
                            throw new Error(inputErrMsg('Boolean', key));
                        }
                    } else {
                        throw new Error(inputErrMsg('Boolean', key));
                    }
                    break;
                case 'array':
                    try {
                        let arr = Array.isArray(value) ? value : parseArray(value);

                        if (!Array.isArray(arr)) {
                            throw new Error(inputErrMsg('Array', key));
                        }

                        _inputs[key] = arr;
                    } catch (error) {
                        throw new Error(inputErrMsg('Array', key));
                    }
                    break;
                case 'object':
                    try {
                        // use parseJson instead of JSON.parse because the data may come from LLM responses
                        const obj = isPlainObject(value) ? value : parseJson(value);
                        if (!isPlainObject(obj)) throw new Error(inputErrMsg('Object', key));
                        _inputs[key] = obj;
                    } catch (error) {
                        throw new Error(inputErrMsg('Object', key));
                    }
                    break;
                case 'binary':
                    const data = value;
                    const file = data instanceof SmythFile ? data : new SmythFile(data);
                    _inputs[key] = file;
                    break;
                case 'date':
                    const errMsg = `${inputErrMsg(
                        'Date',
                        key
                    )}\nThe date string is expected to be in a format commonly used in English-speaking countries.`;

                    // Make sure we only accept string or number to parse as date
                    if (typeof value !== 'string' && typeof value !== 'number') throw new Error(errMsg);

                    let date;
                    if (typeof value === 'string' && isNaN(Number(value))) {
                        date = dayjs(value).locale('en'); // parse as date string
                    } else {
                        // parse as Unix timestamp
                        const timestamp = typeof value === 'number' ? value : Number(value);
                        date = dayjs.unix(timestamp / 1000);
                    }

                    if (!date.isValid()) throw new Error(errMsg);

                    _inputs[key] = date.toISOString();

                    break;
                case 'any': // We need to keep the data as it is for any
                    break;
                default:
                    break;
            }
        }

        return _inputs;
    } catch (error) {
        throw error;
    }
}
