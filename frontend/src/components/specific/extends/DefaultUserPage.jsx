import InfoBlock from '../../universal/InfoBlock.jsx'

import '../../universal/UserPage.css'
import '../../../css/tools/flex-container.css'

function DefaultUserPage() {
    return (
        <>
            <div className="user-page">
                <InfoBlock header="What is this page?" paragraph="This page is dedicated to some of the most influential people of our community! Feel free to search and scroll through the left search bar to view our special users!" />
                <InfoBlock header="How can I get a page?" paragraph={<>{"Getting a page on this website is actually super simple! All you need is to be a part of Teenarazzi and "}<a href="https://forms.gle/J5sA4CmcQZPYucs36" target="_blank" rel="noopener noreferrer">fill out this form</a>{" to the best of your ability! If you want added sooner then please check out our contact page to get hold of someone :)"}</>} />
            </div>
        </>
    );
}

export default DefaultUserPage