import React, { useState, useRef } from "react";
import { cropImageRegion, fileToBase64 } from "./cropUtils";
import { extractFormFieldsWithGemini } from "./aiServices";
import { startBrowserDictation } from "./speechServices";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [odontogramCrop, setOdontogramCrop] = useState(null);
  const [consentCrop, setConsentCrop] = useState(null);

  // Speech Recognition States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length < 2) {
      return alert("Please select both Page 1 and Page 2 scans of the Oral Diagnosis Form.");
    }

    setLoading(true);

    try {
      // 1. Client-side Visual Crop Execution
      const img1 = new Image();
      const img2 = new Image();
      img1.src = URL.createObjectURL(files[0]);
      img2.src = URL.createObjectURL(files[1]);

      img1.onload = () => {
        // Crop Odontogram Region from Page 1 (approx bottom 44%)
        const crop = cropImageRegion(img1, { x: 5, y: 52, width: 90, height: 44 });
        setOdontogramCrop(crop);
      };

      img2.onload = () => {
        // Crop Consent & Signature Region from Page 2 (approx bottom 38%)
        const crop = cropImageRegion(img2, { x: 5, y: 58, width: 90, height: 38 });
        setConsentCrop(crop);
      };

      // 2. Gemini 1.5 Flash Vision Field Extraction
      const b64Page1 = await fileToBase64(files[0]);
      const b64Page2 = await fileToBase64(files[1]);
      const extractedData = await extractFormFieldsWithGemini(b64Page1, b64Page2);

      setFormData(extractedData);
    } catch (err) {
      console.error(err);
      alert("Extraction failed. Make sure your VITE_GEMINI_API_KEY is correctly set in .env");
    } finally {
      setLoading(false);
    }
  };

  // Voice Dictation Controls
  const toggleDictation = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      const rec = startBrowserDictation(
        (text) => {
          setFormData((prev) => ({
            ...prev,
            history_present_illness: (prev?.history_present_illness || "") + " " + text,
          }));
        },
        (err) => console.error("Speech error:", err)
      );
      if (rec) {
        recognitionRef.current = rec;
        setIsRecording(true);
      }
    }
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <header style={{ borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "20px" }}>
        <h2>I-Teeth: Oral Diagnosis Form Auto-Fill Prototype</h2>
      </header>

      {/* Upload Input */}
      <section style={{ background: "#f5f5f5", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>1. Document Scan Upload</h3>
        <input type="file" multiple accept="image/*" onChange={handleFileUpload} />
        <span style={{ fontSize: "12px", color: "#666", marginLeft: "10px" }}>
          Hold Ctrl / Cmd to select both Page 1 and Page 2 scans.
        </span>
      </section>

      {loading && <p style={{ color: "#0066cc", fontWeight: "bold" }}>Processing document scans with Gemini AI...</p>}

      {formData && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Left Column: Digitized Form Fields */}
          <div style={{ background: "#fff", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h3>2. Digitized Form Fields</h3>
            
            <label style={{ fontWeight: "bold" }}>Patient Name:</label>
            <input
              type="text"
              style={{ width: "100%", padding: "6px", marginBottom: "12px" }}
              value={formData.patient_info?.name || ""}
              onChange={(e) => setFormData({ ...formData, patient_info: { ...formData.patient_info, name: e.target.value } })}
            />

            <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontWeight: "bold" }}>Age:</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px" }}
                  value={formData.patient_info?.age || ""}
                  onChange={(e) => setFormData({ ...formData, patient_info: { ...formData.patient_info, age: e.target.value } })}
                />
              </div>
              <div>
                <label style={{ fontWeight: "bold" }}>Sex:</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px" }}
                  value={formData.patient_info?.sex || ""}
                  onChange={(e) => setFormData({ ...formData, patient_info: { ...formData.patient_info, sex: e.target.value } })}
                />
              </div>
            </div>

            <label style={{ fontWeight: "bold" }}>Chief Complaint:</label>
            <textarea
              style={{ width: "100%", height: "50px", padding: "6px", marginBottom: "12px" }}
              value={formData.chief_complaint || ""}
              onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
            />

            <label style={{ fontWeight: "bold" }}>History of Present Illness:</label>
            <textarea
              style={{ width: "100%", height: "70px", padding: "6px", marginBottom: "8px" }}
              value={formData.history_present_illness || ""}
              onChange={(e) => setFormData({ ...formData, history_present_illness: e.target.value })}
            />

            <button
              onClick={toggleDictation}
              style={{
                padding: "8px 12px",
                backgroundColor: isRecording ? "#cc0000" : "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginBottom: "15px"
              }}
            >
              {isRecording ? "Stop Dictation" : "🎤 Dictate Clinical Notes"}
            </button>

            <label style={{ fontWeight: "bold", display: "block" }}>Tentative Diagnosis:</label>
            <input
              type="text"
              style={{ width: "100%", padding: "6px", marginBottom: "12px" }}
              value={formData.tentative_diagnosis || ""}
              onChange={(e) => setFormData({ ...formData, tentative_diagnosis: e.target.value })}
            />
          </div>

          {/* Right Column: Embedded Cropped Visual Sections */}
          <div style={{ background: "#fff", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h3>3. Embedded Cropped Sections</h3>

            <div style={{ marginBottom: "20px" }}>
              <h4>Odontogram Record (Page 1 Crop)</h4>
              {odontogramCrop ? (
                <img src={odontogramCrop} alt="Cropped Odontogram" style={{ width: "100%", border: "1px solid #aaa", borderRadius: "4px" }} />
              ) : <p style={{ color: "#999" }}>Awaiting scan upload...</p>}
            </div>

            <div>
              <h4>Consent & Signatures (Page 2 Crop)</h4>
              {consentCrop ? (
                <img src={consentCrop} alt="Cropped Consent" style={{ width: "100%", border: "1px solid #aaa", borderRadius: "4px" }} />
              ) : <p style={{ color: "#999" }}>Awaiting scan upload...</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}