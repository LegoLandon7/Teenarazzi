import '../css/components/IconStats.css'
import '../css/index.css'

function IconStats() {
    return (
        <div className="icon-stat-container"> 
            <a className="icon-stat"
                style={{ "--stat-color": "rgba(88, 101, 242, 0.5)" }}
                href="https://discord.com/razzi" target="_blank" rel="noopener noreferrer"
            ></a>
            <a className="icon-stat"
                style={{ "--stat-color": "rgba(255, 86, 0, 0.5)" }}
                href="https://reddit.com/r/teenarazzi" target="_blank" rel="noopener noreferrer"
            ></a>
        </div>
    )
}

export default IconStats