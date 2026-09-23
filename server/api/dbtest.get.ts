import useDrizzle from "~~/server/utils/useDrizzle";

export default defineEventHandler(async () => {
    const db = useDrizzle();

    const result = await db.query.users.findMany().execute()

    return result.map((user) => user.id)
})