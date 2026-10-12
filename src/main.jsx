import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const hidePreloader = () => {
  const el = document.getElementById('preloader')
  if (el) {
    el.classList.add('hide')
    setTimeout(() => el.remove(), 600)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

window.addEventListener('load', hidePreloader)
