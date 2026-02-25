import './css/App.css'
import './css/index.css'
import Navbar from './components/Navbar.jsx'
import InfoBlock from './components/InfoBlock.jsx'
import IconStats from './components/IconStats.jsx'
import './css/tools/flex-container.css'
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
        <div className='flex-container-column'>
            <InfoBlock />
            <IconStats />
        </div>
      </div>
    </>
  )
}

export default App
