import React, { useState, useRef } from "react";
import { cropImageRegion, fileToBase64 } from "./cropUtils";
import { extractFormFieldsWithGemini } from "./aiServices";
import { startBrowserDictation } from "./speechServices";

const defaultFormData = {
  personal_info: {
    name: "",
    home_address: "",
    birth_date: "",
    age: "",
    sex: "",
    ht: "",
    wt: "",
    civil_status: "",
    home_tel_no: "",
    cell_phone_no: "",
    nationality: "",
    occupation: "",
    religion: "",
  },
  chief_complaint: "",
  history_present_illness: "",
  past_medical_history: {
    rheumatic_heart_disease: false,
    myocardial_infarct: false,
    cerebro_vascular_accident: false,
    asthma: false,
    diabetes: false,
    liver_disease: false,
    stomach_ulcers: false,
    kidney_disease: false,
    pregnancy: false,
    tb: false,
    hypertension: false,
    hypotension: false,
    allergy_specify: "",
    other_illnesses_specify: "",
    medications_currently_taking: "",
  },
  past_dental_history: {
    previous_extraction: {
      status: "",
      when: "",
    },
    denture: {
      none_upper: false,
      upper_type: "",
      upper_since: "",
      none_lower: false,
      lower_type: "",
      lower_since: "",
    },
  },
  extraoral: {
    head: { status: "Normal", specify: "" },
    tmj: { status: "Normal", specify: "" },
    eyes: { status: "Normal", specify: "" },
  },
  vital_signs: {
    blood_pressure: "",
    pulse_rate: "",
    respiratory_rate: "",
    temperature: "",
  },
  intraoral: {
    lip: { status: "Normal", specify: "" },
    palate: { status: "Normal", specify: "" },
    floor_of_mouth: { status: "Normal", specify: "" },
    tongue: { status: "Normal", specify: "" },
    gingiva: { status: "Normal", specify: "" },
    deposits_soft: false,
    deposits_hard: false,
    occlusion: "",
    other_abnormalities_noted: "",
  },
  tentative_diagnosis: "",
  recommended_treatment_plan: "",
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [odontogramCrop, setOdontogramCrop] = useState(null);
  const [consentCrop, setConsentCrop] = useState(null);
  const [errorNotice, setErrorNotice] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Speech Recognition States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const processFiles = async (files) => {
    if (!files || files.length < 2) {
      setErrorNotice("Please select both Page 1 and Page 2 scans of the Oral Diagnosis Form.");
      return;
    }

    setErrorNotice("");
    setLoading(true);

    try {
      // 1. Client-side Visual Crop Execution
      const img1 = new Image();
      const img2 = new Image();
      img1.src = URL.createObjectURL(files[0]);
      img2.src = URL.createObjectURL(files[1]);

      img1.onload = () => {
        // Slightly expanded Odontogram Region starting a tiny bit above "C. Mouth Examination"
        const crop = cropImageRegion(img1, { x: 3.5, y: 51.5, width: 93, height: 45.5 });
        setOdontogramCrop(crop);
      };

      img2.onload = () => {
        // Crop Consent & Signature Region from Page 2 (approx bottom 42%)
        const crop = cropImageRegion(img2, { x: 4, y: 57, width: 92, height: 41 });
        setConsentCrop(crop);
      };

      // 2. Gemini Vision Field Extraction via backend server
      const b64Page1 = await fileToBase64(files[0]);
      const b64Page2 = await fileToBase64(files[1]);
      const extractedData = await extractFormFieldsWithGemini(b64Page1, b64Page2);

      // Merge extracted fields with default template for reliable state access
      const merged = {
        ...defaultFormData,
        ...extractedData,
        personal_info: {
          ...defaultFormData.personal_info,
          ...(extractedData.personal_info || extractedData.patient_info || {}),
        },
        past_medical_history: {
          ...defaultFormData.past_medical_history,
          ...(extractedData.past_medical_history || {}),
        },
        past_dental_history: {
          ...defaultFormData.past_dental_history,
          ...(extractedData.past_dental_history || {}),
          previous_extraction: {
            ...defaultFormData.past_dental_history.previous_extraction,
            ...(extractedData.past_dental_history?.previous_extraction || {}),
          },
          denture: {
            ...defaultFormData.past_dental_history.denture,
            ...(extractedData.past_dental_history?.denture || {}),
          },
        },
        extraoral: {
          ...defaultFormData.extraoral,
          ...(extractedData.extraoral || {}),
        },
        vital_signs: {
          ...defaultFormData.vital_signs,
          ...(extractedData.vital_signs || {}),
        },
        intraoral: {
          ...defaultFormData.intraoral,
          ...(extractedData.intraoral || {}),
        },
      };

      setFormData(merged);
    } catch (err) {
      console.error(err);
      setErrorNotice(err.message || "Extraction failed. Please ensure GEMINI_API_KEY is configured.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    processFiles(files);
  };

  // Helper updater
  const updatePersonalInfo = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      personal_info: { ...prev.personal_info, [field]: value },
    }));
  };

  const updateMedicalHistory = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      past_medical_history: { ...prev.past_medical_history, [field]: value },
    }));
  };

  const updateDentalHistory = (sub, field, value) => {
    setFormData((prev) => ({
      ...prev,
      past_dental_history: {
        ...prev.past_dental_history,
        [sub]: { ...prev.past_dental_history[sub], [field]: value },
      },
    }));
  };

  const updateExtraoral = (key, field, value) => {
    setFormData((prev) => ({
      ...prev,
      extraoral: {
        ...prev.extraoral,
        [key]: { ...prev.extraoral[key], [field]: value },
      },
    }));
  };

  const updateVitalSign = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, [field]: value },
    }));
  };

  const updateIntraoral = (key, field, value) => {
    setFormData((prev) => ({
      ...prev,
      intraoral: {
        ...prev.intraoral,
        [key]: { ...prev.intraoral[key], [field]: value },
      },
    }));
  };

  // Voice Dictation Controls
  const toggleDictation = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setErrorNotice("");
      const rec = startBrowserDictation(
        (text) => {
          setFormData((prev) => ({
            ...prev,
            history_present_illness: (prev?.history_present_illness || "") + " " + text,
          }));
        },
        (err) => {
          console.error("Speech error:", err);
          setErrorNotice(err?.message || "Speech recognition error occurred.");
          setIsRecording(false);
        }
      );
      if (rec) {
        recognitionRef.current = rec;
        setIsRecording(true);
      }
    }
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={{ borderBottom: "2px solid #005a9c", paddingBottom: "12px", marginBottom: "20px" }}>
        <h2 style={{ color: "#005a9c", margin: "0 0 4px" }}>Centro Escolar University — School of Dentistry</h2>
        <h3 style={{ color: "#333", margin: "0 0 6px", fontWeight: "600" }}>Oral Diagnosis Form Auto-Fill Digitizer</h3>
        <p style={{ color: "#666", fontSize: "14px" }}>
          AI Vision OCR field extraction with visual Odontogram & Consent cropping
        </p>
      </header>

      {errorNotice && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #ef4444",
            color: "#b91c1c",
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span>{errorNotice}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {selectedFiles && selectedFiles.length >= 2 && !loading && (
              <button
                onClick={() => processFiles(selectedFiles)}
                style={{
                  background: "#b91c1c",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                🔄 Retry Extraction
              </button>
            )}
            <button
              onClick={() => setErrorNotice("")}
              style={{
                background: "transparent",
                border: "none",
                color: "#b91c1c",
                fontWeight: "bold",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Upload Input */}
      <section style={{ background: "#f1f5f9", padding: "16px", borderRadius: "8px", marginBottom: "24px", border: "1px solid #cbd5e1" }}>
        <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>1. Document Scan Upload</h4>
        <input type="file" multiple accept="image/*" onChange={handleFileUpload} style={{ cursor: "pointer" }} />
        <span style={{ fontSize: "13px", color: "#64748b", marginLeft: "12px" }}>
          Select <strong>Page 1 (Odontogram)</strong> and <strong>Page 2 (Consent)</strong> scans (hold Ctrl / Cmd).
        </span>
      </section>

      {loading && (
        <div style={{ background: "#eff6ff", border: "1px solid #3b82f6", color: "#1d4ed8", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px" }}>
          ⏳ Processing both pages with Gemini AI Vision and cropping Odontogram & Consent diagrams...
        </div>
      )}

      {formData && (
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: "24px", alignItems: "start" }}>
          {/* Left Column: Digitized Form Fields */}
          <div style={{ background: "#fff", padding: "20px", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "8px", marginTop: 0, color: "#1e293b" }}>
              2. Digitized Form Fields
            </h3>

            {/* Personal Information */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>Personal Information</legend>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Name</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.name || ""}
                    onChange={(e) => updatePersonalInfo("name", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Home Address</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.home_address || ""}
                    onChange={(e) => updatePersonalInfo("home_address", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Birth Date</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.birth_date || ""}
                    onChange={(e) => updatePersonalInfo("birth_date", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Age</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.age || ""}
                    onChange={(e) => updatePersonalInfo("age", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Sex</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.sex || ""}
                    onChange={(e) => updatePersonalInfo("sex", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Civil Status</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.civil_status || ""}
                    onChange={(e) => updatePersonalInfo("civil_status", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Ht.</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.ht || ""}
                    onChange={(e) => updatePersonalInfo("ht", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Wt.</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.wt || ""}
                    onChange={(e) => updatePersonalInfo("wt", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Home Tel. No.</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.home_tel_no || ""}
                    onChange={(e) => updatePersonalInfo("home_tel_no", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Cell Phone No.</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.cell_phone_no || ""}
                    onChange={(e) => updatePersonalInfo("cell_phone_no", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Nationality</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.nationality || ""}
                    onChange={(e) => updatePersonalInfo("nationality", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Occupation</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.occupation || ""}
                    onChange={(e) => updatePersonalInfo("occupation", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Religion</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.personal_info.religion || ""}
                    onChange={(e) => updatePersonalInfo("religion", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            {/* Case History */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>Case History</legend>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  A. Chief Complaint/s:
                </label>
                <textarea
                  style={{ width: "100%", height: "55px", padding: "6px", boxSizing: "border-box" }}
                  value={formData.chief_complaint || ""}
                  onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  B. History of Present Illness:
                </label>
                <textarea
                  style={{ width: "100%", height: "65px", padding: "6px", boxSizing: "border-box" }}
                  value={formData.history_present_illness || ""}
                  onChange={(e) => setFormData({ ...formData, history_present_illness: e.target.value })}
                />
                <button
                  type="button"
                  onClick={toggleDictation}
                  style={{
                    marginTop: "6px",
                    padding: "6px 12px",
                    backgroundColor: isRecording ? "#dc2626" : "#16a34a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {isRecording ? "⏹ Stop Dictation" : "🎤 Dictate Clinical Notes"}
                </button>
              </div>
            </fieldset>

            {/* C. Past History - Medical */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>
                C. Past History - Medical
              </legend>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 10px" }}>
                Marked conditions present (/), none (X)
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 12px", marginBottom: "14px" }}>
                {[
                  { key: "rheumatic_heart_disease", label: "Rheumatic Heart Disease" },
                  { key: "asthma", label: "Asthma" },
                  { key: "stomach_ulcers", label: "Stomach Ulcers" },
                  { key: "tb", label: "T.B." },
                  { key: "myocardial_infarct", label: "Myocardial Infarct" },
                  { key: "diabetes", label: "Diabetes" },
                  { key: "kidney_disease", label: "Kidney Disease" },
                  { key: "hypertension", label: "Hypertension" },
                  { key: "cerebro_vascular_accident", label: "Cerebro-Vascular Accident" },
                  { key: "liver_disease", label: "Liver Disease" },
                  { key: "pregnancy", label: "Pregnancy" },
                  { key: "hypotension", label: "Hypotension" },
                ].map((item) => (
                  <label key={item.key} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={!!formData.past_medical_history[item.key]}
                      onChange={(e) => updateMedicalHistory(item.key, e.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Allergy specify:</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.past_medical_history.allergy_specify || ""}
                    onChange={(e) => updateMedicalHistory("allergy_specify", e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Other illnesses specify:</label>
                  <input
                    type="text"
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    value={formData.past_medical_history.other_illnesses_specify || ""}
                    onChange={(e) => updateMedicalHistory("other_illnesses_specify", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Medications currently taking:</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                  value={formData.past_medical_history.medications_currently_taking || ""}
                  onChange={(e) => updateMedicalHistory("medications_currently_taking", e.target.value)}
                />
              </div>
            </fieldset>

            {/* C. Past History - Dental */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>
                C. Past History - Dental
              </legend>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: "600" }}>Previous Extraction:</span>
                <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="radio"
                    name="prev_extract"
                    checked={formData.past_dental_history.previous_extraction?.status === "Yes"}
                    onChange={() => updateDentalHistory("previous_extraction", "status", "Yes")}
                  />
                  Yes
                </label>
                <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="radio"
                    name="prev_extract"
                    checked={formData.past_dental_history.previous_extraction?.status === "No"}
                    onChange={() => updateDentalHistory("previous_extraction", "status", "No")}
                  />
                  No
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "200px" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>If Yes, when?</span>
                  <input
                    type="text"
                    style={{ flex: 1, padding: "5px" }}
                    value={formData.past_dental_history.previous_extraction?.when || ""}
                    onChange={(e) => updateDentalHistory("previous_extraction", "when", e.target.value)}
                  />
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "8px" }}>Denture:</span>
                
                {/* Upper Denture */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", width: "50px", fontWeight: "600" }}>Upper:</span>
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={!!formData.past_dental_history.denture?.none_upper}
                      onChange={(e) => updateDentalHistory("denture", "none_upper", e.target.checked)}
                    />
                    None
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px" }}>Type:</span>
                    <input
                      type="text"
                      style={{ padding: "4px", width: "120px" }}
                      value={formData.past_dental_history.denture?.upper_type || ""}
                      onChange={(e) => updateDentalHistory("denture", "upper_type", e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px" }}>Since:</span>
                    <input
                      type="text"
                      style={{ padding: "4px", width: "120px" }}
                      value={formData.past_dental_history.denture?.upper_since || ""}
                      onChange={(e) => updateDentalHistory("denture", "upper_since", e.target.value)}
                    />
                  </div>
                </div>

                {/* Lower Denture */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", width: "50px", fontWeight: "600" }}>Lower:</span>
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={!!formData.past_dental_history.denture?.none_lower}
                      onChange={(e) => updateDentalHistory("denture", "none_lower", e.target.checked)}
                    />
                    None
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px" }}>Type:</span>
                    <input
                      type="text"
                      style={{ padding: "4px", width: "120px" }}
                      value={formData.past_dental_history.denture?.lower_type || ""}
                      onChange={(e) => updateDentalHistory("denture", "lower_type", e.target.value)}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px" }}>Since:</span>
                    <input
                      type="text"
                      style={{ padding: "4px", width: "120px" }}
                      value={formData.past_dental_history.denture?.lower_since || ""}
                      onChange={(e) => updateDentalHistory("denture", "lower_since", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* A. Extraoral & Vital Signs */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>
                Clinical Examination — A. Extraoral
              </legend>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", marginBottom: "14px" }}>
                {[
                  { key: "head", label: "Head" },
                  { key: "tmj", label: "TMJ" },
                  { key: "eyes", label: "Eyes" },
                ].map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ width: "50px", fontSize: "13px", fontWeight: "600" }}>{item.label}:</span>
                    <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="radio"
                        name={`extraoral_${item.key}`}
                        checked={formData.extraoral[item.key]?.status === "Normal"}
                        onChange={() => updateExtraoral(item.key, "status", "Normal")}
                      />
                      Normal
                    </label>
                    <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="radio"
                        name={`extraoral_${item.key}`}
                        checked={formData.extraoral[item.key]?.status === "Abnormal"}
                        onChange={() => updateExtraoral(item.key, "status", "Abnormal")}
                      />
                      Abnormal, specify:
                    </label>
                    <input
                      type="text"
                      style={{ flex: 1, minWidth: "160px", padding: "4px" }}
                      placeholder="Specify if abnormal..."
                      value={formData.extraoral[item.key]?.specify || ""}
                      onChange={(e) => updateExtraoral(item.key, "specify", e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Vital Signs */}
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#005a9c", display: "block", marginBottom: "8px" }}>
                  Vital Signs
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Blood Pressure</label>
                    <input
                      type="text"
                      style={{ width: "100%", padding: "5px", boxSizing: "border-box" }}
                      value={formData.vital_signs?.blood_pressure || ""}
                      onChange={(e) => updateVitalSign("blood_pressure", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Pulse Rate</label>
                    <input
                      type="text"
                      style={{ width: "100%", padding: "5px", boxSizing: "border-box" }}
                      value={formData.vital_signs?.pulse_rate || ""}
                      onChange={(e) => updateVitalSign("pulse_rate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Respiratory Rate</label>
                    <input
                      type="text"
                      style={{ width: "100%", padding: "5px", boxSizing: "border-box" }}
                      value={formData.vital_signs?.respiratory_rate || ""}
                      onChange={(e) => updateVitalSign("respiratory_rate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Temperature</label>
                    <input
                      type="text"
                      style={{ width: "100%", padding: "5px", boxSizing: "border-box" }}
                      value={formData.vital_signs?.temperature || ""}
                      onChange={(e) => updateVitalSign("temperature", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* B. Intraoral */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px", marginBottom: "20px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>
                Clinical Examination — B. Intraoral
              </legend>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", marginBottom: "14px" }}>
                {[
                  { key: "lip", label: "Lip" },
                  { key: "palate", label: "Palate" },
                  { key: "floor_of_mouth", label: "Floor of the Mouth" },
                  { key: "tongue", label: "Tongue" },
                  { key: "gingiva", label: "Gingiva" },
                ].map((item) => (
                  <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ width: "130px", fontSize: "13px", fontWeight: "600" }}>{item.label}:</span>
                    <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="radio"
                        name={`intraoral_${item.key}`}
                        checked={formData.intraoral[item.key]?.status === "Normal"}
                        onChange={() => updateIntraoral(item.key, "status", "Normal")}
                      />
                      Normal
                    </label>
                    <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="radio"
                        name={`intraoral_${item.key}`}
                        checked={formData.intraoral[item.key]?.status === "Abnormal"}
                        onChange={() => updateIntraoral(item.key, "status", "Abnormal")}
                      />
                      Abnormal, specify:
                    </label>
                    <input
                      type="text"
                      style={{ flex: 1, minWidth: "140px", padding: "4px" }}
                      placeholder="Specify if abnormal..."
                      value={formData.intraoral[item.key]?.specify || ""}
                      onChange={(e) => updateIntraoral(item.key, "specify", e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Deposits & Occlusion */}
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Deposits:</span>
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={!!formData.intraoral.deposits_soft}
                      onChange={(e) => setFormData({ ...formData, intraoral: { ...formData.intraoral, deposits_soft: e.target.checked } })}
                    />
                    Soft
                  </label>
                  <label style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={!!formData.intraoral.deposits_hard}
                      onChange={(e) => setFormData({ ...formData, intraoral: { ...formData.intraoral, deposits_hard: e.target.checked } })}
                    />
                    Hard
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>Occlusion:</span>
                  {["Class I", "Class II", "Class III"].map((cls) => (
                    <label key={cls} style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="radio"
                        name="occlusion_radio"
                        checked={formData.intraoral.occlusion === cls}
                        onChange={() => setFormData({ ...formData, intraoral: { ...formData.intraoral, occlusion: cls } })}
                      />
                      {cls}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", display: "block" }}>Other Oral Abnormalities noted:</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                  value={formData.intraoral.other_abnormalities_noted || ""}
                  onChange={(e) => setFormData({ ...formData, intraoral: { ...formData.intraoral, other_abnormalities_noted: e.target.value } })}
                />
              </div>
            </fieldset>

            {/* Tentative Diagnosis & Treatment Plan (Page 2) */}
            <fieldset style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "14px" }}>
              <legend style={{ fontWeight: "700", color: "#005a9c", padding: "0 6px" }}>
                Diagnosis & Treatment Plan (Page 2)
              </legend>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  Tentative Diagnosis:
                </label>
                <textarea
                  style={{ width: "100%", height: "60px", padding: "6px", boxSizing: "border-box" }}
                  value={formData.tentative_diagnosis || ""}
                  onChange={(e) => setFormData({ ...formData, tentative_diagnosis: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                  Recommended Treatment Plan:
                </label>
                <textarea
                  style={{ width: "100%", height: "60px", padding: "6px", boxSizing: "border-box" }}
                  value={formData.recommended_treatment_plan || ""}
                  onChange={(e) => setFormData({ ...formData, recommended_treatment_plan: e.target.value })}
                />
              </div>
            </fieldset>
          </div>

          {/* Right Column: Embedded Cropped Visual Sections */}
          <div style={{ position: "sticky", top: "20px", background: "#fff", padding: "20px", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: "8px", marginTop: 0, color: "#1e293b" }}>
              3. Embedded Cropped Sections
            </h3>

            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <h4 style={{ margin: 0, color: "#005a9c", fontSize: "15px" }}>Odontogram Record (Page 1 Crop)</h4>
                <span style={{ fontSize: "11px", color: "#64748b" }}>C. Mouth Examination & Teeth Chart</span>
              </div>
              {odontogramCrop ? (
                <div style={{ border: "2px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#f8fafc" }}>
                  <img
                    src={odontogramCrop}
                    alt="Cropped Odontogram Section"
                    style={{ width: "100%", display: "block", height: "auto" }}
                  />
                </div>
              ) : (
                <div style={{ padding: "40px 20px", textAlign: "center", border: "2px dashed #cbd5e1", borderRadius: "6px", color: "#94a3b8" }}>
                  Awaiting Page 1 scan upload...
                </div>
              )}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <h4 style={{ margin: 0, color: "#005a9c", fontSize: "15px" }}>Consent & Signatures (Page 2 Crop)</h4>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Dental Procedure Consent Form</span>
              </div>
              {consentCrop ? (
                <div style={{ border: "2px solid #cbd5e1", borderRadius: "6px", overflow: "hidden", background: "#f8fafc" }}>
                  <img
                    src={consentCrop}
                    alt="Cropped Consent Section"
                    style={{ width: "100%", display: "block", height: "auto" }}
                  />
                </div>
              ) : (
                <div style={{ padding: "40px 20px", textAlign: "center", border: "2px dashed #cbd5e1", borderRadius: "6px", color: "#94a3b8" }}>
                  Awaiting Page 2 scan upload...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
