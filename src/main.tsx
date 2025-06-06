import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { setupIonicReact } from '@ionic/react';
import { BrowserRouter } from 'react-router-dom';
import { IonReactRouter } from '@ionic/react-router';

// Initialize Ionic
setupIonicReact();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <IonReactRouter>
  
  <React.StrictMode>
    <App />
  </React.StrictMode>

        </IonReactRouter>
  );