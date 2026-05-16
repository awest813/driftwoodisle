# Driftwood Isle

Driftwood Isle is a browser-based first-person island survival game built with Babylon.js, TypeScript, and Vite.

## Overview

Survive on a stranded island by gathering resources, crafting tools, fishing, managing your stats, and repairing the raft to escape.

## Features

- First-person movement and mouse look
- Resource gathering and tool-based harvesting
- Crafting and backpack management
- Fishing, hunger, thirst, stamina, warmth, and health systems
- Day/night cycle and weather effects
- Save/load support and in-game settings

## Getting started

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build and preview

```bash
npm run build
npm run preview
```

## Controls

- **WASD / Arrow keys**: Move
- **Mouse**: Look around
- **Shift**: Sprint
- **Click**: Interact / gather
- **Right-click water**: Fish
- **Tab / E**: Open backpack & crafting
- **Esc**: Pause

## Project structure

- `src/game` - Core game setup and orchestration
- `src/world` - Island, ocean, weather, and day/night systems
- `src/player` - Player movement and stats
- `src/interaction` - Resource interaction and fishing
- `src/crafting` - Recipes and crafting flow
- `src/ui` - Main menu and HUD
- `src/save` - Save/load and settings

