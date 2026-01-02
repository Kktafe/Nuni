/**
 * TAFE Sales Assistant - Edge AI Core
 * Leveraging Gemini Nano (window.ai) & Web Speech Synthesis
 */

let csvContent = "";
const synth = window.speechSynthesis;
let availableVoices = [];

// UI Elements
const voiceBtn = document.getElementById('voiceBtn');
const responseDiv = document.getElementById('response');
const statusDiv = document.getElementById('status');
const langSelect = document.getElementById('langSelect');
const voiceTypeSelect = document.getElementById('voiceType');

// 1. Initialize Voices (Required for Chrome)
function loadVoices() {
    availableVoices = synth.getVoices();
}
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

// 2. Handle CSV Upload & Local Parsing
document.getElementById('csvFile').onchange = (e) => {
    const file = e.target.files[0];
    statusDiv.innerText = "Status: Parsing CSV...";
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            // Context Management: 25 cols x 50 rows might hit token limits.
            // We take the first 25 high-priority rows for the demo.
            csvContent = JSON.stringify(results.data.slice(0, 25)); 
            statusDiv.innerText = `Status: ${results.data.length} Models Loaded (Offline)`;
            responseDiv.innerText = "Ready. Ask a question about Massey Ferguson models.";
        }
    });
};

// 3. Voice Logic (The Persona Engine)
function getVoicePersona(type, langCode) {
    // Finds a local voice matching the language
    const voice = availableVoices.find(v => v.lang.startsWith(langCode)) || availableVoices[0];
    
    let profile = { voice: voice, pitch: 1.0, rate: 1.0 };

    switch(type) {
        case 'male-bass': 
            profile.pitch = 0.5; // Deepest
            profile.rate = 0.85; // Slower for gravitas
            break;
        case 'male-baritone': 
            profile.pitch = 0.8; 
            profile.rate = 1.0; 
            break;
        case 'female-contralto': 
            profile.pitch = 0.85; 
            profile.rate = 0.9; 
            break;
        case 'female-mezzo': 
            profile.pitch = 1.2; 
            profile.rate = 1.0; 
            break;
    }
    return profile;
}

// 4. Speech Recognition (Input)
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = false;
recognition.interimResults = false;

voiceBtn.onclick = () => {
    if (!csvContent) {
        alert("Please upload the Sales CSV first!");
        return;
    }
    recognition.lang = getLangCode(langSelect.value);
    recognition.start();
    voiceBtn.classList.add('recording');
    statusDiv.innerText = "Status: Listening...";
};

recognition.onresult = (event) => {
    voiceBtn.classList.remove('recording');
    const userQuery = event.results[0][0].transcript;
    statusDiv.innerText = `Query: "${userQuery}"`;
    askGemini(userQuery);
};

// 5. The "Brain": Gemini Nano Inference
async function askGemini(query) {
    if (!window.ai || !window.ai.languageModel) {
        responseDiv.innerText = "Error: Gemini Nano not detected. Ensure chrome://flags are enabled.";
        return;
    }

    const selectedLang = langSelect.value;
    const langCode = getLangCode(selectedLang);

    try {
        statusDiv.innerText = "Status: Local AI is thinking...";
        
        const session = await window.ai.languageModel.create({
            systemPrompt: `You are an expert TAFE Sales Assistant. 
            Analyze this CSV data: ${csvContent}.
            Answer the user's question based ONLY on this data.
            Crucial: You MUST respond in ${selectedLang} language only. 
            Keep the answer technical yet easy for a farmer to understand.`
        });

        const result = await session.prompt(query);
        responseDiv.innerText = result;

        // Trigger the Audio Persona
        speakResponse(result, langCode);
        
        statusDiv.innerText = "Status: Done (Zero-Cloud Inference)";
    } catch (err) {
        responseDiv.innerText = "AI Error: " + err.message;
        statusDiv.innerText = "Status: Error";
    }
}

// 6. Audio Output
function speakResponse(text, langCode) {
    const persona = getVoicePersona(voiceTypeSelect.value, langCode);
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.voice = persona.voice;
    utterance.pitch = persona.pitch;
    utterance.rate = persona.rate;
    utterance.lang = langCode;

    synth.speak(utterance);
}

// Helper: Map Display Language to BCP-47 Codes
function getLangCode(lang) {
    const codes = {
        'English': 'en-IN',
        'Hindi': 'hi-IN',
        'Tamil': 'ta-IN',
        'Telugu': 'te-IN',
        'Marathi': 'mr-IN'
    };
    return codes[lang] || 'en-IN';
}