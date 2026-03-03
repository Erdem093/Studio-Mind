# 🚀 Content Pipeline Machine for Creators

> 🧪 Built for the Anyway & Animoca Minds Hackathon

## 🧠 Overview
Content Pipeline Machine is an AI-powered content autopilot for challenge-based creators. It transforms raw ideas into fully structured, high-performing videos by automating planning, scripting, hook generation, and performance analysis. Instead of spending hours on pre- and post-production, creators can focus on filming while the system handles everything else. The platform is built around an iterative workflow where each "run" generates multiple content artifacts (scripts, hooks, titles), allowing creators to refine and optimise their output over time.

---

## 🏗️ Architecture (High-Level)

> 📌 Diagram coming soon — see `/docs/system-diagram.png`

Frontend (Lovable / Next.js)
↓
Backend API (Node / Python)
↓
Agent Layer (OpenAI + Flock)
↓
Observability (Anyway SDK)
↓
Database (Postgres)
↓
Persistent Agents (Animoca Minds)

---

## ⚙️ Setup (Coming Soon)

> Full setup instructions will be added here.

Planned steps:
- Clone repository
- Install dependencies
- Configure environment variables (OpenAI, Flock, Anyway, Stripe)
- Run development server

---

## 📂 Project Structure
/docs → Pitch materials, diagrams, and documentation
/src → Application source code
README.md → Project overview


---

## 🧩 Core Concepts

- **Video** → A content project (e.g. "Learn guitar in 24 hours")
- **Run** → One execution of the AI pipeline
- **Artifacts** → Outputs (scripts, hooks, titles, etc.)
- **Approval Flow** → User selects and refines outputs

---

## 💡 Vision

Build a system where:
> One day of filming → fully automated multi-platform content pipeline

---

## 📌 Status

🚧 MVP in development (Hackathon Build)

---

## 📄 Docs

All supporting materials (pitch, diagrams, architecture notes) are in `/docs`.
