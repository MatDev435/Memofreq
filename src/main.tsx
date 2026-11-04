import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/styles/global.css';
import './ui/styles/game.css';
import './ui/styles/results.css';
import './ui/styles/multiplayer.css';
import './ui/styles/motion.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Elemento raiz da aplicação não encontrado.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
