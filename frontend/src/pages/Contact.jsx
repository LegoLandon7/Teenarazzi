import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'

import teenarazziIcon from '../assets/main-icon.png'

import PageButton from '../components/universal/PageButton.jsx'

function Contact() {
    let pageButtons = <>
        <div className="flex-container-row">
            <PageButton header="Email" to="mailto:contact@teenarazzi.com" target="_blank" rel="noopener noreferrer" />
            <PageButton header="Discord" to="https://discord.gg/razzi" target="_blank" rel="noopener noreferrer" />
            <PageButton header="Reddit" to="https://reddit.com/r/teenarazzi" target="_blank" rel="noopener noreferrer" />
        </div>
    </>

    let contactInfo = `Email: contact@teenarazzi.com\n\n`;

    return (
        <>
            <div className="main-content flex-container-wrap">
                <InfoBlock img={teenarazziIcon} header="Contact Info - Teenarazzi" paragraph={contactInfo} component={() => (pageButtons)} />
            </div>
        </>
    );
}

export default Contact