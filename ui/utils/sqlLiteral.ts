type SqlQuery = {
    sql: string;
    params: unknown[];
};

type Values = { sqlValues: SqlTypes[] };

type SqlTypes = boolean | string | number | SqlQuery | null | Values | SqlTypes[];

function sqlStr(value: SqlTypes): {
    sql: string;
    params: unknown[];
} {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return {
            sql: "?",
            params: [value],
        };
    }
    if (value === null) {
        return {
            sql: "?",
            params: [null],
        };
    }
    if (typeof value === "object" && "sql" in value) {
        return {
            sql: value.sql,
            params: value.params,
        };
    }
    if (typeof value === "object" && "sqlValues" in value) {
        const foo = (value.sqlValues as SqlTypes[]).map((v: SqlTypes) => sqlStr(v));

        return {
            sql: "VALUES " + foo.map((f) => f.sql).join(",") + "",
            params: foo.map((f) => f.params).flat(),
        };
    }
    if (Array.isArray(value)) {
        return {
            sql:
                "(" +
                value
                    .map((v: SqlTypes) => sqlStr(v))
                    .map((v) => v.sql)
                    .join(",") +
                ")",
            params: value
                .map((v) => sqlStr(v))
                .map((v) => v.params)
                .flat(),
        };
    }
    if (typeof value === "undefined") {
        return {
            sql: "",
            params: [],
        };
    } else {
        throw new Error("Invalid sql value");
    }
}

function sqlValues(...sqlValues: SqlTypes[][]): Values {
    return {
        sqlValues,
    };
}

export function sql(strings: TemplateStringsArray, ...values: SqlTypes[]) {
    let sql = "";
    let params: unknown[] = [];

    for (let i = 0; i < strings.length; i++) {
        sql += strings[i];
        if (i < values.length) {
            const value = values[i];
            const str = sqlStr(value);
            sql += str.sql;
            params = params.concat(str.params);
        }
    }
    return {
        sql,
        params,
    };
}

function cond(strings: TemplateStringsArray, ...values: (SqlTypes | undefined)[]) {
    // If any of the values is undefined
    if (values.some((v) => typeof v === "undefined")) {
        return {
            sql: "",
            params: [],
        };
    }
    return sql(strings, ...(values as SqlTypes[]));
}

/**
 * Generates VALUES clause from array of arrays.
 *
 * **Example:**
 *
 * ```ts
 * sql`SELECT * FROM table WHERE id IN (${sql.values([1, 2], [3, 4])});`
 * sql`INSERT INTO t2(x,y,z) ${sql.values([1, 2, 3], [2, 3, 4], [1, null, 5])};`
 * ```
 * Generates
 * ```sql
 * SELECT * FROM table WHERE id IN (VALUES (?, ?), (?, ?));
 * INSERT INTO t2(x,y,z) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?);
 * ```
 *
 * Normally you would use this with `sql` template literal with array input for
 * `IN` statement but it generates also the parentheses.
 */
sql.values = sqlValues;

/**
 * If any of the values is undefined, the result is empty string. Useful for
 * conditional statements.
 *
 * **Example:**
 *
 * ```
 * sql.if`AND project = ${value}`
 * ```
 *
 * If `value` is undefined, then the result is empty query string.
 *
 * @param strings
 * @param values
 * @returns
 */
sql.if = cond;
