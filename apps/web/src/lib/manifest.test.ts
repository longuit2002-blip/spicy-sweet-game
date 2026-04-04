import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Unit test: manifest.json has correct fields
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */
describe("manifest.json — required PWA fields", () => {
  const manifestPath = resolve(__dirname, "../../public/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  it("has correct name and short_name", () => {
    expect(manifest.name).toBe("Sweet & Spicy");
    expect(manifest.short_name).toBe("Spicy!");
  });

  it("has display set to standalone", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("has start_url and scope set to /", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("has orientation set to portrait", () => {
    expect(manifest.orientation).toBe("portrait");
  });

  it("has theme_color and background_color", () => {
    expect(manifest.theme_color).toBeDefined();
    expect(typeof manifest.theme_color).toBe("string");
    expect(manifest.background_color).toBeDefined();
    expect(typeof manifest.background_color).toBe("string");
  });

  it("has at least 4 icons with required sizes", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("384x384");
    expect(sizes).toContain("512x512");
  });

  it("has a maskable icon", () => {
    const maskable = manifest.icons.find(
      (icon: { purpose?: string }) => icon.purpose === "maskable",
    );
    expect(maskable).toBeDefined();
    expect(maskable.sizes).toBe("512x512");
    expect(maskable.type).toBe("image/png");
  });

  it("all icons have src and type fields", () => {
    for (const icon of manifest.icons) {
      expect(typeof icon.src).toBe("string");
      expect(icon.src.length).toBeGreaterThan(0);
      expect(typeof icon.type).toBe("string");
    }
  });
});
