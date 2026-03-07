import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import Users from "../Users.jsx"
import { fetchUsersMap } from "../../lib/usersApi.js"

vi.mock("../../lib/usersApi.js", () => ({
  fetchUsersMap: vi.fn()
}))

describe("Users page", () => {
  beforeEach(() => {
    vi.mocked(fetchUsersMap).mockResolvedValue({
      zulu: { id: "zulu" },
      alpha: { id: "alpha" },
      bravo: { id: "bravo" }
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("renders and filters users from search", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="/users" element={<Users />}>
            <Route index element={<div>Users Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => expect(fetchUsersMap).toHaveBeenCalled())

    const links = await screen.findAllByRole("link")
    const labels = links.map(link => link.textContent).filter(Boolean)
    expect(labels).toEqual(expect.arrayContaining(["alpha", "bravo", "zulu"]))

    await user.type(screen.getByPlaceholderText(/search users/i), "BR")

    expect(screen.getByRole("link", { name: "bravo" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "alpha" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "zulu" })).not.toBeInTheDocument()
  })
})
