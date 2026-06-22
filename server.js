import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildLanguageInstruction(preferredLanguage, region) {
  switch (preferredLanguage) {
    case "Bangla":
      return `
Write the joke fully in natural Bangla script.
Do not transliterate Bangla into English letters.
Make it sound natural to Bangla speakers.
If region is Bangladesh, keep the joke culturally understandable for users familiar with Bangladesh.
Avoid awkward literal translation from English.
`;
    case "Mandarin Chinese":
      return `
Write the joke fully in natural Simplified Chinese.
Make it sound natural to Mandarin Chinese speakers.
If region is China, keep the joke culturally understandable for users familiar with China.
Avoid awkward literal translation from English.
`;
    case "English":
    default:
      return `
Write the joke in natural English.
If region is Global / Neutral, keep it internationally understandable.
If region is specific, you may use light familiar references, but do not use obscure slang.
`;
  }
}

function buildSafetyInstruction(safetyLevel) {
  switch (safetyLevel) {
    case "Very Safe":
      return `
Keep the joke extremely safe, family-friendly, gentle, and clean.
No dark humor.
No edgy content.
No insulting tone.
`;
    case "Light Sarcasm OK":
      return `
Light sarcasm is allowed, but keep it harmless, playful, and family-friendly.
No cruel or biting tone.
`;
    case "Balanced":
      return `
Keep the joke broadly safe and friendly.
You may use a little cheeky humor, but avoid dark, offensive, or risky content.
`;
    case "Avoid Dark Humor":
      return `
Absolutely avoid dark humor, death humor, disturbing humor, or anything emotionally heavy.
Keep it light and safe.
`;
    default:
      return `
Keep the joke family-friendly and safe.
`;
  }
}

function buildStyleInstruction(styles) {
  if (!Array.isArray(styles) || styles.length === 0) {
    return "Preferred humor style: Witty, Wholesome.";
  }

  return `
Strongly follow these preferred humor styles:
${styles.map((style) => `- ${style}`).join("\n")}
`;
}

function buildRegionInstruction(region) {
  switch (region) {
    case "Bangladesh":
      return `
The user is culturally familiar with Bangladesh.
Use references that are easy for someone familiar with Bangladesh to understand.
Do not overuse local slang.
Avoid references that require Western-specific context unless widely understood.
`;
    case "China":
      return `
The user is culturally familiar with China.
Use references that are easy for someone familiar with China to understand.
Do not overuse obscure regional slang.
Avoid references that require Western-specific context unless widely understood.
`;
    case "Middle East":
      return `
The user is culturally familiar with the Middle East.
Keep references broad and culturally understandable for that audience.
Avoid regionally inappropriate assumptions.
`;
    case "South Asia":
      return `
The user is culturally familiar with South Asia.
Use references that are understandable across South Asian contexts.
Avoid very country-specific slang unless the country is explicitly given.
`;
    case "Global / Neutral":
    default:
      return `
Keep the joke culturally neutral and internationally understandable.
Avoid obscure slang, niche local references, or culture-specific assumptions.
`;
  }
}

function buildAvoidTopicsInstruction(avoidTopics) {
  if (!avoidTopics || avoidTopics.trim() === "") {
    return "No extra avoid-topics provided.";
  }

  return `
Strictly avoid these topics:
${avoidTopics}
If a topic overlaps with the joke idea, choose a safer alternative.
`;
}

function buildLocalizedJokePrompt({
  category,
  prompt,
  region,
  preferredLanguage,
  styles,
  safetyLevel,
  avoidTopics
}) {
  const languageInstruction = buildLanguageInstruction(preferredLanguage, region);
  const safetyInstruction = buildSafetyInstruction(safetyLevel);
  const styleInstruction = buildStyleInstruction(styles);
  const regionInstruction = buildRegionInstruction(region);
  const avoidTopicsInstruction = buildAvoidTopicsInstruction(avoidTopics);

  const topicInstruction =
    prompt && prompt.trim() !== ""
      ? `Use this user topic/context strongly: ${prompt}`
      : `No custom topic was provided. Use the category: ${category || "General"}.`;

  return `
You are generating one joke for a mental well-being and humor app.

User profile:
- Region / cultural familiarity: ${region || "Global / Neutral"}
- Preferred joke language: ${preferredLanguage || "English"}
- Safety level: ${safetyLevel || "Very Safe"}
- Category: ${category || "General"}

${topicInstruction}

${languageInstruction}

${regionInstruction}

${styleInstruction}

${safetyInstruction}

${avoidTopicsInstruction}

Core rules:
- Generate exactly one genuinely funny joke.
- Make the joke easy to understand for the selected region familiarity.
- Respect the selected language strongly.
- Respect humor styles strongly.
- Respect safety level strongly.
- Avoid offensive, hateful, sexual, graphic, violent, or harmful humor.
- If category is One-Liner, return one short sentence.
- Otherwise keep it short, max 2 to 3 lines.
- Do not include any title.
- Do not number anything.
- Do not explain the joke.
- Return only the joke text.
`;
}

