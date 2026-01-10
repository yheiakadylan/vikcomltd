# Pink POD System

A comprehensive Order Management System for Print-on-Demand (POD) workflows, designed with a modern, feminine, and professional aesthetic ("Pink POD").

## Features

- **Role-Based Access Control (RBAC)**:
  - **CS (Customer Support)**: Create tasks, manage orders, approve/reject designs.
  - **DS (Designer)**: Claim tasks, upload designs, view priorities.
  - **Admin**: Full system access.
- **Task Management**:
  - Kanban-style status tracking (New, Doing, In Review, Need Fix, Done).
  - Urgent priority handling with visual cues.
  - Real-time updates via Firebase Firestore.
- **Dropbox Integration**:
  - Seamless authentication.
  - Direct file uploads for Sample files (CS) and Designs (DS).
  - Organized folder structure (`/PINK/{YEAR}/{ORDER_ID}`).

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **UI Framework**: Ant Design (Customized Theme)
- **Backend & Auth**: Firebase (Auth, Firestore)
- **Storage**: Dropbox API v2

## Setup

1.  Clone the repository.
2.  Install dependencies: `npm install`.
3.  Configure environment variables in `.env`:
    ```
    VITE_DROPBOX_APP_KEY=your_app_key
    // Add Firebase config in src/services/firebase.ts or .env if refactored
    ```
4.  Run locally: `npm run dev`.

## Project Structure

- `/src/components/modals`: Core interaction modals (New Task, Task Detail).
- `/src/pages`: Main views (Login, Dashboard, Admin).
- `/src/services`: API integrations (Firebase, Dropbox).
- `/src/contexts`: Global state (Auth).
- `/src/theme`: Design system configuration.

## License

Private / Proprietary.
