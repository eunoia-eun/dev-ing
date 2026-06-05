import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ServicesProvider } from './ui/ServicesContext';
import { App } from './ui/App';
import './ui/styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소를 찾을 수 없습니다.');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <ServicesProvider>
        <App />
      </ServicesProvider>
    </HashRouter>
  </React.StrictMode>,
);
