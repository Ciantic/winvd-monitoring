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

function sqlValues(...sqlValues: SqlTypes[]): Values {
    return {
        sqlValues,
    };
}

// For SQLite with $1 $2 $3 etc. parameters
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

            // if (
            //     typeof value === "string" ||
            //     typeof value === "number" ||
            //     typeof value === "boolean"
            // ) {
            //     sql += "?";
            //     params.push(value);
            // } else {
            //     if (typeof value === "object" && "sql" in value && value !== null) {
            //         sql += value.sql;
            //         params = params.concat(value.params);
            //         // Else if is array
            //     } else if (Array.isArray(value)) {
            //         sql += "(" + value.map(() => "?").join(",") + ")";
            //         params = params.concat(value);
            //     } else if (typeof value === "undefined") {
            //         // OK
            //     } else {
            //         throw new Error("Invalid sql value");
            //     }
            // }
        }
    }
    return {
        sql,
        params,
    };
}

sql.values = sqlValues;

import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
if (typeof Deno !== "undefined" && Deno) {
    Deno.test("empty", () => {
        const query = sql``;
        assertEquals(query.sql, "");
        assertEquals(query.params, []);
    });
    Deno.test("no parameters", () => {
        const query = sql`SELECT * FROM table`;
        assertEquals(query.sql, "SELECT * FROM table");
        assertEquals(query.params, []);
    });

    Deno.test("add parameters", () => {
        const query = sql`SELECT * FROM table WHERE id = ${1}, name = ${"John"}`;
        assertEquals(query.sql, "SELECT * FROM table WHERE id = ?, name = ?");
        assertEquals(query.params, [1, "John"]);
    });

    Deno.test("add parameters with sql", () => {
        const query = sql`SELECT * FROM table WHERE ${sql`id = ${1}`}`;
        assertEquals(query.sql, "SELECT * FROM table WHERE id = ?");
        assertEquals(query.params, [1]);
    });

    Deno.test("add parameters null", () => {
        const query = sql`SELECT * FROM table WHERE ${undefined} id = ${1}`;
        assertEquals(query.sql, "SELECT * FROM table WHERE  id = ?");
        assertEquals(query.params, [1]);
    });

    Deno.test("parameter arrays", () => {
        const query = sql`SELECT * FROM table WHERE id IN ${[1, 2, 3]}`;
        assertEquals(query.sql, "SELECT * FROM table WHERE id IN (?,?,?)");
        assertEquals(query.params, [1, 2, 3]);
    });

    Deno.test("parameter arrays within arrays", () => {
        const query = sql`SELECT * FROM table WHERE id IN (${sql.values([1, 2, 3], [4, 5, 6])})`;
        assertEquals(query.sql, "SELECT * FROM table WHERE id IN (VALUES (?,?,?),(?,?,?))");
        assertEquals(query.params, [1, 2, 3, 4, 5, 6]);
    });
}
