export function minMaxValue<T>(
    values: T[],
    getValue: (item: T) => number
): [T | undefined, T | undefined] {
    return values.reduce(
        (acc, x) => {
            const value = getValue(x);
            if (value < getValue(acc[0])) {
                acc[0] = x;
            }
            if (value > getValue(acc[1])) {
                acc[1] = x;
            }
            return acc;
        },
        [values[0], values[0]] as [T, T]
    );
}
