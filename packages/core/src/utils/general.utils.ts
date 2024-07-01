export function uid() {
    return (Date.now() + Math.random()).toString(36).replace('.', '').toUpperCase();
}

/**
 * this function is used to check if a class is a subclass of another class
 * @param subClass
 * @param superClass
 * @returns
 */
export function isSubclassOf(subClass: any, superClass: any): boolean {
    if (typeof subClass !== 'function' || typeof superClass !== 'function') {
        return false;
    }

    let prototype = Object.getPrototypeOf(subClass.prototype);
    let depth = 10;

    while (prototype && depth >= 0) {
        if (prototype === superClass.prototype) {
            return true;
        }
        prototype = Object.getPrototypeOf(prototype);
        depth++;
    }

    return false;
}
