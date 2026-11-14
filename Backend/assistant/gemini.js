const config = require('./config')

// Thin wrapper over @google/genai so the agent can be tested with a fake.
// Every turn uses function calling in ANY mode: the model must call a tool,
// and it ends by calling final_answer, whose parameter schema is the
// structured-output contract ({ status, answer, missing }). This replaces the
// spec's responseMimeType/responseSchema, which Gemini does not reliably
// accept in the same request as function declarations.

class GeminiRateLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GeminiRateLimitError'
  }
}

let clientPromise = null

function getClient() {
  if (!clientPromise) {
    clientPromise = import('@google/genai').then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey: config.GEMINI_API_KEY }))
    clientPromise.catch(() => { clientPromise = null })
  }
  return clientPromise
}

function isRateLimit(err) {
  const status = err && (err.status ?? err.code ?? err.response?.status)
  return status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(String(err && err.message))
}

async function generate({ systemInstruction, contents, functionDeclarations, allowedFunctionNames }) {
  const ai = await getClient()
  let response
  try {
    response = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.1,
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: allowedFunctionNames
            ? { mode: 'ANY', allowedFunctionNames }
            : { mode: 'ANY' },
        },
      },
    })
  } catch (err) {
    if (isRateLimit(err)) throw new GeminiRateLimitError(err.message)
    throw err
  }

  const content = response.candidates?.[0]?.content || { role: 'model', parts: [] }
  return {
    // Pushed back verbatim so thought signatures survive between turns.
    content: { role: 'model', parts: content.parts || [] },
    functionCalls: (response.functionCalls || []).map((c) => ({ id: c.id, name: c.name, args: c.args || {} })),
  }
}

module.exports = { generate, GeminiRateLimitError, isRateLimit }
