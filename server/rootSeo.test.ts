import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT_SEO } from "../client/src/lib/seo";

describe("root page SEO limits", () => {
  it("keeps title, description, keywords and H2 within the requested limits", () => {
    expect([...ROOT_SEO.title]).toHaveLength(53);
    expect(ROOT_SEO.title.length).toBeGreaterThanOrEqual(30);
    expect(ROOT_SEO.title.length).toBeLessThanOrEqual(60);

    expect(ROOT_SEO.description.length).toBeGreaterThanOrEqual(50);
    expect(ROOT_SEO.description.length).toBeLessThanOrEqual(160);

    expect(ROOT_SEO.keywords).toHaveLength(6);
    expect(new Set(ROOT_SEO.keywords).size).toBe(ROOT_SEO.keywords.length);
    expect(ROOT_SEO.keywords.length).toBeGreaterThanOrEqual(3);
    expect(ROOT_SEO.keywords.length).toBeLessThanOrEqual(8);

    expect(ROOT_SEO.h2.length).toBeGreaterThan(0);
    expect(ROOT_SEO.h2.length).toBeLessThanOrEqual(80);
  });

  it("renders crawlable static metadata and an H2 fallback in index.html", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(html).toContain(`<title>${ROOT_SEO.title}</title>`);
    expect(html).toContain(`name="description" content="${ROOT_SEO.description}"`);
    expect(html).toContain(`name="keywords" content="${ROOT_SEO.keywords.join(",")}"`);
    expect(html).toContain(`>${ROOT_SEO.h2}</h2>`);
  });

  it("sets document.title through the root page runtime metadata helper", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(source).toContain("applyRootSeoMetadata();");
    expect(source).toContain("{ROOT_SEO.h2}");
  });
});
