import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FlagProvider } from './context/FlagContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FlagProvider>
      <App />
    </FlagProvider>
  </StrictMode>,
)
