# VitalVision — Video-Based Vital Signs Monitoring

**CMC Vellore — Computer Science Internship Project**

A web application that analyses a short video recording to non-invasively extract:
- ❤️ Heart Rate (rPPG / POS algorithm)
- 🫁 SpO2 Estimation (Beer-Lambert R/G ratio)
- 🧠 Stress Level (Facial expression / FACS)
- 🌡️ Temperature Proxy (Red-channel intensity)
- 🔔 Automated Health Alerts

---

## 📁 Project Structure

```
vitalvision/
├── src/                        # React frontend
│   ├── pages/
│   │   ├── OnboardingPage.js   # Landing / system checks
│   │   ├── RecordingPage.js    # Webcam recording & file upload
│   │   ├── ProcessingPage.js   # Animated analysis pipeline
│   │   ├── ResultsPage.js      # Dashboard with charts & PDF export
│   │   └── HistoryPage.js      # Session history (IndexedDB)
│   ├── components/
│   │   └── Navbar.js
│   ├── utils/
│   │   ├── signalProcessing.js # rPPG, SpO2, FFT, Butterworth filter
│   │   ├── db.js               # IndexedDB session storage
│   │   └── pdfReport.js        # jsPDF report generator
│   └── styles/global.css
├── backend/
│   ├── main.py                 # FastAPI server
│   └── requirements.txt
├── public/index.html
└── package.json
```

---

## 🚀 Quick Start (Frontend Only — Visual Studio Code)

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- VS Code with "ES7+ React Snippets" extension (optional)

### Steps

```bash
# 1. Open terminal in VS Code (Ctrl + `)

# 2. Navigate to project folder
cd vitalvision

# 3. Install dependencies
npm install

# 4. Start development server
npm start
```

Browser opens automatically at **http://localhost:3000**

---

## 🐍 Backend (Optional — for heavy video processing)

The frontend works standalone with simulated analysis for demo.
To enable real rPPG processing, run the Python backend:

### Prerequisites
- Python 3.10+ 
- pip

### Steps

```bash
# Navigate to backend folder
cd vitalvision/backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn main:app --reload --port 8000
```

API runs at **http://localhost:8000**
Docs at **http://localhost:8000/docs**

---

## 🔬 Algorithms Implemented

| Metric | Algorithm | Reference |
|--------|-----------|-----------|
| Heart Rate | POS (Plane-Orthogonal-to-Skin) | Wang et al., IEEE TBME 2017 |
| Heart Rate | CHROM (Chrominance-based) | De Haan & Jeanne, IEEE TBME 2013 |
| Heart Rate | Welch FFT PSD peak detection | — |
| Signal Filtering | Butterworth 4th-order bandpass (0.75–4.0 Hz) | — |
| SpO2 | Beer-Lambert R/G ratio | Verkruysse et al., Optics Express 2008 |
| SpO2 | AC/DC ratio calibration | Guazzi et al., Biomed. Optics 2015 |
| Emotion | FER CNN (7 classes) | Goodfellow et al., 2013 |
| Face Detection | MediaPipe Face Mesh (468 landmarks) | Lugaresi et al., 2019 |
| Outlier Rejection | IQR-based frame exclusion | — |

---

## ⚙️ VS Code Recommended Extensions

- ESLint
- Prettier
- ES7+ React/Redux/React-Native snippets
- Auto Import
- GitLens
- Thunder Client (API testing)

---

## ⚠️ Medical Disclaimer

VitalVision results are **indicative only** and are **NOT** a substitute for professional medical diagnosis, clinical examination, or certified medical devices. Always consult a qualified healthcare professional for clinical decisions.

---

## 📚 References

1. Verkruysse et al. (2008). Remote plethysmographic imaging using ambient light. *Optics Express*, 16(26).
2. De Haan & Jeanne (2013). Robust pulse rate from chrominance-based rPPG. *IEEE TBME*, 60(10).
3. Wang et al. (2017). Algorithmic principles of remote PPG. *IEEE TBME*, 64(7).
4. Guazzi et al. (2015). Non-contact measurement of oxygen saturation with an RGB camera. *Biomed. Optics Express*, 6(9).
5. Lugaresi et al. (2019). MediaPipe: A framework for building perception pipelines. arXiv:1906.08172.
