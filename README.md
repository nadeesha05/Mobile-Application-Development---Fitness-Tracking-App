# fitness-tracking-app

Fitness activity tracking app: GPS tracking, history, goals, challenges, social.

## Tech Stack
- React Native
- Expo
- TypeScript
- Firebase

## Setup Steps
1. `git clone https://github.com/nadeesha05/Mobile-Application-Development---Fitness-Tracking-App.git`
2. `npm install`
3. Copy `.env.example` to `.env`
4. `npx expo start`

## Folder Structure
- `docs/`: Project documentation
- `scripts/`: Helper scripts
- `src/`: Main source code
  - `components/`: Reusable UI components
  - `context/`: React context providers
  - `hooks/`: Custom React hooks
  - `navigation/`: React Navigation setup
  - `screens/`: Application screens (auth, profile, tracking, activities, progress, challenges, social, settings)
  - `services/`: API and third-party service integrations (Firebase, etc.)
  - `types/`: TypeScript type definitions
  - `utils/`: Helper functions and constants

## Branch Rules
- **main** = stable only
- feature branches are `member1-database`, `member2-gps`, `member3-auth-profile`
- always pull main before starting
- make small commits
- open a pull request to merge
