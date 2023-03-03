export class DefaultMap<K, V> extends Map<K, V> {
    constructor(private defaultValue: V) {
        super();
    }

    setDefault(key: K): V {
        let v = this.get(key);
        if (typeof v === "undefined") {
            let copyDefaultValue =
                typeof this.defaultValue === "object"
                    ? Object.assign({}, this.defaultValue)
                    : this.defaultValue;
            this.set(key, copyDefaultValue);
            return this.get(key) || copyDefaultValue;
        }
        return v;
    }

    // It's not feasible to modify the value of getDefault
    getDefault(key: K): V {
        let v = this.get(key);
        if (typeof v === "undefined") {
            return typeof this.defaultValue === "object"
                ? Object.assign({}, this.defaultValue)
                : this.defaultValue;
        }
        return v;
    }
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
export const asDefaultMap = <K, T>(defaultValue: T) => new DefaultMap<K, T>(defaultValue);
