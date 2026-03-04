import { NavLink, useParams } from "react-router-dom"
import { useState, useEffect } from "react"
import { fetchUsersMap } from "../../lib/usersApi.js"

import homeIcon from "../../assets/home.svg"
import refreshIcon from "../../assets/refresh.svg"

import './UserBar.css'

function UserBar() {
    const [users, setUsers] = useState({})
    const [search, setSearch] = useState("")
    const [sort, setSort] = useState("az")
    const [isRefreshing, setIsRefreshing] = useState(false)
    const { userId } = useParams()

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
        <>
            {/* Horizontal toolbar beside the userbar, below the navbar */}
            <div className="userbar-toolbar">
                <NavLink
                    to="/users"
                    end
                    className={({ isActive }) =>
                        `icon-btn home-btn${isActive && !userId ? " active" : ""}`
                    }
                    title="Home"
                >
                    <img src={homeIcon} alt="Home" />
                </NavLink>

                <button
                    type="button"
                    className={`icon-btn refresh-btn ${isRefreshing ? "spinning" : ""}`}
                    onClick={() => loadUsers(true)}
                    disabled={isRefreshing}
                    title="Refresh users"
                >
                    <img src={refreshIcon} alt="Refresh" />
                </button>

                <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="user-search"
                />

                <button
                    type="button"
                    className="sort-toggle"
                    onClick={() => setSort(s => s === "az" ? "za" : "az")}
                    title="Toggle sort order"
                >
                    {sort === "az" ? "A → Z" : "Z → A"}
                </button>
            </div>

            {/* Vertical user list */}
            <nav className="userbar">
                <div className="user-links">
                    {filteredUsers.map((id, index) => (
                        <NavLink
                            key={id}
                            to={id}
                            className={({ isActive }) =>
                                [isActive ? "active" : "", index % 2 === 1 ? "alt-row" : ""].join(" ").trim()
                            }
                        >
                            {id}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </>
    )
}

export default UserBar