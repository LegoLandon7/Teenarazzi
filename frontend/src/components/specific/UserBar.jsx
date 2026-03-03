import { NavLink } from "react-router-dom"
import { useState, useEffect } from "react"
import { fetchUsersMap } from "../../lib/usersApi.js"

import './UserBar.css'

function UserBar() {
    const [users, setUsers] = useState({})
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState("az")
    const [isRefreshing, setIsRefreshing] = useState(false)

    const loadUsers = async (forceRefresh = false) => {
        setIsRefreshing(true)
        try {
            const data = await fetchUsersMap({ forceRefresh })
            setUsers(data)
        } catch {
            setUsers({})
        } finally {
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        loadUsers(false)
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
            <button
                type="button"
                className="user-refresh"
                onClick={() => loadUsers(true)}
                disabled={isRefreshing}
            >
                {isRefreshing ? "Refreshing..." : "Refresh users"}
            </button>
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
