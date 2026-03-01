import { useParams } from "react-router-dom"
import { useState, useEffect, useReducer } from "react"

import InfoBlock from './InfoBlock.jsx'

import './UserPage.css'
import '../../css/tools/flex-container.css'

function UserPage() {
    const { userId } = useParams()
    const [user, setUser] = useState(null)

    // fetch users data
    useEffect(() => {
        fetch("/users.json")
            .then(res => res.json())
            .then(data => setUser(data[userId]))
    }, [userId])

    if (!user) return <InfoBlock header={"User"} paragraph={"Loading ↻"} />
    return (
        <>
            <div className="user-page">
                <InfoBlock img={user.avatarUrl} header={user.id} paragraph={user.description} />

                <div className="flex-container-column-top">
                    <div className="flex-container-row">
                        {user.usernames.discord.at(0) !== null && (<InfoBlock header="Discord" paragraph=
                            {<>{`Username: ${user.usernames.discord.at(0)}${user.usernames.discord.length > 1
                                ? `\nOld Usernames: ${user.usernames.discord.slice(1).join(", ")}` : ""}`}
                                {user.links.discord !== null && <>{"\nLink: "}<a href={user.links.discord} target="_blank" rel="noreferrer">link</a></>}</>} />)}
                        {user.usernames.reddit.at(0) !== null && (<InfoBlock header="Reddit" paragraph=
                            {<>{`Username: ${user.usernames.reddit.at(0)}${user.usernames.reddit.length > 1
                                ? `\nOld Usernames: ${user.usernames.reddit.slice(1).join(", ")}` : ""}`}
                                {user.links.reddit !== null && <>{"\nLink: "}<a href={user.links.reddit} target="_blank" rel="noreferrer">link</a></>}</>} />)}
                    </div> <div className="flex-container-row">
                        <InfoBlock header="Information" paragraph=
                            {<>{user.pronouns !== null && (`Pronouns: ${user.pronouns}\n`)}
                            {user.sexuality !== null && (`Sexuality: ${user.sexuality}\n`)}
                            {user.age.value !== null && (<>{`Age: ${user.age.value}`}<small> (Last Updated: {new Date(user.age.timestamp * 1000).toLocaleDateString()})</small>{"\n"}</>)}
                            {user.birthday !== null && (`Birthday: ${user.birthday}`)}</>}/>
                        <InfoBlock header="Extra" paragraph=
                            {<>{user.notes !== null && (`Notes: ${user.notes}\n`)}
                            {user.timestamp !== null && (`Page Last Updated: ${new Date(user.timestamp * 1000).toLocaleDateString()}`)}</>}/>
                    </div>
                </div>
            </div>
        </>
    );
}

export default UserPage