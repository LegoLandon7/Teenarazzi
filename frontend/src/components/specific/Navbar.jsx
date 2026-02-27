import { useState, useEffect, useRef } from "react"
import { NavLink } from "react-router-dom"
import './Navbar.css'

function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);
    const navRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const close = () => setMenuOpen(false);

    return (
        <nav className="navbar" ref={navRef}> 
            <NavLink to="/" className="site-title" onClick={close}>Teenarazzi.com</NavLink>

            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
                <span /><span /><span />
            </button>

            <div className={`nav-links ${menuOpen ? "open" : ""}`}>
                <NavLink to="/" onClick={close}>Home</NavLink>
                <NavLink to="/about" onClick={close}>About</NavLink>
                <NavLink to="/users" onClick={close}>Users</NavLink>
            </div>
        </nav>
    )
}

export default Navbar