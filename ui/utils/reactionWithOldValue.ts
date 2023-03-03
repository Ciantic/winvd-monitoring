import { reaction } from "https://esm.sh/mobx";
import { isEqual } from "https://cdn.skypack.dev/lodash?dts";

export const reactionWithOldValue = <T>(
    defaultValue: T,
    expression: () => T,
    effect: (newValue: T, oldValue: T) => void
) => {
    let oldValue: T = defaultValue;
    return reaction(expression, (v) => {
        if (!isEqual(v, oldValue)) {
            effect(v, oldValue);
            oldValue = v;
        }
    });
};
