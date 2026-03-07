const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const client = new Anthropic();

const SYSTEM_PROMPT = `You are a bill/receipt parser for Indian restaurants. Extract all line items, tax percentage, service charge percentage, and the bill total.

Return ONLY valid JSON in this exact format, no other text:
{
  "establishment": "Name of restaurant/place",
  "items": [
    { "name": "Item name", "qty": 1, "unitPrice": 450, "category": "food" }
  ],
  "tax": 5,
  "serviceCharge": 10,
  "billTotal": 52500
}

Rules:
- unitPrice must be in the smallest currency unit (paise). If the bill shows 4.50, return 450. If the bill shows 450 (rupees), return 45000.
- qty should be the quantity for that line item. Default to 1 if not clear.
- unitPrice is the price for ONE unit, not the line total. If line shows "2x Pizza 900", unitPrice should be 45000 (450 rupees in paise).
- category must be either "food" or "alcohol". Classify beer, wine, whisky, vodka, gin, rum, cocktails, IMFL, spirits, champagne, sake, and similar drinks as "alcohol". Everything else (including non-alcoholic beverages, mocktails, soft drinks, water, juice, tea, coffee) is "food".
- tax is the tax/GST percentage (e.g. 5 for 5%). Return 0 if no tax found. In India this is typically 5% for dine-in restaurants.
- serviceCharge is the service charge percentage (e.g. 10 for 10%). Return 0 if no service charge found.
- billTotal is the final total amount on the bill in paise (the amount the customer pays). This is critical for reconciliation.
- Do NOT include tax, service charge, subtotal, or total as line items.
- establishment should be the name of the restaurant or place if visible, otherwise "Unknown".`;

router.post('/', async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({ error: 'fileData and mimeType are required' });
    }

    const mediaType = mimeType === 'application/pdf' ? 'application/pdf' : mimeType;

    const content = [
      {
        type: mimeType === 'application/pdf' ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: fileData,
        },
      },
      {
        type: 'text',
        text: 'Parse this bill and extract all line items with food/alcohol category, tax %, service charge %, and the bill total. Return only JSON.',
      },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse AI response as JSON' });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    parsed.items = parsed.items.map((item) => ({
      id: uuidv4(),
      category: 'food',
      ...item,
    }));

    res.json(parsed);
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
