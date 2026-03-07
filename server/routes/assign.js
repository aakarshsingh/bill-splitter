const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();
const client = new Anthropic();

const SYSTEM_PROMPT = `You are helping split a restaurant bill among friends. Given the bill items, people, their dietary preferences, and natural language instructions, suggest how to assign each item to the people.

Return ONLY valid JSON in this exact format, no other text:
{
  "assignments": {
    "item-id": [
      { "person": "Person Name", "share": "fraction or description" }
    ]
  },
  "reasoning": "Brief explanation of your assignment logic"
}

Rules for the "share" field — this is how people split a single item:
- Use "1" if one person gets the full item
- Use fractions like "1/2", "1/3", "1/4" for equal splits
- Use descriptive shares like "2/3", "1/3" for unequal splits
- The shares for each item must sum to 1 (the whole item)
- Every item must be assigned to at least one person

Assignment guidelines:
- Use dietary preferences: vegetarians should NOT be assigned meat dishes, respect meat type preferences
- Use drink preferences: non-drinkers should NOT be assigned alcohol, match drink types to preferences
- Follow the natural language instructions carefully — they take highest priority
- If instructions say "split X between A and B", assign equal shares to those people
- If instructions say "A had all the Y", assign fully to that person
- If instructions mention "everyone shared", split equally among all people
- Items not mentioned in instructions should be assigned based on preferences and reasonable guessing
- When in doubt, split shared/common items (naan, rice, appetizers) equally among everyone`;

router.post('/', async (req, res) => {
  try {
    const { items, people, instructions, preferences } = req.body;

    if (!items || !people) {
      return res.status(400).json({ error: 'items and people are required' });
    }

    const itemList = items.map((i) =>
      `- [${i.id}] ${i.name} (qty: ${i.qty}, category: ${i.category})`
    ).join('\n');

    const peopleList = people.map((p) => {
      const pref = preferences?.[p.name];
      if (!pref) return `- ${p.name} (no preferences set)`;
      const parts = [pref.diet === 'veg' ? 'vegetarian' : 'non-veg'];
      if (pref.diet === 'non-veg' && pref.meats?.length > 0) {
        parts.push(`eats: ${pref.meats.join(', ')}`);
      }
      if (pref.drinks?.length > 0) {
        parts.push(`drinks: ${pref.drinks.join(', ')}`);
      } else {
        parts.push('non-drinker');
      }
      return `- ${p.name} (${parts.join(', ')})`;
    }).join('\n');

    const instructionText = instructions && instructions.length > 0
      ? `\nInstructions from the user (HIGHEST PRIORITY):\n${instructions.map((i) => `- ${i}`).join('\n')}`
      : '\nNo specific instructions provided. Use preferences and reasonable defaults.';

    const userMessage = `Here is the bill and people. Please suggest assignments.

Items:
${itemList}

People:
${peopleList}
${instructionText}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse AI response as JSON' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
