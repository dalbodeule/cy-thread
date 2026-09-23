import postgres from "postgres";
import {drizzle} from "drizzle-orm/postgres-js"
import schema from "~~/server/db/schema"

export interface Env {
    HYPERDRIVE: Hyperdrive
}

export default function useDrizzle() {
    const env = process.env as unknown as Env;
    const sql = postgres(env.HYPERDRIVE.connectionString, {
        max: 5,
        fetch_types: false
    })

    return drizzle(sql, {
        schema
    })
}