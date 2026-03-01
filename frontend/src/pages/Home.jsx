import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'
import IconStats from '../components/specific/IconStats.jsx'
import PageButton from '../components/universal/PageButton.jsx'

import teenarazziIcon from '../assets/main-icon.png'

function Home() {
    let pageButtons = <>
        <div className="flex-container-row">
            <PageButton header="About Teenarazzi" to="/about" />
            <PageButton header="Our Users" to="/users" />
            <PageButton header="Contact Us" to="/contact" />
            <PageButton header="Socials" to="/socials" />
        </div>
    </>

    return (
        <>
            <div className="main-content">
                <InfoBlock img={teenarazziIcon} header="Teenarazzi" paragraph={"Teenarazzi is a laid-back community for teenagers. We originally started out on Reddit as a small group chat, which grew into what it is today! We always welcome new members and we hope you will check us out!"} component={() => <PageButton header="Click here to learn more!" to="/about" />} />
                <InfoBlock header="Come check us out!" component={IconStats} />
            </div>

            <hr className="main-divider" />

            <div className="main-content flex-container-column">
                <InfoBlock header="Teenarazzi's Content" component={() => (pageButtons)} />
            </div>
        </>
    )
}

export default Home
