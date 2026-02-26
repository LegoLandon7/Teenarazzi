import { useParams } from "react-router-dom"
import { useState, useEffect } from "react"

import './UserPage.css'

function UserPage() {
    const { userId } = useParams()
    const [user, setUser] = useState(null)

    // fetch users data
    useEffect(() => {
        fetch("https://your-worker.workers.dev/api/discord")
            .then(res => res.json())
            .then(data => setUser(data))
    }, [userId])

    if(!user) return <h1 className='loading'>Loading ↻</h1>

    //user.username
    //user.nickname
    //user.avatarURL
    //user.pronouns
    //user.gender
    //user.sexuality
    //user.description
    //user.ect...

    return (
        <>
            
        </>
    );
}

export default UserPage