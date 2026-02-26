import './PageButton.css'

import { Link } from 'react-router-dom'

function PageButton({header = "", to = "/"}) {
    return (
        <>
            <Link className="page-button" to={to}>
                <h1>{header}</h1>
            </Link>
        </>
    );
}

export default PageButton