import { reaction } from "https://esm.sh/mobx";

function isEqual(a: any, b: any) {
    return JSON.stringify(a) === JSON.stringify(b);
}

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
        } else {
            // TODO: I don't remembe why I made this function, reaction should
            // suffice if this branch never happens?
            console.log("Does this even happen?");
        }
    });
};
