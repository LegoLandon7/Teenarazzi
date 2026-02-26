import { Routes, Route } from "react-router-dom"

import './css/App.css'
import './css/index.css'

import Navbar from './components/specific/Navbar.jsx'

import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Users from './pages/Users.jsx'

import ScrollToTop from "./components/tools/ScrollToTop.jsx"

function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />}/>
        <Route path="/about" element={<About />}/>
        <Route path="/users" element={<Users />}/>
      </Routes>
    </>
  )
}

export default App
