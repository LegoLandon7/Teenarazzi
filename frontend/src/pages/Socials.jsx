import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'

import teenarazziIcon from '../assets/main-icon.png'

import PageButton from '../components/universal/PageButton.jsx'

function Socials() {
    let description = `Apart from just Discord and Reddit, Teenarazzi is also in some other places as well! You can check out everywhere teenarazzi is down below!`;

    return (
        <>
            <div className="main-content">
                <InfoBlock img={teenarazziIcon} header="Socials - Teenarazzi" paragraph={description} />
            </div>

            <hr className="main-divider" />

            <div className="main-content">
                <InfoBlock header="Reddit" paragraph={"Reddit was where Teenarazzi began! And also Teenarazzi's most popular platform. The subreddit has thousands of members with strict rules, therefore making it one of the most safe teen subreddits out there!"} component={() => (<PageButton header="Reddit" to="https://reddit.com/r/teenarazzi" target="_blank" rel="noopener noreferrer" />)} />
                <InfoBlock header="Discord" paragraph={"The Discord server is easiest to talk to and find new friends! Its one of the best teen servers for people to find friends and hang out with others. The discord keeps gaining new members and is constantly thriving." } component={() => (<PageButton header="Discord" to="https://discord.gg/razzi" target="_blank" rel="noopener noreferrer" />)} />
                <InfoBlock header="Instagram" paragraph={"The Instagram page for Teenarazzi isn't as devoloped as the other two but it is still growing!"} component={() => (<PageButton header="Instagram" to="https://www.instagram.com/teenarazzi/" target="_blank" rel="noopener noreferrer" />)} />
                <InfoBlock header="Wiki" paragraph={"The wiki is what inspired the creator of teenarazzi.com to create the website! A lot of information about Teenarazzi has been posted on the Wiki."} component={() => (<PageButton header="Wiki" to="https://teenarazzi.fandom.com/wiki/Teenarazzi_Wiki" target="_blank" rel="noopener noreferrer" />)} />
            </div>
        </>
    );
}

export default Socials