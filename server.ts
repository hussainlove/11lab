import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API: Health / config check
app.get("/api/health", (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: "ok",
    hasApiKey: hasKey,
    cloudTtsAvailable: hasKey,
    timestamp: Date.now(),
  });
});

function removeExtraSpaces(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\[\s+([^\]]+?)\s+\]/g, "[$1]")
    .replace(/\s+([,.:;?!])/g, "$1")
    .replace(/([,.:;?!])(?=[A-Za-z])/g, "$1 ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n")
    .trim();
}

// API: Text-to-Speech generation
app.post("/api/tts", async (req, res) => {
  try {
    const {
      text,
      dialogueBlocks,
      voiceName = "Puck",
      style = "Natural, expressive conversational speech",
      model = "gemini-3.8-flash-lite-tts",
      stability = 0.5,
      similarity = 0.75,
      speed = 1.0,
      pitch = 0,
      language = "auto",
    } = req.body;

    const cleanedText = removeExtraSpaces(text);

    const ai = getGeminiClient();

    // Map voice selection to Gemini prebuilt voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
    const validPrebuilt = ["Puck", "Charon", "Kore", "Fenrir", "Zephyr"];
    const resolvedVoice = validPrebuilt.includes(voiceName) ? voiceName : "Kore";

    // Check if multi-speaker dialogue or single speaker
    if (Array.isArray(dialogueBlocks) && dialogueBlocks.length >= 2) {
      // Pick unique speakers (maximum 2 for Gemini multi-speaker)
      const speaker1 = dialogueBlocks[0].speaker || "Speaker 1";
      const speaker2 = dialogueBlocks.find((b: any) => b.speaker && b.speaker !== speaker1)?.speaker || "Speaker 2";

      const voice1 = validPrebuilt.includes(dialogueBlocks[0].voiceName) ? dialogueBlocks[0].voiceName : "Puck";
      const voice2 = validPrebuilt.includes(dialogueBlocks[1]?.voiceName) ? dialogueBlocks[1]?.voiceName : "Kore";

      const parts = dialogueBlocks.map((block: any) => ({
        text: `${block.speaker || speaker1}: ${removeExtraSpaces(block.text)}`,
        speechMetadata: {
          speaker: block.speaker || speaker1,
          style: block.style || style,
        },
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-tts",
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: speaker1,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice1 },
                  },
                },
                {
                  speaker: speaker2,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice2 },
                  },
                },
              ],
            },
          },
        },
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        throw new Error("No audio returned from Gemini multi-speaker speech model.");
      }

      return res.json({
        audioBase64,
        mimeType: "audio/wav",
        voiceName: `${voice1} & ${voice2}`,
        model: "gemini-3.8-flash-tts",
        speakers: [speaker1, speaker2],
      });
    }

    // Single Speaker TTS
    const targetModel = model === "gemini-3.8-flash-tts" ? "gemini-3.8-flash-tts" : "gemini-3.8-flash-lite-tts";

    // Compose nuanced style instruction with parameters
    const styleInstructions = [
      style,
      stability > 0.7 ? "Consistent, measured, steady tone" : stability < 0.3 ? "Highly animated, spontaneous, and varied inflection" : "",
      similarity > 0.8 ? "Very clear diction and precise articulation" : "",
      speed > 1.2 ? "Brisk tempo" : speed < 0.8 ? "Deliberate, slow cadence" : "",
      pitch > 2 ? "Higher melodic pitch" : pitch < -2 ? "Deep, resonant low register" : "",
      language && language !== "auto" ? `Language: ${language}` : "",
    ].filter(Boolean).join(". ");

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: cleanedText || "Hello, this is ElevenVoice speech synthesis.",
              speechMetadata: {
                style: styleInstructions || "Clear, engaging studio narrator",
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: resolvedVoice },
          },
        },
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      throw new Error("No audio returned from Gemini speech model.");
    }

    res.json({
      audioBase64,
      mimeType: "audio/wav",
      voiceName: resolvedVoice,
      model: targetModel,
    });
  } catch (error: any) {
    console.error("TTS Server Error:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate speech with Gemini.",
    });
  }
});

// API: Voice Clone Acoustic Analysis
app.post("/api/clone-voice/analyze", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/wav", voiceName = "Custom Clone", description = "" } = req.body;
    const ai = getGeminiClient();

    let analysisPrompt = `Analyze the vocal characteristics of this speaker for an advanced AI voice cloning studio. 
Provide a JSON object with:
1. "timbre": e.g., "warm, resonant, slightly raspy, clear, gravelly"
2. "pitch": estimated register ("bass", "baritone", "tenor", "alto", "soprano")
3. "accent": e.g., "General American", "British RP", "Australian", "Transatlantic", etc.
4. "age": estimated range ("20s", "30s", "40s", "60+")
5. "gender": "male" | "female" | "neutral"
6. "cadence": e.g., "fast-paced, rhythmic", "deliberate, storytelling", "conversational"
7. "stylePrompt": a detailed instruction prompt (1-2 sentences) to replicate this voice's unique persona
8. "bestPrebuiltVoice": which of "Puck", "Charon", "Kore", "Fenrir", "Zephyr" is closest in base acoustic profile
9. "recommendedSettings": { "stability": number (0.0-1.0), "similarity": number (0.0-1.0), "pitchOffset": number (-5 to +5) }
Output pure JSON only without markdown formatting.`;

    let parts: any[] = [{ text: analysisPrompt }];
    if (audioBase64) {
      parts.unshift({
        inlineData: {
          mimeType: mimeType.split(";")[0],
          data: audioBase64,
        },
      });
    } else if (description) {
      parts.push({ text: `Voice description given by user: "${description}"` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      profile: parsed,
    });
  } catch (error: any) {
    console.error("Voice Clone Analysis Error:", error);
    // Return sensible fallback profile if analysis fails
    res.json({
      success: false,
      error: error?.message,
      profile: {
        timbre: "rich, clear and resonant",
        pitch: "baritone",
        accent: "Neutral Modern",
        age: "30s",
        gender: "neutral",
        cadence: "steady, expressive",
        stylePrompt: "Clear, warm, natural tone with smooth articulation",
        bestPrebuiltVoice: "Puck",
        recommendedSettings: { stability: 0.55, similarity: 0.8, pitchOffset: 0 },
      },
    });
  }
});

// Setup Vite in Dev or Static in Production
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(port, () => {
    console.log(`ElevenVoice server running at http://localhost:${port}`);
  });
}

startServer();