function buildExplainJokePrompt(joke) {
  return `
Explain this joke in a short, simple, friendly way.

Joke:
${joke}

Rules:
- keep the explanation short
- very easy to understand
- no numbered list
- return only the explanation
`;
}

function buildSimilarJokePrompt({
  joke,
  category,
  region,
  preferredLanguage,
  styles,
  safetyLevel,
  avoidTopics
}) {
  const languageInstruction = buildLanguageInstruction(preferredLanguage, region);
  const safetyInstruction = buildSafetyInstruction(safetyLevel);
  const styleInstruction = buildStyleInstruction(styles);
  const regionInstruction = buildRegionInstruction(region);
  const avoidTopicsInstruction = buildAvoidTopicsInstruction(avoidTopics);

  return `
Generate one new joke that feels similar in vibe to this joke, but do not repeat it.

Original joke:
${joke}

Category:
${category || "General"}

${languageInstruction}

${regionInstruction}

${styleInstruction}

${safetyInstruction}

${avoidTopicsInstruction}

Rules:
- keep the same overall vibe
- do not copy wording
- family-friendly
- short and punchy
- no title
- no numbering
- no explanation
- return only the new joke text
`;
}

function buildImagePrompt(category) {
  return `
Create a genuinely hilarious, family-friendly comedy image.

Category: ${category || "General"}

Rules:
- exaggerated cartoon comedy
- expressive faces and body language
- absurd visual humor
- bright playful colors
- no text inside image
- no violence
- no gore
- no adult content
- no offensive content
`;
}

app.get("/", (req, res) => {
  res.json({ message: "MoodFix backend is running" });
});

app.post("/generate-joke", async (req, res) => {
  try {
    const {
      category,
      prompt,
      region,
      preferredLanguage,
      styles,
      safetyLevel,
      avoidTopics
    } = req.body;

    const finalPrompt = buildLocalizedJokePrompt({
      category,
      prompt,
      region,
      preferredLanguage,
      styles,
      safetyLevel,
      avoidTopics
    });

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: finalPrompt
    });

    const joke =
      response.output_text?.trim() ||
      "Sorry, I could not generate a joke right now.";

    res.json({ joke });
  } catch (error) {
    console.error("JOKE ERROR:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate joke"
    });
  }
});

app.post("/similar-joke", async (req, res) => {
  try {
    const {
      joke,
      category,
      region,
      preferredLanguage,
      styles,
      safetyLevel,
      avoidTopics
    } = req.body;

    const finalPrompt = buildSimilarJokePrompt({
      joke,
      category,
      region,
      preferredLanguage,
      styles,
      safetyLevel,
      avoidTopics
    });

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: finalPrompt
    });

    const similarJoke =
      response.output_text?.trim() ||
      "Sorry, I could not generate a similar joke right now.";

    res.json({ joke: similarJoke });
  } catch (error) {
    console.error("SIMILAR JOKE ERROR:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate similar joke"
    });
  }
});

app.post("/explain-joke", async (req, res) => {
  try {
    const { joke } = req.body;

    const finalPrompt = buildExplainJokePrompt(joke);

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: finalPrompt
    });

    const explanation =
      response.output_text?.trim() ||
      "Sorry, I could not explain this joke right now.";

    res.json({ explanation });
  } catch (error) {
    console.error("EXPLAIN JOKE ERROR:", error);
    res.status(500).json({
      error: error?.message || "Failed to explain joke"
    });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const prompt = `
You are a friendly humour chatbot inside a mood-lifting app.

Rules:
- keep replies short
- be warm, funny, and playful
- prefer witty one-liners, light humour, and harmless jokes
- never use offensive, dark, sexual, hateful, or harmful humour
- if the user asks for a joke, give one
- if the user sounds low, respond gently and cheerfully
- ask a light follow-up question when appropriate

User message:
${message}
`;

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: prompt
    });

    const reply =
      response.output_text?.trim() ||
      "I’m here with a joke if you want one.";

    res.json({ reply });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate chat reply"
    });
  }
});

app.post("/generate-image", async (req, res) => {
  try {
    const { category } = req.body;

    const prompt = buildImagePrompt(category);

    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    const imageBase64 = result.data?.[0]?.b64_json;

    if (!imageBase64) {
      return res.status(500).json({ error: "No image returned" });
    }

    res.json({ imageBase64 });
  } catch (error) {
    console.error("IMAGE ERROR FULL:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate image"
    });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});