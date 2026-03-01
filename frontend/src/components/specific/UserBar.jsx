import { NavLink } from "react-router-dom"
import './UserBar.css'

function UserBar() {
    return (
        <nav className="userbar"> 

            <div className="user-links">
                <NavLink to="legomaster_01">legomaster_01</NavLink>
                <NavLink to="mracticalpacaron">mracticalpacaron</NavLink>
                <NavLink to="notagod_420">notagod_420</NavLink>
                <NavLink to="ejoit">ejoit</NavLink>
                <NavLink to="thesillyman">thesillyman</NavLink>
                <NavLink to="notagod_420">notagod_420</NavLink>
                <NavLink to="mars_rover_47704">mars_rover_47704</NavLink>
                <NavLink to="therealyuyuu">therealyuyuu</NavLink>
                <NavLink to="wyld_thais.">wyld_thais.</NavLink>
                <NavLink to="vivi.the.smiling">vivi.the.smiling</NavLink>
            </div>
        </nav>
    )
}

export default UserBar