import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

export type CategoryWithCount = Prisma.CategoryGetPayload<{
  select: {
    id: true;
    name: true;
    _count: {
      select: { resources: true };
    };
  };
}>;

export type ResourceWithRelations = Prisma.ResourceGetPayload<{
  select: {
    id: true;
    title: true;
    author: true;
    type: true;
    resourceLink: true;
    imageUrl: true;
    category: {
      select: {
        name: true;
      };
    };
  };
}>;

export async function getCategories(): Promise<CategoryWithCount[]> {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: {
        select: { resources: true },
      },
    },
  });
}

export async function getRecentResources(limit: number = 6): Promise<ResourceWithRelations[]> {
  return prisma.resource.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      author: true,
      type: true,
      resourceLink: true,
      imageUrl: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });
}
