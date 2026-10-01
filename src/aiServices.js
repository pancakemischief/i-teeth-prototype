/**
 * Extracts form fields from Page 1 and Page 2 scans using the backend server endpoint
 * powered by Google Gemini API.
 */
export async function extractFormFieldsWithGemini(base64Page1, base64Page2) {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Page1, base64Page2 }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Extraction failed with status ${response.status}`);
  }

  return response.json();
}
