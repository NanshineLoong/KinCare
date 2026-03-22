<div align="center">

<img src="assets/KinCare.svg" alt="KinCare logo" width="60%" valign="middle">

<p><strong>Self-hosted family health space powered by AI</strong></p>

<img src="assets/screenshot.png" alt="KinCare screenshot" width="60%">

<p><a href="./README.zh-CN.md">中文</a> | English</p>

</div>

<p align="center"><strong>Connection · Insight · Care</strong></p>

- **Connection** — Bring your family and their health into one shared space.
- **Insight** — Let AI uncover what you might miss.
- **Care** — Turn understanding into timely, meaningful action.

## What Is KinCare?

KinCare is a private family health space you run on your own machine or server.  
It brings your household, health records, and AI assistance into one place — so your family stays aligned without giving up control of sensitive data.

## Key Capabilities

- Family health dashboard for the whole household
- Unified health profiles for each family member across multiple record types
- AI agent with chat, voice input, and health-record draft actions
- AI-powered daily insights and reminders
- Family space with member-level permissions
- Self-hosted, privacy-first deployment

## Quick Start

```bash
cp .env.example .env
# For any real deployment, change KINCARE_JWT_SECRET before exposing the app.

docker compose up -d --build
```

Then open:

- Web app: `http://localhost:8080`

After the app starts:

1. Register the first user with a username, optional email, and password.
2. Open the avatar menu, then go to `Settings -> Admin Config`.
3. Configure AI providers, transcription, and daily refresh times if you want AI features.

If you only want to explore the UI and manual health records first, no AI or STT environment variables are required.

> [!NOTE]
> One deployment equals one family space.
> The first registered user becomes the family admin automatically.
> Later registered users join the same family space automatically.
> Admins can add member profiles without creating user accounts, and member access follows `read / write / manage` levels with scoped grants.
>
> Registration is open by default. If the instance is reachable by untrusted users, later sign-ups will join the same family space.

## Local Development

Copy the local environment file first:

```bash
cp .env.example .env
```

Start the backend:

```bash
cd backend
uv venv .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Roadmap

- Integrate the OpenWearables repository to bring wearable-device data into KinCare
- Expose a local MCP service so external AI agents such as Claude Code can access family health context safely
- Support OpenClaw through skills-based integrations

## Acknowledgements

- [PydanticAI](https://ai.pydantic.dev/) for the agent framework
- [Docling](https://github.com/docling-project/docling) for document processing
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) for speech transcription

## License
Licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html). See [`LICENSE.txt`](./LICENSE.txt) for the full text.
