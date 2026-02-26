import { Outlet } from "react-router-dom";
import UserBar from '../components/specific/UserBar.jsx'

function Users() {
  return (
    <>
      <UserBar />
      <Outlet />
    </>
  )
}

export default Users
