/**
 * Starts free browser speech recognition for Taglish / English dictation.
 */
export function startBrowserDictation(onResultCallback, onErrorCallback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    alert("Speech recognition is not supported in this browser. Please open in Google Chrome.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "fil-PH"; // Sets accent/language recognition to Tagalog/English mix

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        transcript += event.results[i][0].transcript;
      }
    }
    if (transcript) onResultCallback(transcript);
  };

  if (onErrorCallback) {
    recognition.onerror = onErrorCallback;
  }

  recognition.start();
  return recognition;
}