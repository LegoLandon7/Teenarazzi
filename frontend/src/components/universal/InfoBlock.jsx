import './InfoBlock.css'

function InfoBlock({img = null, header = "", paragraph = "", background = false, component: Component = null }) {
    return (
        <div className="info-block"> 
            {img && <img src={img} />}
            
            <div className="info-body">
                <h1> {header}</h1><hr /><p> {paragraph} </p>
                {Component && <Component />}
            </div>
        </div>
    )
}

export default InfoBlock