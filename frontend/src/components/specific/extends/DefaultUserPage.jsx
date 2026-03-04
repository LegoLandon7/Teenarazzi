import InfoBlock from '../../universal/InfoBlock.jsx'
import { Link } from "react-router-dom"

import '../../universal/UserPage.css'
import './DefaultUserPage.css'

function DefaultUserPage() {
    return (
        <>
            <div className="user-page">
                <InfoBlock header="What is this page?" paragraph="This page is dedicated to some of the most influential people of our community! Feel free to search and scroll through the left search bar to view our special users!" />
                <InfoBlock
                    header="How can I get a page?"
                    paragraph={
                        <>
                            {"Getting a page on this website is simple. Be part of Teenarazzi and "}
                            <Link to="/apply">fill out the application form</Link>
                            {" with as much detail as you want. If you want to be added sooner, check the contact page to reach someone on the team.\n\nWe do not currently have a way to allow users to edit their profiles, so until we do, please check out our contact page to find a way to contact an admin of our website to change your profile."}
                        </>
                    }
                />
            </div>
        </>
    );
}

export default DefaultUserPage
