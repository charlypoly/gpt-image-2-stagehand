import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateTryOn(
  selfieBuffer: Buffer,
  productBuffer: Buffer,
  productName: string,
  selfieMimeType: string = "image/jpeg",
  productMimeType: string = "image/jpeg"
): Promise<string> {
  const selfieB64 = selfieBuffer.toString("base64");
  const productB64 = productBuffer.toString("base64");

  const prompt = [
    `Show the person from the first image wearing/using "${productName}" (shown in the second image).`,
    "Keep the person's face, skin tone, hair, and body proportions exactly the same.",
    "Only add the product in a natural, photorealistic way as if the person is actually wearing it.",
    "Do not change the background. Preserve lighting and shadows.",
  ].join(" ");

  // Use the Responses API with the image_generation tool —
  // this is the correct path for gpt-image-2 multi-image editing.
  // The image_generation SDK type only lists 'gpt-image-1' but the API accepts 'gpt-image-2'.
  const response = await openai.responses.create({
    model: "gpt-4o",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_image",
            detail: "high",
            image_url: `data:${selfieMimeType};base64,${selfieB64}`,
          },
          {
            type: "input_image",
            detail: "high",
            image_url: `data:${productMimeType};base64,${productB64}`,
          },
          { type: "input_text", text: prompt },
        ],
      },
    ],
    tools: [
      {
        type: "image_generation",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: "gpt-image-2" as any,
        size: "1024x1024",
        quality: "medium",
      },
    ],
  });

  // Find the image generation result in the output items
  for (const item of response.output) {
    if (item.type === "image_generation_call" && item.result) {
      return item.result; // already base64 PNG
    }
  }

  throw new Error("No image was generated. The model may have refused the request.");
}
