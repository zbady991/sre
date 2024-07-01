import { jsonrepair } from 'jsonrepair';

import { createLogger } from '@sre/Core/Logger';
const console = createLogger('___FILENAME___');

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

export function parseJson(str) {
    if (!str) return str;

    if ((isNumber(str) && !isValidNumber(str)) || (!str.trim().startsWith('{') && !str.trim().startsWith('['))) return str;

    try {
        return JSON.parse(str);
    } catch (e) {
        // str = extractJsonFromString(str) || str;

        try {
            return JSON.parse(jsonrepair(str));
        } catch (e: any) {
            console.warn('Error on parseJson: ', e.toString());
            console.warn('   Tried to parse: ', str);
            return { result: str, error: e.toString() };
        }
    }
}

export const isTemplateVar = (str: string = ''): boolean => {
    if (!str || typeof str !== 'string') return false;
    return (str?.match(/{{(.*?)}}/g) ?? []).length > 0;
};
export const isKeyTemplateVar = (str: string = ''): boolean => {
    if (!str || typeof str !== 'string') return false;
    return (str?.match(/{{KEY\((.*?)\)}}/g) ?? []).length > 0;
};

export function parseTemplate(str, obj, { escapeString = true, processUnmatched = true, unmached = '' } = {}) {
    try {
        const parsed = str?.replace(/{{(.*?)}}/g, function (match, varName) {
            // if key template var, return as is
            if (isKeyTemplateVar(match)) return match;

            let objVal = obj[varName.trim()];

            if (typeof objVal === 'object') {
                objVal = JSON.stringify(objVal);
            } else {
                if (escapeString && typeof objVal === 'string') {
                    //escape double quotes, slashes ...
                    objVal = objVal?.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
                }
            }

            const val = objVal || match;

            return typeof val == 'string' || typeof val == 'number' ? val : JSON.stringify(val);
        });

        //replace unmached vars with default value, make sure to ignore the key template var
        return str == parsed && processUnmatched ? parsed?.replace(/{{(?!KEY\().*?}}/g, unmached) : parsed;
    } catch (err) {
        console.log('Error on parse template: ', err);

        return str;
    }
}

export async function parseKey(str: string, teamId: string): Promise<string> {
    console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.warn('parseKey() : NOT IMPLEMENTED');
    return str;
}

export function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
