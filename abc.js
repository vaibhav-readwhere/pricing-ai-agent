import { chromium } from "playwright";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyDsyzaSUmEQ9JDQmoAFUxsJkxCQIGoRliM");

async function getRenderedText(url) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-http2",              // force HTTP/1.1 — fixes ERR_HTTP2_PROTOCOL_ERROR
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Linux"',
    },
    viewport: { width: 1280, height: 800 },
  });

  // Hide webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  const page = await context.newPage();

  console.log("  → Navigating...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Give JS time to render prices
  console.log("  → Waiting for price to render...");
  await page.waitForTimeout(4000);

  // Try to wait for a price element — don't fail if not found
  await page
    .waitForFunction(
      () => document.body.innerText.includes("AED"),
      { timeout: 8000 }
    )
    .catch(() => console.warn("  ⚠️  AED price text not detected, continuing"));

  const pageText = await page.evaluate(() => document.body.innerText);
  await browser.close();
  return pageText;
}

async function extractPriceWithGemini(pageText, url) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
You are a price extraction agent. Below is the visible text scraped from a Carrefour UAE product page.
Source URL: ${url}

Extract price info and return ONLY a raw JSON object (no markdown fences, no explanation):
{
  "product_name": "full product title",
  "current_price": <number>,
  "original_price": <number or null>,
  "currency": "AED",
  "discount_percent": <number or null>,
  "includes_vat": <true/false>,
  "capacity": "e.g. 2TB",
  "color": "e.g. Deep Blue",
  "ram": "e.g. 12GB",
  "availability": "In Stock / Out of Stock",
  "fetched_at": "${new Date().toISOString()}"
}

--- PAGE TEXT START ---
${pageText.slice(0, 8000)}
--- PAGE TEXT END ---
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const PRODUCT_URL =
  "https://www.carrefouruae.com/mafuae/en/smartphones/apple-iphone-17-pmax-2tb-deepblue/p/2258771";

(async () => {
  try {
    console.log("🌐 Launching browser...");
    const pageText = await getRenderedText(PRODUCT_URL);

    console.log("🤖 Extracting price with Gemini...");
    const priceData = await extractPriceWithGemini(pageText, PRODUCT_URL);

    console.log("\n✅ Price Data:");
    console.log(JSON.stringify(priceData, null, 2));
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
})();