type SqlQuery = {
    sql: string;
    params: unknown[];
};

type Values = { sqlValues: SqlTypes[] };

type SqlTypes = boolean | string | number | SqlQuery | undefined | Values | SqlTypes[];

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
    if (typeof value === "object" && "sql" in value && value !== null) {
        return {
            sql: value.sql,
            params: value.params,
        };
    }
    if (typeof value === "object" && "sqlValues" in value && value !== null) {
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

sql.values = sqlValues;
