import { useParams, NavLink } from "react-router-dom"
import { useState, useEffect } from "react"

import './UserBar.css'

function UserBar() {
    const { userId } = useParams()
    const [users, setUsers] = useState({})
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState("az")

    useEffect(() => {
        fetch("/users.json")
            .then(res => res.json())
            .then(data => setUsers(data))
    }, [])

    const filteredUsers = Object.keys(users)
        .filter(id => id.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sort === "az") return a.localeCompare(b)
            if (sort === "za") return b.localeCompare(a)
            return 0
    })

     return (
        <nav className="userbar">                
        <NavLink to="/users">Home</NavLink>
            <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="user-search"
            />

            <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="user-sort"
            >
                <option value="none">None</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
            </select>

            <div className="user-links">
                {filteredUsers.map(id => (
                    <NavLink key={id} to={id}>
                        {id}
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}

export default UserBar