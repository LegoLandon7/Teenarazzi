import { NavLink } from "react-router-dom"
import './Navbar.css'
import '../../css/index.css'

function Navbar() {
    return (
        <nav className="navbar"> 
            <NavLink to="/" className="site-title">Teenarazzi.com</NavLink>

            <div className="nav-links">
                <NavLink to="/">Home</NavLink>
                <NavLink to="/about">About</NavLink>
            </div>
        </nav>
    )
}

export default Navbar