import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './css/App.css'
import './css/index.css'
import Navbar from './components/Navbar.jsx'
import InfoBlock from './components/InfoBlock.jsx'
import { Routes, Route } from "react-router-dom"

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" />
        <Route path="/about" />
      </Routes>

      <div className="main-content">
            <InfoBlock />
      </div>
    </>
  )
}

export default App
