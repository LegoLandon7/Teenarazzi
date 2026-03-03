# Teenarazzi GitHub Repo

This is the official website and API for the Teenarazzi community: a teen-run social hub that started on Reddit and expanded across Discord and other platforms.

This project powers the full public site experience, including:

- Home, About, Socials, and Contact pages that explain the community and link to its platforms.
- A Users section with searchable profile pages for notable community members.
- Live community stats cards (Discord member/activity counts and Reddit member/weekly visitor counts).
- A profile application flow where users submit info for a potential user page.
- An admin moderation panel where submissions are reviewed, edited, approved/rejected, and promoted into published user profiles.

The repository is split into two main parts:

- `frontend/`: The public website, profile viewer, user search sidebar, application form, and admin UI.
- `backend/`: A Cloudflare Worker API that handles submissions, moderation actions, user data, avatar enrichment, rate limiting, spam protection, and stats aggregation.

At a high level, the lifecycle is:

1. A user submits an application.
2. Admins review and edit that submission in the Applications panel.
3. Approved submissions are converted into profile records.
4. The Users pages read those records and display them publicly.
