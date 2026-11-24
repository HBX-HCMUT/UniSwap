import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { db } from "../../common/db";

@Controller()
export class CatalogController {
  @Get("health")
  async health() {
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException("Chưa kết nối được cơ sở dữ liệu.");
    }
    return { ok: true };
  }
  @Get("schools") schools() {
    return db.school.findMany({ orderBy: { name: "asc" } });
  }
  @Get("categories") categories() {
    return db.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }
}
