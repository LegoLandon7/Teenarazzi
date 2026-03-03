import InfoBlock from '../../universal/InfoBlock.jsx'
import { Link } from "react-router-dom"

import '../../universal/UserPage.css'
import '../../../css/tools/flex-container.css'

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
                            <Link to="/apply">fill out the profile form</Link>
                            {" with as much detail as you want. If you want to be added sooner, check the contact page to reach someone on the team."}
                        </>
                    }
                />
            </div>
        </>
    );
}

export default DefaultUserPage
