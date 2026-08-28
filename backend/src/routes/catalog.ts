import type { FastifyInstance } from "fastify";
import prisma from "../db";
import { getTenantId } from "../lib/tenant";

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  // Categories with their products in one call; only active/visible items.
  app.get("/catalog", async () => {
    const tenantId = await getTenantId();
    const [categories, products] = await Promise.all([
      prisma.productCategory.findMany({
        where: { tenantId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, sortOrder: true },
      }),
      prisma.product.findMany({
        where: { tenantId, active: true },
        orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          priceCents: true,
          imageUrl: true,
          stock: true,
          trackStock: true,
          featured: true,
        },
      }),
    ]);

    return {
      categories,
      products: products.map((p) => ({
        ...p,
        soldOut: p.trackStock && p.stock <= 0,
      })),
    };
  });

  app.get("/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = await getTenantId();
    const product = await prisma.product.findFirst({
      where: { id, tenantId, active: true },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!product) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Product not found" } });
    }
    return {
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        imageUrl: product.imageUrl,
        stock: product.stock,
        trackStock: product.trackStock,
        soldOut: product.trackStock && product.stock <= 0,
        featured: product.featured,
        category: product.category,
      },
    };
  });
}
