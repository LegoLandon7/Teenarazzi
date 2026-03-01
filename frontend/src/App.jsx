import { Routes, Route } from "react-router-dom"

import './css/App.css'
import './css/index.css'

import Navbar from './components/specific/Navbar.jsx'
import UserPage from './components/universal/UserPage.jsx'
import DefaultUserPage from './components/specific/extends/DefaultUserPage.jsx'

import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import Users from './pages/Users.jsx'
import Contact from './pages/Contact.jsx'
import Socials from './pages/Socials.jsx'

import ScrollToTop from "./components/tools/ScrollToTop.jsx"

function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />}/>
        <Route path="/about" element={<About />}/>
        <Route path="/users" element={<Users />}>
          <Route index element={<DefaultUserPage />} />
          <Route path=":userId" element={<UserPage />}/>
        </Route>
        <Route path="/contact" element={<Contact />}/>
        <Route path="/socials" element={<Socials />}/>
      </Routes>
    </>
  )
}

export default App
