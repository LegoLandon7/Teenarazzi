import { Routes, Route } from "react-router-dom"

import './css/App.css'
import './css/index.css'
import './css/tools/flex-container.css'
import './css/tools/dividers.css'

import Navbar from './components/universal/Navbar.jsx'
import InfoBlock from './components/universal/InfoBlock.jsx'
import IconStats from './components/specific/IconStats.jsx'

import teenarazziIcon from './assets/main-icon.png'

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
            <InfoBlock img={teenarazziIcon} header="Teenarazzi" paragraph={"Teenarazzi is a laid-back community for teenagers. Originally starting out on Reddit as a small group chat, it grew into what it is today! That being (yap away here some other time)\nWe always welcome new members and we hope you will check us out!"}/>
            <InfoBlock img={null} header="Come check us out!" component={IconStats} />
        </div>
      </div>

      <hr className="main-divider" />
    </>
  )
}

export default App
