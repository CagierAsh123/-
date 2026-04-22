import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import YanbianMap from './YanbianMap.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <YanbianMap />
  </StrictMode>,
)
