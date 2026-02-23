import type { MetadataRoute } from "next";
import { getAllConcepts, getAllCategories } from "@/data/concepts";

const BASE_URL = "https://cannapedia.co.il";

export default function sitemap(): MetadataRoute.Sitemap {
  const concepts = getAllConcepts();
  const categories = getAllCategories();

  const conceptEntries: MetadataRoute.Sitemap = concepts.map((c) => ({
    url: `${BASE_URL}/concept/${c.slug}`,
    lastModified: c.bluf.lastUpdated || new Date().toISOString().split("T")[0],
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/category/${cat.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/categories`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/search`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...categoryEntries,
    ...conceptEntries,
  ];
}
