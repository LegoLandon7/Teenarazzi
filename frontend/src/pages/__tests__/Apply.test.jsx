import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Apply from "../Apply.jsx"

function fillValidApplyFlow(user) {
  return (async () => {
    await user.type(screen.getByLabelText(/display name/i), "example_user")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await user.click(screen.getByLabelText(/discord/i))
    await user.type(screen.getByLabelText(/^discord username/i), "example_discord")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await user.type(screen.getByLabelText(/short description/i), "A short profile description")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await user.click(screen.getByRole("button", { name: /continue/i }))

    await user.click(screen.getByLabelText(/^yes$/i))
  })()
}

describe("Apply", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("submits successfully and shows confirmation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "sub_123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" }
      })
    )

    const user = userEvent.setup()
    render(<Apply />)

    await fillValidApplyFlow(user)
    await user.click(screen.getByRole("button", { name: /^submit$/i }))

    await screen.findByRole("heading", { name: /application submitted/i })
    expect(screen.getByText(/submission id: sub_123/i)).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/v1/submissions")
    expect(init?.method).toBe("POST")
  })

  it("shows network error state when submission fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))

    const user = userEvent.setup()
    render(<Apply />)

    await fillValidApplyFlow(user)
    await user.click(screen.getByRole("button", { name: /^submit$/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/could not reach the submissions service/i)
      ).toBeInTheDocument()
    })
  })
})
