import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";

export async function getCategoriesForUser(userId: string, type?: "INCOME" | "EXPENSE") {
  return await db.query.categories.findMany({
    where: and(
      eq(categories.userId, userId),
      eq(categories.isActive, true),
      type ? eq(categories.type, type) : undefined
    ),
    orderBy: [asc(categories.name)],
  });
}