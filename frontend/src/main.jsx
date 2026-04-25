import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { WebSocketProvider } from './services/ws.jsx';
import { AuthProvider } from './services/auth.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
