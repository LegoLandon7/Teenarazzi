import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'

import teenarazziIcon from '../assets/main-icon.png'

function About() {
    let description = `Teenarazzi is a vast community with thousands of ssmembers thats main focus is for socializing with teens!` +
    ` Teenarazzi is ran by teens and focused for teens specifically. What started out as a small reddit group chat turned it into what it is today!` +
    ` Everyone knows everyone in this small but vast community so it's hard to feel left out.`+
    ` We are a small silly community who would love to have any new members! we are very unserious and fun and hope you consider checking us out!`;

    return (
        <>
            <InfoBlock img={teenarazziIcon} header="About us - Teenarazzi" paragraph={description}/>
            <hr className="main-divider" />
        </>
    );
}

export default About