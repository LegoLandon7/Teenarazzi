import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'

import teenarazziIcon from '../assets/main-icon.png'

function About() {
    let description = `Teenarazzi is a vast, diverse community with the main focus of being an online, social hub for teens! Our community is run by teens, for teens. What started out as a small Reddit group chat turned into a rapidly growing, yet tight knit community across multiple platforms. Everyone knows everyone in this small but growing community, so it's hard to feel left out. We are a small silly bunch who would warmly welcome any new members! We are known to be very unserious and fun, so we hope you consider visiting us sometime!\n\nTeenarazzi was originally founded by Piglet (December 20th 2024), who wanted to create a fun paparazzi-style subreddit for users of r/teenagers. Early on, Old Giraffe helped promote the subreddit by reaching out to popular users, while can1_think_of_a_name actively spread the word within r/teenagers. Later, around March-April, RVL joined with new ideas and plans to develop the subreddit further. Over time, Teenarazzi grew more independent, becoming its own unique community and gradually becoming more estranged from r/teenagers. While it has recently started to resemble other typical teen subreddits, its roots remain deeply tied to documenting user culture and creating lore within the r/teenagers community.  (Teenarazzi Wiki, 2023)`;
    let redditDescription = `Teenarazzi originally started out on Reddit! Teenarazzi used to be a small niche community of no more than 100 members at one point. However, new members kept on joining and it eventually became what it is today!\n\nThe Teenarazzi subreddit can be found at r/teenarazzi`;
    let discordDescription = `Teenarazzi eventually grew into its very own discord server not long after its creation. The discord server is a smaller group of people and is suprisingly very seperate from the main subreddit. Also, the discord server has the benefit of it being easier to talk to others! This is because discord doesn't use a posting system like reddit. This allows users and members to connect even more than reddit could ever have.`;

    return (
        <>
            <div className="main-content">
                <InfoBlock img={teenarazziIcon} header="About us - Teenarazzi" paragraph={description}/> 
            </div>

            <hr className="main-divider" />

            <div className="main-content">
                <InfoBlock header="Reddit" paragraph={redditDescription} />
                <InfoBlock header="Discord" paragraph={discordDescription} />
            </div>
        </>
    );
}

export default About