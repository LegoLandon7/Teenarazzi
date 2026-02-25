import '../css/components/InfoBlock.css'
import '../css/index.css'
import mainIcon from '../assets/output_6396.jpg'

function InfoBlock() {
    return (
        <div className="info-block"> 
            <img src={mainIcon} />
            
            <div className="info-body">
                <h1>
                    Lorem ipsum
                </h1>
                <p>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
            </div>
        </div>
    )
}

export default InfoBlock