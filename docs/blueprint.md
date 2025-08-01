# **App Name**: DApp Drop Zone

## Core Features:

- Wallet Connection Header: Display a persistent header with 'Connect Wallet' button and address display upon connection.
- Campaigns Dashboard: Show a campaign dashboard listing active campaigns with title, description, status, and participant count.
- Campaign Creation Form: Provide a multi-step form for hosts to create new campaigns, including campaign details, tasks, and rewards. Rewards available only after end time.
- Campaign Details Page: Display campaign details, tasks with completion status, and reward information for participants.
- Smart Contract Interaction: Integrate with the Web3Campaigns smart contract for creating, managing, and participating in campaigns.
- Off-Chain Data Persistence: Use Firestore to store campaign metadata and track user progress, enabling real-time updates.
- Role-Based UI Adaptation: Dynamically adapt UI elements and actions based on the user's role (host or participant), controlling button visibility and functionality. Enforce timing such as end time before rewards are enabled. Implement loading icons during smart contract interactions.

## Style Guidelines:

- Primary color: Vibrant blue (#29ABE2) to represent trust and innovation in the blockchain space.
- Background color: Light gray (#F0F2F5) for a clean, modern look.
- Accent color: Energetic orange (#FF9800) to highlight interactive elements and CTAs.
- Body and headline font: 'Inter' (sans-serif) for a clean, modern, and readable experience.
- Use a set of consistent and modern icons to represent various actions and campaign types.
- Implement a clean and intuitive layout, ensuring ease of navigation between different sections of the application.
- Incorporate subtle animations and transitions to enhance user engagement and provide visual feedback on interactions.