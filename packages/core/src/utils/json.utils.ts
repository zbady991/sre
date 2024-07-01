import { jsonrepair } from 'jsonrepair';
import { isNumber, isValidNumber } from './numbers.utils';

export function extractJsonFromString(str) {
    try {
        const regex = /(\{.*\})/s;

        const match = str.match(regex);

        return match?.[1];
    } catch {
        return null;
    }
}

export function parseRepairJson(strInput: string) {
    if (!strInput) return strInput;
    let str = (this.extractJsonFromString(strInput) || strInput).trim();

    if ((isNumber(str) && !isValidNumber(str)) || (!str.startsWith('{') && !str.startsWith('['))) return str;

    try {
        return { result: JSON.parse(str) };
    } catch (e) {
        try {
            return { result: JSON.parse(jsonrepair(str)) };
        } catch (e: any) {
            console.warn('Error on parseJson: ', e.toString());
            console.warn('   Tried to parse: ', str);
            throw new Error('Failed to parse JSON ' + e.toString());
        }
    }
}
