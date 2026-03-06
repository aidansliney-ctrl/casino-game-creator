# Casino Game Creator

HTML5 Canvas casino game creator with a Spring Boot backend and React (Vite) frontend. Includes an AI assistant powered by Gemini or Claude for game design guidance.

## Prerequisites

- **Java 17+** (tested with OpenJDK 25)
- **Maven 3.9+**
- Node.js 20+ and npm 10+ (auto-installed by Maven's frontend-maven-plugin, but useful for local frontend dev)

## Quick Start

```bash
# 1. Build the entire project (backend + frontend)
mvn clean package -DskipTests

# 2. Run the Spring Boot server
java -jar target/creator-0.0.1-SNAPSHOT.jar
```

The app is now available at **http://localhost:8080**.

## Frontend Dev Mode (Hot Reload)

For frontend development with hot reload:

```bash
# In one terminal — start the backend
mvn spring-boot:run

# In another terminal — start Vite dev server (proxies /api to :8080)
cd src/frontend
npm install
npm run dev
```

Vite dev server runs on **http://localhost:5173** and proxies API calls to the backend.

## Configuration

### AI Provider Keys

Set API keys via the in-app **Settings** modal, or configure the Gemini key as an environment variable:

```bash
export GEMINI_API_KEY=your-key-here
```

Anthropic (Claude) keys are set per-session in the Settings UI.

### Application Properties

Edit `src/main/resources/application.properties`:

| Property | Default | Description |
|---|---|---|
| `server.port` | 8080 | HTTP server port |
| `gemini.api.key` | (env var) | Gemini API key |

## Project Structure

```
casino-game-creator/
  pom.xml                          # Maven build (backend + frontend)
  src/
    main/
      java/com/casino/creator/
        Application.java           # Spring Boot entry point
        controller/
          HealthController.java    # GET /api/health
          ChatController.java      # POST /api/chat
        service/
          AIService.java           # Gemini & Claude integration
      resources/
        application.properties
    frontend/                      # React + Vite app
      package.json
      vite.config.js
      index.html
      src/
        App.jsx                    # Main app layout
        main.jsx                   # React entry point
        index.css
        engine/                    # Canvas game engine
          Game.js, GameLoop.js, Renderer.js, InputManager.js
          SlotGameScene.js, ThreeReelSlotScene.js, RouletteScene.js
          AudioManager.js
        components/                # React UI panels
          ChatPanel.jsx, GameConfig.jsx, AssetsPanel.jsx
          AudioPanel.jsx, SettingsModal.jsx
          SavedGamesPanel.jsx, SaveGameModal.jsx
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend health check |
| POST | `/api/chat` | AI chat (body: `{message, history}`, headers: `X-API-Key`, `X-AI-Provider`) |

## Game Types

- **3-Reel Slots** — Egyptian Treasures theme with jackpots, free spins, wilds
- **5-Reel Slots** — Configurable slot machine
- **Roulette** — Table game

## Building for Production

```bash
mvn clean package -DskipTests
# Output: target/creator-0.0.1-SNAPSHOT.jar (self-contained executable JAR)
```

Deploy the JAR anywhere Java 17+ is available:

```bash
GEMINI_API_KEY=your-key java -jar creator-0.0.1-SNAPSHOT.jar
```
