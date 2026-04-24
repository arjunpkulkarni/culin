import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import { withOptionalAuth } from "@/lib/api-auth-middleware";

type HealthEffectRow = {
  id?: string;
  name?: string;
  description?: string;
};

// Load HealthEffect CSV once at module load
let healthEffects: Array<{ id: number; name: string; description?: string }> = [];
(() => {
  try {
    const csvPath = path.join(process.cwd(), "src", "app", "HealthEffect.csv");
    if (!fs.existsSync(csvPath)) {
      console.warn("[HealthEffects] CSV not found:", csvPath);
      return;
    }
    const content = fs.readFileSync(csvPath, "utf8");
    const parsed = Papa.parse<HealthEffectRow>(content, { header: true }).data;
    healthEffects = parsed.reduce<Array<{ id: number; name: string; description?: string }>>((acc, r) => {
      const id = Number((r.id || "").trim());
      const name = (r.name || "").trim();
      const description = (r.description || "").trim();
      if (!Number.isFinite(id) || !name) {
        return acc;
      }
      acc.push({ id, name, description: description || undefined });
      return acc;
    }, []);
    // console.log("[HealthEffects] Loaded entries:", healthEffects.length)
  } catch (e) {
    console.error("[HealthEffects] Failed to load CSV:", e);
  }
})();

function scoreEffect(query: string, effect: { name: string; description?: string }): number {
  const q = query.toLowerCase();
  const name = effect.name.toLowerCase();
  const desc = (effect.description || "").toLowerCase();

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (desc.includes(q)) return 3;
  return 99;
}

export const GET = withOptionalAuth(async (req: NextRequest, user) => {
  try {
    if (user) {
      console.log('[HealthEffects] Authenticated request from:', user.email);
    }
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ results: [] });
    }

    const scored = healthEffects
      .map((e) => ({ e, s: scoreEffect(q, e) }))
      .filter((x) => x.s < 99)
      .sort((a, b) => (a.s - b.s) || (a.e.name.length - b.e.name.length))
      .slice(0, 5)
      .map(({ e }) => e);

    return NextResponse.json({ results: scored });
  } catch (error) {
    console.error("[HealthEffects] Search failed:", error);
    return NextResponse.json({ results: [] }, { status: 200 });
  }
});