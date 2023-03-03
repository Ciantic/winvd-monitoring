import { useState, useCallback } from "https://esm.sh/preact/hooks";
import produce, { freeze } from "https://esm.sh/immer";

export function useImmer<S>(initialValue: S): [S, (updater: (draft: S) => void) => void] {
    const [val, updateValue] = useState(() =>
        freeze(typeof initialValue === "function" ? initialValue() : initialValue, true)
    );
    return [
        val,
        useCallback((updater: any) => {
            if (typeof updater === "function") updateValue(produce(updater));
            else updateValue(freeze(updater));
        }, []),
    ];
}
