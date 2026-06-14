# AURA Guide

AURA Guide is a comprehensive AI-driven application featuring a Go backend, a Python/FastAPI AI agent powered by LLaMA, and an Expo React Native frontend. 

This repository contains three main components:
1. **`aura-backend`**: A robust Go-based REST API for user management, tasks, and core application logic.
2. **`aura-ai-agent`**: A Python FastAPI service that interfaces with a local Ollama LLM to power the AI features.
3. **`aura-ui`**: An Expo React Native frontend that can be run on the web or as a standalone mobile application (Android/iOS).

---

## 🛠️ Complete Setup & Execution Guide

Follow these steps to run the entire stack locally.

### 1. Start the Go Backend (`aura-backend`)
Ensure PostgreSQL is running and the `aura` database is created using the provided `schema.sql`.

```bash
cd aura-backend

# Set required environment variables (update with your DB credentials)
export DATABASE_URL="postgres://username:password@localhost:5432/aura"
export JWT_SECRET="your_secure_secret_key"

# Download dependencies and run
go mod tidy
go run main.go
```
*The backend will be available at `http://localhost:8080` (or your LAN IP `192.168.x.x:8080`).*

### 2. Start the AI Agent (`aura-ai-agent`)
Ensure [Ollama](https://ollama.com/) is installed and the model is pulled (`ollama pull llama3.2:1b`).

```bash
cd aura-ai-agent

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*The agent will be available at `http://localhost:8000` (or your LAN IP `192.168.x.x:8000`).*

---

## 📱 Running the Frontend (`aura-ui`)

Before starting the frontend, ensure that `aura-ui/src/config.ts` is correctly pointing to your backend services. 
*   If testing on **Web** or an **Android Emulator**, using `localhost` is fine.
*   If testing on a **Physical Mobile Device**, update `config.ts` to use your computer's local network IP address (e.g., `192.168.8.105`) so the phone can reach your laptop over WiFi.

Navigate to the UI folder and install dependencies:
```bash
cd aura-ui
npm install
```

### Option A: Run as a Web App
To run the application in your browser:
```bash
npm run web
```

### Option B: Run via Expo Go (Development Mobile App)
To run the app on your physical phone during development without building an APK:
```bash
npm start
```
*A QR code will appear in your terminal. Download the **Expo Go** app on your phone, scan the QR code with your camera (or inside the Expo app), and the application will load instantly.*

### Option C: Build a Standalone Mobile App (APK / IPA)
To create a fully installable `.apk` for Android or `.ipa` for iOS using Expo Application Services (EAS):

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```
2. **Log in to Expo:**
   ```bash
   eas login
   ```
3. **Build the APK (Android):**
   ```bash
   eas build -p android --profile preview
   ```
4. **Build the App (iOS Simulator):**
   ```bash
   eas build -p ios --profile preview
   ```

> **Note:** The `preview` profile is configured in `eas.json` to specifically output an `.apk` file rather than a Google Play Store App Bundle (`.aab`). Wait for the cloud build to finish, and use the provided link or QR code in the terminal to download and install the standalone app on your device.
