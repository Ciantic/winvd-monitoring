export class DefaultMap<K, V> extends Map<K, V> {
    constructor(private defaultValue: V) {
        super();
    }

    // Same as getDefault but with a mutable return type
    setDefault(key: K): V {
        let v = this.get(key);
        if (typeof v === "undefined") {
            let copyDefaultValue;
            if (this.defaultValue instanceof Map && this.defaultValue.size === 0) {
                copyDefaultValue = new Map() as V;
            } else if (this.defaultValue instanceof Set && this.defaultValue.size === 0) {
                copyDefaultValue = new Set() as V;
            } else {
                copyDefaultValue =
                    typeof this.defaultValue === "object"
                        ? Object.assign({}, this.defaultValue)
                        : this.defaultValue;
            }
            this.set(key, copyDefaultValue);
            return this.get(key) || copyDefaultValue;
        }
        return v;
    }

    setWithOldValue(key: K, value: (old: V) => V): V {
        
    }

    // It's not feasible to modify the value of getDefault
    getDefault(key: K): Readonly<V> {
        let v = this.get(key);
        if (typeof v === "undefined") {
            if (this.defaultValue instanceof Map && this.defaultValue.size === 0) {
                return new Map() as V;
            }
            if (this.defaultValue instanceof Set && this.defaultValue.size === 0) {
                return new Set() as V;
            }
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
