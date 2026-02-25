import './IconStats.css'
import '../../css/index.css'

function IconStats() {
    let discordTotal = '[ERROR]';
    let discordActive = '[ERROR]';

    let redditTotal = '[ERROR]';
    let redditActive = '[ERROR]';

    return (
        <div className="icon-stat-container"> 
            <a className="icon-stat"
                style={{ "--stat-color": "rgba(88, 101, 242, 0.5)" }}
                href="https://discord.gg/razzi" target="_blank" rel="noopener noreferrer"
            ><h1>
                Discord
            </h1><p>
                Total members: <span style={{color: typeof discordTotal === 'number' && !isNaN(discordTotal) ? "green" : "red"}}>{discordTotal}</span> <br />
                Active members: <span style={{color: typeof discordActive === 'number' && !isNaN(discordActive) ? "green" : "red"}}>{discordActive}</span> <br />
            </p></a>
            <a className="icon-stat"
                style={{ "--stat-color": "rgba(255, 86, 0, 0.5)" }}
                href="https://reddit.com/r/teenarazzi" target="_blank" rel="noopener noreferrer"
            ><h1>
                Reddit
            </h1><p>
                Total members: <span style={{color: typeof redditTotal === 'number' && !isNaN(redditTotal) ? "green" : "red"}}>{redditTotal}</span> <br />
                Active members: <span style={{color: typeof redditActive === 'number' && !isNaN(redditActive) ? "green" : "red"}}>{redditActive}</span> <br />
            </p></a>
        </div>
    )
}

export default IconStats