import './PageButton.css'

import { Link } from 'react-router-dom'

function isExternalTarget(to) {
    return typeof to === "string" && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(to)
}

function PageButton({header = "", to = "/", ...rest}) {
    if (isExternalTarget(to)) {
        return (
            <a className="page-button" href={to} {...rest}>
                <h1>{header}</h1>
            </a>
        )
    }

    return (
        <Link className="page-button" to={to} {...rest}>
            <h1>{header}</h1>
        </Link>
    )
}

export default PageButton
