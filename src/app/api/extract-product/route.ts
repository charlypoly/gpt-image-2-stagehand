import { NextRequest, NextResponse } from "next/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

const RequestSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

const ProductSchema = z.object({
  productName: z.string().describe("The name or title of the product being sold on this page"),
  imageUrl: z.string().url().describe(
    "The absolute https:// URL of the main product image as it appears in the page source"
  ),
});

export async function POST(request: NextRequest) {
  let stagehand: Stagehand | null = null;

  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request: " + parsed.error.flatten().fieldErrors.url?.[0] },
        { status: 400 }
      );
    }

    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      model: "openai/gpt-4o",
      experimental: true,
      disableAPI: true,
    });

    await stagehand.init();

    const page = stagehand.context.activePage();
    if (!page) throw new Error("No active browser page available");

    await page.goto(parsed.data.url, {
      waitUntil: "domcontentloaded",
      timeoutMs: 30_000,
    });

    await page.waitForTimeout(2500);

    const agent = stagehand.agent({ model: "openai/gpt-4o" });

    const result = await agent.execute({
      instruction:
        "You are on an e-commerce product page. Extract two pieces of information: " +
        "(1) the product name or title, and " +
        "(2) the absolute https:// URL of the main product image (the primary large photo of the item). " +
        "Do not navigate away from the current page. " +
        "The image URL must be a real URL from the page — do not guess or construct one.",
      maxSteps: 5,
      output: ProductSchema,
    });

    const imageUrl: string | undefined = typeof result.output?.imageUrl === "string" ? result.output.imageUrl : undefined;
    const productName: string | undefined = typeof result.output?.productName === "string" ? result.output.productName : undefined;

    if (!imageUrl || !imageUrl.startsWith("http")) {
      return NextResponse.json(
        {
          error:
            "Could not find a product image on this page. Try a direct product page URL (not a search or category page).",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      productName: productName || "Product",
      imageUrl,
    });
  } catch (error: unknown) {
    console.error("[/api/extract-product]", error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message.toLowerCase().includes("timeout")) {
      return NextResponse.json(
        { error: "The product page took too long to load. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (stagehand) {
      try {
        await stagehand.close();
      } catch {
        // ignore close errors
      }
    }
  }
}
