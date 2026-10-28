import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Building } from '../src/schemas/building';
import { runStressTestAgent } from '../src/agent/orchestrator';
import { runAIVsRandomBenchmark } from '../src/agent/benchmark';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    metaApiConfigured: Boolean(process.env.META_LLAMA_API_KEY),
    model: process.env.META_LLAMA_MODEL || 'llama-3.3-70b-versatile',
  });
});

/**
 * Server-side Meta Model API call for stress scenario hypotheses
 */
app.post('/api/agent/suggest-scenarios', async (req, res) => {
  const { buildingSummary, budget = 3 } = req.body;
  const apiKey = process.env.META_LLAMA_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: 'Meta API key not configured on server. Baseline and autonomous simulation available.',
      offlineMode: true,
    });
  }

  const baseUrl = process.env.META_LLAMA_BASE_URL || 'https://api.groq.com/openai/v1';
  const model = process.env.META_LLAMA_MODEL || 'llama-3.3-70b-versatile';

  try {
    const prompt = `You are an AI evacuation planning stress-testing assistant.
Analyze this single-floor building summary and propose up to ${budget} plausible disruption scenarios.
Building info:
- Name: ${buildingSummary.name}
- Total occupants: ${buildingSummary.totalOccupants}
- Rooms: ${JSON.stringify(buildingSummary.rooms)}
- Doors: ${JSON.stringify(buildingSummary.doors)}
- Exits: ${JSON.stringify(buildingSummary.exits)}

Output ONLY valid JSON matching this schema:
{
  "scenarios": [
    {
      "name": string,
      "hypothesis": string,
      "blockedDoorIds": string[],
      "occupancyMultiplier": number
    }
  ]
}
Rule: blockedDoorIds MUST ONLY contain IDs present in the building doors list. Never block all exits simultaneously.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Meta Model API error', details: errText });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content || '{}');

    res.json({
      success: true,
      model,
      scenarios: parsed.scenarios || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal error' });
  }
});

app.post('/api/agent/run-benchmark', async (req, res) => {
  try {
    const { building, budget = 3, seed = 42 } = req.body as { building: Building; budget?: number; seed?: number };
    const result = await runAIVsRandomBenchmark(building, budget, seed);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ExitLab backend server listening on port ${PORT}`);
});
