# Testing

Run all automated checks:

- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `npm --prefix backend run test`
- `npm --prefix frontend run test`

Current baseline scope:

- Backend  route tests (`/v1/submissions`, `/v1/admin/login`, `/v1/users`, `/stats`)
- Frontend  tests (apply submit success/error states, users search behavior)
