import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/global.css';
import Navbar from './components/Navbar';
import OnboardingPage from './pages/OnboardingPage';
import RecordingPage from './pages/RecordingPage';
import ProcessingPage from './pages/ProcessingPage';
import ResultsPage from './pages/ResultsPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<OnboardingPage />} />
            <Route path="/record" element={<RecordingPage />} />
            <Route path="/processing" element={<ProcessingPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
