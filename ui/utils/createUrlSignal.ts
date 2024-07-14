import { Signal, createSignal, createEffect } from "npm:solid-js";

/**
 * Stores the value in the URL (query string) and updates it when the value changes.
 */
export function createUrlSignal<T>(initialValue: T, name: string): Signal<T> {
    let setValue = initialValue;
    {
        const parsed = new URLSearchParams(window.location.search);
        if (typeof initialValue === "string") {
            setValue = (parsed.get(name) as T) ?? initialValue;
        } else if (typeof initialValue === "number") {
            setValue = Number(parsed.get(name) ?? initialValue) as T;
        } else {
            throw new Error("Unsupported type");
        }
    }

    const [getter, setter] = createSignal(setValue, {
        name,
    });
    createEffect(() => {
        const v = getter();
        if (v !== initialValue) {
            const parsed = new URLSearchParams(window.location.search);
            parsed.set(name, "" + v);
            window.history.replaceState(null, "", `?${parsed.toString()}`);
        } else {
            const parsed = new URLSearchParams(window.location.search);
            parsed.delete(name);
            window.history.replaceState(null, "", `?${parsed.toString()}`);
        }
    });
    return [getter, setter];
}
