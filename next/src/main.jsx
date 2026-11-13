import { fontsReady } from './fonts.js';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

fontsReady.finally(() => createRoot(document.getElementById('root')).render(<App />));
