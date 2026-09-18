import {
  GoogleGenAI,
} from "@google/genai";

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error(
    "GEMINI_API_KEY no está disponible.",
  );

  process.exit(1);
}

const client =
  new GoogleGenAI({
    apiKey,
  });

try {
  console.log(
    "[Finora AI] Probando Gemini...",
  );

  const response =
    await client.models.generateContent({
      model:
        "gemini-2.5-flash",

      contents:
        "Devuelve exclusivamente un JSON con la propiedad status y el valor ok.",

      config: {
        responseMimeType:
          "application/json",
      },
    });

  console.log(
    "[Finora AI] Gemini respondió correctamente.",
  );

  console.log(
    "Modelo: gemini-2.5-flash",
  );

  console.log(
    "Respuesta:",
    response.text,
  );

  console.log(
    "Tokens de entrada:",
    response.usageMetadata
      ?.promptTokenCount ??
      "n/a",
  );

  console.log(
    "Tokens de salida:",
    response.usageMetadata
      ?.candidatesTokenCount ??
      "n/a",
  );

  console.log(
    "Tokens totales:",
    response.usageMetadata
      ?.totalTokenCount ??
      "n/a",
  );
} catch (error) {
  console.error(
    "[Finora AI] Error probando Gemini:",
    error,
  );

  process.exit(1);
}