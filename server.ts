import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable large body payloads for scan images
app.use(express.json({ limit: '50mb' }));

function parseBase64(input: string, fallbackMime = 'image/jpeg') {
  if (typeof input === 'string' && input.startsWith('data:')) {
    const matches = input.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      return { mimeType: matches[1], data: matches[2] };
    }
  }
  const cleanData = typeof input === 'string' ? input.replace(/^data:image\/[a-z]+;base64,/, '') : '';
  return { mimeType: fallbackMime, data: cleanData };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

app.post('/api/extract', async (req, res) => {
  try {
    const { base64Page1, base64Page2 } = req.body;
    if (!base64Page1 || !base64Page2) {
      return res.status(400).json({ error: 'Please select both Page 1 and Page 2 scans of the Oral Diagnosis Form.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API Key is not configured. Please ensure your API key is configured in the environment or Settings > Secrets panel.',
      });
    }

    const page1 = parseBase64(base64Page1);
    const page2 = parseBase64(base64Page2);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `
    You are an expert dental clinical records digitizer.
    Extract all handwritten, typed, checked, and marked information from these two pages of an Oral Diagnosis Form (Centro Escolar University School of Dentistry).
    EXCLUDE the Odontogram teeth chart on Page 1 (Section C. Mouth Examination) and the Dental Procedure Consent Form on Page 2 (as both are visually cropped separately).
    
    Return ONLY a valid raw JSON object matching this exact structure:
    {
      "personal_info": {
        "name": "",
        "home_address": "",
        "birth_date": "",
        "age": "",
        "sex": "",
        "ht": "",
        "wt": "",
        "civil_status": "",
        "home_tel_no": "",
        "cell_phone_no": "",
        "nationality": "",
        "occupation": "",
        "religion": ""
      },
      "chief_complaint": "",
      "history_present_illness": "",
      "past_medical_history": {
        "rheumatic_heart_disease": false,
        "myocardial_infarct": false,
        "cerebro_vascular_accident": false,
        "asthma": false,
        "diabetes": false,
        "liver_disease": false,
        "stomach_ulcers": false,
        "kidney_disease": false,
        "pregnancy": false,
        "tb": false,
        "hypertension": false,
        "hypotension": false,
        "allergy_specify": "",
        "other_illnesses_specify": "",
        "medications_currently_taking": ""
      },
      "past_dental_history": {
        "previous_extraction": {
          "status": "",
          "when": ""
        },
        "denture": {
          "none_upper": false,
          "upper_type": "",
          "upper_since": "",
          "none_lower": false,
          "lower_type": "",
          "lower_since": ""
        }
      },
      "extraoral": {
        "head": { "status": "Normal", "specify": "" },
        "tmj": { "status": "Normal", "specify": "" },
        "eyes": { "status": "Normal", "specify": "" }
      },
      "vital_signs": {
        "blood_pressure": "",
        "pulse_rate": "",
        "respiratory_rate": "",
        "temperature": ""
      },
      "intraoral": {
        "lip": { "status": "Normal", "specify": "" },
        "palate": { "status": "Normal", "specify": "" },
        "floor_of_mouth": { "status": "Normal", "specify": "" },
        "tongue": { "status": "Normal", "specify": "" },
        "gingiva": { "status": "Normal", "specify": "" },
        "deposits_soft": false,
        "deposits_hard": false,
        "occlusion": "",
        "other_abnormalities_noted": ""
      },
      "tentative_diagnosis": "",
      "recommended_treatment_plan": ""
    }

    Extraction Instructions:
    - In Past History Medical: A slash (/) or check mark means true; (X) or empty means false.
    - In Previous Extraction: if Yes is checked, status is "Yes"; if No is checked, status is "No". If when is written, capture it.
    - In Denture: if None is marked for Upper, set none_upper to true; otherwise capture upper_type and upper_since. Same for Lower.
    - In Extraoral and Intraoral: if Normal is checked, set status to "Normal"; if Abnormal is checked or notes are written, set status to "Abnormal" and fill specify.
    - In Deposits: check if Soft and/or Hard are checked.
    - In Occlusion: Class I, Class II, Class III, or empty.
    - In Tentative Diagnosis and Recommended Treatment Plan: include numbered items or full text found on Page 2.
  `;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: page1.mimeType, data: page1.data } },
                  { inlineData: { mimeType: page2.mimeType, data: page2.data } },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.LOW,
              },
            },
          });

          const rawText = response.text || '';
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to parse structured JSON from Gemini response.');
          }
          const cleanJson = jsonMatch[0];
          const extractedData = JSON.parse(cleanJson);

          return res.json(extractedData);
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code || (err?.message?.includes('503') ? 503 : 0);
          console.warn(`Extraction attempt with ${model} (attempt ${attempt + 1}) failed:`, err?.message || err);

          if (status === 503 || status === 429 || err?.message?.includes('high demand') || err?.message?.includes('503')) {
            await sleep(1500 * (attempt + 1));
            continue;
          } else {
            break;
          }
        }
      }
    }

    throw lastError || new Error('Extraction failed after retrying.');
  } catch (error: any) {
    console.error('Gemini API extraction error:', error);
    let message = error?.message || 'Extraction failed while processing oral diagnosis scans.';
    if (message.includes('high demand') || message.includes('503')) {
      message = 'The AI model is momentarily experiencing a high demand spike on Google servers. Please retry in a few seconds.';
    }
    return res.status(500).json({ error: message });
  }
});

// Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true, host: '0.0.0.0' },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});
