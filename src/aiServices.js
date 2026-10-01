import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const ai = new GoogleGenAI({ 
  apiKey: apiKey,
  dangerouslyAllowBrowser: true 
});

export async function extractFormFieldsWithGemini(base64Page1, base64Page2) {
  const prompt = `
    Extract all handwritten and printed information from these two pages of an Oral Diagnosis Form.
    EXCLUDE the Odontogram diagram on Page 1 and the Consent/Signature text block on Page 2.
    
    Return ONLY a valid raw JSON object (no markdown formatting, no code blocks) matching this exact structure:
    {
      "patient_info": {
        "name": "",
        "age": "",
        "sex": "",
        "birth_date": "",
        "civil_status": "",
        "address": "",
        "phone": ""
      },
      "chief_complaint": "",
      "history_present_illness": "",
      "vital_signs": {
        "bp": "",
        "pr": "",
        "rr": "",
        "temp": ""
      },
      "tentative_diagnosis": "",
      "recommended_treatment_plan": ""
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Updated to gemini-2.5-flash
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Page1 } },
            { inlineData: { mimeType: "image/jpeg", data: base64Page2 } },
          ],
        },
      ],
    });

    const rawText = response.text;
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini API Error details:", error);
    throw error;
  }
}