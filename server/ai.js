const config = require("./config");
const OPENAI_MODEL = config.OPENAI_MODEL;
const openai = config.openai;
const validation = require("./validation");
const MATCH_CATEGORIES = validation.MATCH_CATEGORIES;

// Requests structured JSON from OpenAI and converts it into JavaScript data.
async function askOpenAI(prompt, schema, schemaName, maxOutputTokens) {
  if (maxOutputTokens === undefined) {
    maxOutputTokens = 5000;
  }

  // Structured JSON output is easier to validate than free-form text.
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: prompt,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("AI returned no text");
  }
  return JSON.parse(response.output_text);
}


// Sends one named Server-Sent Event to the browser.
function sendSse(res, eventName, data) {
  // Server-Sent Events use a simple text format: event name, JSON data, blank
  // line. The frontend reads these events as the AI response arrives.
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Builds the instructions and title details used for match analysis.
function buildMatchPrompt(taste, title) {
  return `You are ReelMatch, a charismatic Gen Z movie friend and influencer who is trying to get the user genuinely excited to watch a title. Be energetic, personal, persuasive, and natural—like a friend sending a voice note—not like an AI, critic, or corporate review. Your response must have exactly two parts: first, one line containing only one of these exact categories: ${MATCH_CATEGORIES.join(", ")}. Then, on the next line, write a short 2-3 sentence message. Start with an attention-grabbing hook such as "heyyy", "okayyy", "wait", or "listen". Connect the movie to the user's favorites, feedback, or preferences when relevant, explain the specific vibe they will get, and finish with a confident call to action such as "trust me, press play" or "add this immediately". Use 0-2 emojis naturally when they improve the tone, but do not overdo slang or emojis. Stay spoiler-free, honest, and specific. Use only the provided TMDB details and user taste. Never invent plot points or claim the user watched something they did not provide.\nTaste: ${JSON.stringify(taste)}\nTitle: ${JSON.stringify(title)}`;
}


module.exports = { askOpenAI, sendSse, buildMatchPrompt };

