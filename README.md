# Virtual Try-On

Upload a selfie and paste any e-commerce product URL. The app uses Browserbase Stagehand to extract the product image, then GPT-Image-2 to composite the product onto the person.

## How it works

1. The user uploads a selfie and pastes a product page URL.
2. A Stagehand agent navigates the page on Browserbase and extracts the product name and main product image URL.
3. Both images are sent to OpenAI via the Responses API with the `image_generation` tool targeting `gpt-image-2`.
4. The result is displayed alongside the original selfie and product image for comparison.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS
- Browserbase Stagehand v3 for browser automation
- OpenAI `gpt-image-2` via the Responses API

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Configure environment variables**

Copy `.env.local.example` to `.env.local` and fill in your keys:

```
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
OPENAI_API_KEY=
```

- Browserbase: https://browserbase.com
- OpenAI: https://platform.openai.com

**3. Run the dev server**

```bash
npm run dev
```

Open http://localhost:3000.

## API routes

| Route | Method | Description |
|---|---|---|
| `/api/extract-product` | POST | Navigates a product URL with Stagehand and returns `{ productName, imageUrl }` |
| `/api/tryon` | POST | Accepts a selfie file, product image URL, and product name; returns a base64 PNG |
