import { NavLink } from "react-router-dom"
import './UserBar.css'

function UserBar() {
    return (
        <nav className="userbar"> 

            <div className="user-links">
                <NavLink to="legomaster_01">legomaster_01</NavLink>
            </div>
        </nav>
    )
}

export default UserBar