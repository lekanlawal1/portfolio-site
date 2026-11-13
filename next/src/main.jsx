import '@fontsource/libre-caslon-text/latin-400.css';
import '@fontsource/libre-caslon-text/latin-400-italic.css';
import '@fontsource/libre-franklin/latin-400.css';
import '@fontsource/libre-franklin/latin-600.css';
import '@fontsource/libre-franklin/latin-800.css';
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/nanum-pen-script/latin-400.css';
import '@fontsource-variable/archivo/wdth.css';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Start fetching the heavy 3D chunk now, in parallel with the fonts, instead of after React mounts.
if (!/^#(list|skills)/.test(location.hash)) import('./Scene.jsx');

// Paper, brass and card faces are drawn with these fonts, so load them before the first texture.
const faces = ["400 40px 'Libre Caslon Text'", "italic 400 40px 'Libre Caslon Text'", "400 40px 'Libre Franklin'",
  "400 40px 'Courier Prime'", "700 40px 'Courier Prime'", "400 40px 'Nanum Pen Script'", "expanded 600 40px 'Archivo Variable'"];
Promise.all(faces.map((f) => document.fonts.load(f)))
  .catch(() => {})
  .finally(() => createRoot(document.getElementById('root')).render(<App />));
