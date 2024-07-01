import { jsonrepair } from 'jsonrepair';
import { isNumber, isValidNumber } from '@sre/utils';

export class JSONContentHelper {
    private _current: string;

    public get result() {
        return this._current;
    }
    private constructor(private dataString: string) {
        this._current = dataString;
    }

    public static create(dataString: string) {
        return new JSONContentHelper(dataString);
    }

    public async parse() {
        const strInput = this._current;
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

    private extractJsonFromString(str) {
        try {
            const regex = /(\{.*\})/s;

            const match = str.match(regex);

            return match?.[1];
        } catch {
            return null;
        }
    }
}

export function JSONContent(dataString: string) {
    return JSONContentHelper.create(dataString);
}
