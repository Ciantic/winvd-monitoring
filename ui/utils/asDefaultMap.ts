export class DefaultMap<K, V> extends Map<K, V> {
    constructor(private makeDefault: () => V) {
        super();
    }

    // Return type is mutable default value
    getDefault(key: K): V {
        const v = this.get(key);
        if (typeof v === "undefined") {
            return this.set(key, this.makeDefault()).get(key) || this.makeDefault();
        }
        return v;
    }

    // setWithOldValue(key: K, value: (old: V) => V): V {}

    // // It's not feasible to modify the value of getDefault
    // getDefault(key: K): Readonly<V> {
    //     let v = this.get(key);
    //     if (typeof v === "undefined") {
    //         return this.defaultValue();
    //     }
    //     return v;
    // }
    toJSON() {
        const res: any = {};
        for (const [key, value] of this as any) {
            // We lie about symbol key types due to https://github.com/Microsoft/TypeScript/issues/1863
            res[typeof key === "symbol" ? <any>key : stringifyKey(key)] = value;
        }
        return res;
    }
    merge(other: { [key: string]: V }) {
        Object.keys(other).forEach((key) => this.set(key as any as K, other[key]));
    }
}

function stringifyKey(key: any): string {
    if (key && key.toString) return key.toString();
    else return new String(key).toString();
}
export const asDefaultMap = <K, T>(defaultValue: () => T) => new DefaultMap<K, T>(defaultValue);
