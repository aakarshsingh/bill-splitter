const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');

const router = express.Router();
const client = new Anthropic();

const SYSTEM_PROMPT = `You are a bill/receipt parser for Indian restaurants and bars. Extract every line item, the tax and service charge rates per category (food vs alcohol), and the bill total.

Example of the expected output:
{
  "establishment": "Name of restaurant/place",
  "date": "2025-01-15",
  "items": [
    { "name": "Item name", "qty": 2, "unitPrice": 27500, "category": "alcohol" }
  ],
  "rates": {
    "food": { "sc": 10, "tax": 5, "scTax": 5 },
    "alcohol": { "sc": 10, "tax": 0, "scTax": 5 }
  },
  "billTotal": 487100
}

Line items:
- unitPrice is the price of ONE unit in paise (smallest currency unit). 450 rupees -> 45000; 4.50 -> 450.
- Receipts often print the LINE TOTAL in the amount column. If qty is 2 and the amount is 550.00, unitPrice is 27500. Check: the sum of qty × unitPrice across items should equal the receipt's subtotal.
- qty defaults to 1 if unclear.
- category is "alcohol" for beer, wine, whisky, vodka, gin, rum, cocktails, shots, IMFL, spirits, champagne, sake, and similar. Everything else (food, soft drinks, mocktails, water, juice, tea, coffee) is "food".
- Some receipts print a zero-priced parent line with priced sub-lines (e.g. "Half & Half Pizza 0.00" then "- Tartofu 337.50", "- Pepperoni 412.50"). Omit the zero-priced parent and keep the priced sub-lines as items. Omit any other zero-priced lines.
- Do NOT include tax, service charge, discounts, round-off, subtotal, or total as items.

Rates (all percentages, per category):
- sc: service charge % applied to that category's base price. Usually the same for both categories; 0 if none.
- tax: tax % applied to that category's base price. Add split taxes together (CGST 2.5% + SGST 2.5% -> 5).
- scTax: tax % applied to the service charge amount (GST is usually also charged on service charge). 0 if no service charge.
- Decide which category each tax line applies to from the AMOUNTS, not the label: divide the tax amount by its rate to get the taxable base, and compare it with the food subtotal and the alcohol subtotal. Labels like "F&B" or "GST" are unreliable.
- VAT on liquor (e.g. "VAT 22%") is alcohol tax. In many states alcohol prices already include tax, so alcohol tax is 0 when no tax line covers the alcohol subtotal.
- Typical patterns: Karnataka — food tax 5, alcohol tax 0. Goa — food tax 5, alcohol tax 22 (VAT). Restaurants with service charge — sc 10 on both, scTax equal to the GST rate.

Other fields:
- billTotal is the final amount the customer pays, in paise, after any round-off.
- establishment is the restaurant or place name if visible, otherwise "Unknown".
- date is the bill date in YYYY-MM-DD if visible, otherwise null.`;

const RATE_SCHEMA = {
  type: 'object',
  properties: {
    sc: { type: 'number' },
    tax: { type: 'number' },
    scTax: { type: 'number' },
  },
  required: ['sc', 'tax', 'scTax'],
  additionalProperties: false,
};

const BILL_SCHEMA = {
  type: 'object',
  properties: {
    establishment: { type: 'string' },
    date: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: { type: 'integer' },
          unitPrice: { type: 'integer' },
          category: { type: 'string', enum: ['food', 'alcohol'] },
        },
        required: ['name', 'qty', 'unitPrice', 'category'],
        additionalProperties: false,
      },
    },
    rates: {
      type: 'object',
      properties: {
        food: RATE_SCHEMA,
        alcohol: RATE_SCHEMA,
      },
      required: ['food', 'alcohol'],
      additionalProperties: false,
    },
    billTotal: { type: 'integer' },
  },
  required: ['establishment', 'date', 'items', 'rates', 'billTotal'],
  additionalProperties: false,
};

router.post('/', async (req, res) => {
  try {
    const { fileData, mimeType, pageNumber } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({ error: 'fileData and mimeType are required' });
    }

    let finalData = fileData;
    let finalMimeType = mimeType;

    // Extract single page from multi-page PDF if pageNumber is specified
    if (mimeType === 'application/pdf' && pageNumber) {
      const pdfBytes = Buffer.from(fileData, 'base64');
      const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pageIndex = pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= srcDoc.getPageCount()) {
        return res.status(400).json({ error: `Page ${pageNumber} does not exist. PDF has ${srcDoc.getPageCount()} pages.` });
      }
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIndex]);
      newDoc.addPage(copiedPage);
      const singlePageBytes = await newDoc.save();
      finalData = Buffer.from(singlePageBytes).toString('base64');
    }

    const mediaType = finalMimeType === 'application/pdf' ? 'application/pdf' : finalMimeType;

    const content = [
      {
        type: finalMimeType === 'application/pdf' ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: finalData,
        },
      },
      {
        type: 'text',
        text: 'Parse this bill: line items with food/alcohol category, per-category tax and service charge rates, and the bill total.',
      },
    ];

    // Server-side fallback: a safety-classifier decline is retried on
    // Anthropic's recommended model for that category within the same call.
    const response = await client.beta.messages.create({
      model: 'claude-sonnet-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: {
        format: { type: 'json_schema', schema: BILL_SCHEMA },
      },
    });

    if (response.stop_reason === 'max_tokens') {
      return res.status(500).json({ error: 'Response truncated; bill too long' });
    }
    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'Model declined to parse this file' });
    }

    // Thinking blocks may come first; read the text block by type
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) {
      return res.status(500).json({ error: 'No text in AI response' });
    }

    const parsed = JSON.parse(textBlock.text);

    parsed.items = parsed.items.map((item) => ({
      id: uuidv4(),
      ...item,
      category: String(item.category).toLowerCase(),
    }));

    res.json(parsed);
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
