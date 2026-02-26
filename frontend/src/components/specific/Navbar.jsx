import { NavLink } from "react-router-dom"
import './Navbar.css'

function Navbar() {
    return (
        <nav className="navbar"> 
            <NavLink to="/" className="site-title">Teenarazzi.com</NavLink>

            <div className="nav-links">
                <NavLink to="/">Home</NavLink>
                <NavLink to="/about">About</NavLink>
                <NavLink to="/users">Users</NavLink>
            </div>
        </nav>
    )
}

export default Navbar