import { NavLink } from "react-router-dom"
import './UserBar.css'

function UserBar() {
    return (
        <nav className="userbar"> 

            <div className="user-links">
                <NavLink to="user1">User1</NavLink>
                <NavLink to="user2">User2</NavLink>
                <NavLink to="user3">User3</NavLink>
            </div>
        </nav>
    )
}

export default UserBar