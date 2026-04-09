import { GoogleGenAI, Type } from "@google/genai";
import { FlashcardData, DeckType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean and repair JSON string
const cleanAndRepairJson = (str: string): string => {
  let cleaned = str.trim();

  // 1. Remove markdown code blocks if present
  cleaned = cleaned.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

  // 2. Replace unescaped backslashes that are likely part of LaTeX
  cleaned = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, "\\\\");

  // 3. Handle Truncation (Unterminated Object/Array)
  if (cleaned.startsWith("[") && !cleaned.endsWith("]")) {
      const lastObjectSeparator = cleaned.lastIndexOf("},");
      if (lastObjectSeparator !== -1) {
          cleaned = cleaned.substring(0, lastObjectSeparator + 1) + "]";
      } else {
          const lastClosingBrace = cleaned.lastIndexOf("}");
          if (lastClosingBrace !== -1) {
             cleaned = cleaned.substring(0, lastClosingBrace + 1) + "]";
          }
      }
  } else if (cleaned.startsWith("{") && !cleaned.endsWith("}")) {
      // Very basic repair for truncated objects containing an array of cards
      const lastObjectSeparator = cleaned.lastIndexOf("},");
      if (lastObjectSeparator !== -1) {
          cleaned = cleaned.substring(0, lastObjectSeparator + 1) + "]}";
      }
  }

  return cleaned;
};

export interface GenerationResult {
  deckName: string;
  categoryName: string;
  cards: FlashcardData[];
}

export const generateFlashcardsFromContent = async (
  files: { mimeType: string; data: string }[],
  topicContext?: string,
  deckType: DeckType = DeckType.FLASHCARDS,
  existingCategories: string[] = []
): Promise<GenerationResult> => {
  try {
    const modelId = "gemini-3-flash-preview"; 
    
    // Define the schema for strict JSON output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        deckName: {
          type: Type.STRING,
          description: "A short, descriptive name for this deck based on the content."
        },
        categoryName: {
          type: Type.STRING,
          description: `The best fitting category name for this deck. Choose from existing categories if appropriate: [${existingCategories.join(', ')}], or create a new one.`
        },
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "The question. Use double escaped LaTeX for math (e.g. \\\\( x \\\\))."
              },
              answer: {
                type: Type.STRING,
                description: deckType === DeckType.QCM ? "The explanation for the correct answer(s)." : "The answer. Use double escaped LaTeX for math."
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "For QCM: Provide exactly 4 options."
              },
              correctOptions: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
                description: "For QCM: Array of indices (0-3) of the correct options. Can be 1 or multiple."
              }
            },
            required: deckType === DeckType.QCM ? ["question", "answer", "options", "correctOptions"] : ["question", "answer"],
          }
        }
      },
      required: ["deckName", "categoryName", "cards"]
    };

    const prompt = `
      Analyze the attached documents (PDFs) and images deeply. 
      Create a comprehensive set of ${deckType === DeckType.QCM ? 'Multiple Choice Questions (QCM)' : 'flashcards'} based STRICTLY on the content found in the uploaded files.
      ${topicContext ? `Focus specifically on this topic: ${topicContext}` : ''}
      
      Instructions:
      1. STRICT ADHERENCE TO SOURCE: Use ONLY the information provided in the documents.
      2. CARD COUNT: Generate AS MANY UNIQUE CARDS AS POSSIBLE without repeating the same idea. Extract all key concepts, facts, formulas, and details.
      3. DECK TYPE: You are generating ${deckType === DeckType.QCM ? 'QCM (Multiple Choice Questions)' : 'Standard Flashcards'}.
         ${deckType === DeckType.QCM ? '- For each question, provide EXACTLY 4 options.\n         - Provide an array of correct option indices (0-3). There can be 1 or multiple correct options.\n         - The "answer" field should contain an explanation of why the correct options are right.' : ''}
      4. FORMATTING (CRITICAL):
         - You are outputting a raw JSON string. 
         - Use $ ... $ for inline math and $$ ... $$ for block math.
         - DO NOT use \\( ... \\) or \\[ ... \\].
         - You MUST escape backslashes in LaTeX commands so they are valid in JSON. For example, write "\\\\frac" instead of "\\frac", and "\\\\int" instead of "\\int".
         - For Chemistry, use $ \\\\ce{...} $.
         - Escape all double quotes inside strings (e.g. \\").
         - DO NOT use real line breaks inside strings. Use \\n for line breaks.
      5. STRICTLY GENERATE THE CONTENT IN THE SAME LANGUAGE AS THE SOURCE TEXT.
      6. Output pure JSON matching the requested schema.
    `;

    // Construct the parts array
    const contentParts = files.map(file => ({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType || "application/pdf", 
      },
    }));

    // Add the text prompt at the end
    contentParts.push({ text: prompt } as any);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: contentParts,
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        maxOutputTokens: 8192, 
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No data returned from Gemini.");
    }

    let parsedData: any = null;
    
    try {
        const cleanedText = cleanAndRepairJson(jsonText);
        parsedData = JSON.parse(cleanedText);
    } catch (e) {
        console.error("JSON Parsing Failed:", e);
        console.debug("Raw Text:", jsonText);
        throw new Error("The AI response was interrupted or malformed. Please try regenerating with fewer files or more specific instructions.");
    }
      
    // Add IDs to the cards for React keys
    const cardsWithIds = parsedData.cards.map((card: Omit<FlashcardData, 'id'>, index: number) => ({
      ...card,
      id: `card-${Date.now()}-${index}`
    }));

    return {
      deckName: parsedData.deckName || "Generated Deck",
      categoryName: parsedData.categoryName || "Uncategorized",
      cards: cardsWithIds
    };

  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw error;
  }
};