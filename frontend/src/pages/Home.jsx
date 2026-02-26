import '../css/tools/flex-container.css'
import '../css/tools/dividers.css'

import InfoBlock from '../components/universal/InfoBlock.jsx'
import IconStats from '../components/specific/IconStats.jsx'
import PageButton from '../components/universal/PageButton.jsx'

import teenarazziIcon from '../assets/main-icon.png'

function Home() {
    PageButton.header = "meow";
    return (
        <>
            <div className="main-content">
                <div className='flex-container-column'>
                    <InfoBlock img={teenarazziIcon} header="Teenarazzi" paragraph={"Teenarazzi is a laid-back community for teenagers. Originally starting out on Reddit as a small group chat, it grew into what it is today! We always welcome new members and we hope you will check us out!"} component={() => <PageButton header="About Us" to="/about" />} />
                    <InfoBlock img={null} header="Come check us out!" component={IconStats} />
                </div>
            </div>

            <hr className="main-divider" />
        </>
    )
}

export default Home
