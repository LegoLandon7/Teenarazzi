import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'

import teenarazziIcon from '../assets/main-icon.png'

function About() {
    let description = `Teenarazzi is a vast, diverse community with the main focus of being an online, social hub for teens! Our community is run by teens, for teens. What started out as a small Reddit group chat turned into a rapidly growing, yet tight knit community across multiple platforms. Everyone knows everyone in this small but growing community, so it's hard to feel left out. We are a small silly bunch who would warmly welcome any new members! We are known to be very unserious and fun, so we hope you consider visiting us sometime!`;

    return (
        <>
            <div className="main-content">
                <div className='flex-container-column'>
                    <InfoBlock img={teenarazziIcon} header="About us - Teenarazzi" paragraph={description}/>
                </div>
            </div>

            <hr className="main-divider" />
        </>
    );
}

export default About