import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Analyze a violation photo with Gemini Vision.
 * @returns {Promise<object>} Parsed JSON analysis from the model
 */
export async function analyzeViolationPhoto(imageBase64, mimeType, zoneContext) {
  const prompt = `You are a marine conservation enforcement AI for the Adriatic Sea.
Analyze this photo submitted as a boat violation report near ${zoneContext}.
Respond ONLY with valid JSON, no markdown, no explanation:
{
  "detected": "one sentence: what you see in the photo",
  "hasBoat": true or false,
  "violationType": "anchoring_violation | speeding | illegal_fishing | waste_dumping | unclear",
  "speciesAtRisk": ["from: posidonia, loggerhead-turtle, fan-mussel, dusky-grouper, common-dolphin, date-mussel, seahorse, spider-crab, cladocora, mytilus"],
  "severity": "high | medium | low",
  "confidence": "high | medium | low",
  "recommendation": "one sentence action for authorities",
  "autoTag": "short 3-word tag for the report"
}`;

  const result = await visionModel.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  const text = result.response.text().trim();
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(jsonText);
}
