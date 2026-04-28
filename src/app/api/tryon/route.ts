import { NextRequest, NextResponse } from "next/server";
import { generateTryOn } from "@/lib/openai";

const MAX_SELFIE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const selfieFile = formData.get("selfie");
    const productImageUrl = formData.get("productImageUrl");
    const productName = formData.get("productName");

    if (!selfieFile || !(selfieFile instanceof File)) {
      return NextResponse.json({ error: "Missing or invalid selfie file" }, { status: 400 });
    }
    if (typeof productImageUrl !== "string" || !productImageUrl.startsWith("http")) {
      return NextResponse.json({ error: "Missing or invalid productImageUrl" }, { status: 400 });
    }
    if (typeof productName !== "string" || !productName.trim()) {
      return NextResponse.json({ error: "Missing productName" }, { status: 400 });
    }
    if (selfieFile.size > MAX_SELFIE_BYTES) {
      return NextResponse.json({ error: "Selfie file is too large (max 10MB)" }, { status: 413 });
    }

    const selfieBuffer = Buffer.from(await selfieFile.arrayBuffer());
    // Use the browser-reported MIME type; fall back to JPEG (most common for photos)
    const selfieMimeType = selfieFile.type || "image/jpeg";

    // Fetch product image server-side to avoid CORS issues
    let productBuffer: Buffer;
    let productMimeType = "image/jpeg";
    try {
      const productResponse = await fetch(productImageUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; VirtualTryOn/1.0)",
        },
      });

      if (!productResponse.ok) {
        return NextResponse.json(
          {
            error: `Could not download the product image (HTTP ${productResponse.status}). The image URL may have expired.`,
          },
          { status: 422 }
        );
      }

      productMimeType = productResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      productBuffer = Buffer.from(await productResponse.arrayBuffer());
    } catch (fetchError: unknown) {
      const msg = fetchError instanceof Error ? fetchError.message : "Network error";
      return NextResponse.json({ error: `Failed to fetch product image: ${msg}` }, { status: 502 });
    }

    const resultBase64 = await generateTryOn(
      selfieBuffer,
      productBuffer,
      productName.trim(),
      selfieMimeType,
      productMimeType
    );

    return NextResponse.json({ resultImage: resultBase64 });
  } catch (error: unknown) {
    console.error("[/api/tryon]", error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message.includes("timeout") || message.includes("AbortError")) {
      return NextResponse.json(
        { error: "Image generation timed out. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
