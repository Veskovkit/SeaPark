import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles/helm.css';
import App from './App.jsx';
import CoastGuardDashboard from './pages/CoastGuardDashboard.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/coastguard" element={<CoastGuardDashboard />} />
      </Routes>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0a1e35',
            color: '#e2f4ff',
            border: '1px solid rgba(0, 212, 255, 0.2)',
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
);
