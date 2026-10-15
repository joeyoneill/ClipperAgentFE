# CLIP_AGENT_OS — React & TypeScript Studio Frontend (`capstone-fe`)

`capstone-fe` is the interactive web studio frontend and Nginx VPC reverse proxy for **CLIP_AGENT_OS** — an agentic **Long-Form-to-Short-Form Video Clipping & Multimodal RAG Studio**.

Built with **React 19**, **TypeScript 6**, **Vite 8**, and **Firebase Authentication**, and packaged as a two-stage **Docker + Nginx** container, it provides a retro-arcade production interface across four integrated creator workflows (`UPLOAD`, `VAULT`, `CHAT`, and `REEL`).

---

## 1. Key Capabilities & Studio Views

The application is wrapped in a persistent `UploadProvider` and `AuthContext` inside an arcade studio shell (`ArcadeShell` in `src/App.tsx`):

1. **`HOME` View (`src/views/Home/`)**:
   - Central command deck with Firebase Google OAuth sign-in/sign-out and mode navigation cards (`UPLOAD`, `VAULT`, `CHAT`, `REEL`).
2. **`UPLOAD` View & Background Transfer Ticker (`src/views/Upload/` & `src/context/UploadContext.tsx`)**:
   - Requests a **GCS v4 Signed `PUT` URL** from `/api/lf_videos/upload/init` and streams raw long-form video files (`.mp4`, `.mov`, `.webm`, `.mkv`) directly from the browser to Google Cloud Storage with live byte-level progress, pause/resume controls, and a persistent top-bar background transfer ticker across all studio views.
   - Calls `/api/lf_videos/upload/{vid}/complete` upon completion to trigger asynchronous multimodal indexing on the Video Processor Cloud Run Job.
3. **`VAULT` View (`src/views/Vault/`)**:
   - Displays the user's long-form tape library with live processing status indicators (`UPLOADING`, `PROCESSING`, `SUCCESSFUL`, `FAILED`), inline video playback via signed URLs, full transcript inspection, and cascading tape deletion.
4. **`CHAT` View — Bidirectional WebSocket Multi-Agent Studio (`src/views/Chat/` & `src/components/chat/`)**:
   - Connects to `WS /api/chat/stream` (performing a first-frame Firebase JWT `AUTH` handshake) and manages multi-turn conversation threads via `SessionSidebar`.
   - **Tape Selector (`SET_VIDEOS`)**: Lets users query across their entire library (`ALL_VAULT_TAPES`) or pin specific processed videos (`PINNED_TAPES`).
   - **Live Agent Trace & Reasoning Drawer**: Streams real-time `AGENT_THOUGHT` and `TRACE_STEP` events (showing `orchestrator_agent` $\rightarrow$ `clip_editor_agent` delegation and tool calls).
   - **Mid-Turn Execution Controls**: Supports live **`[ STOP ]` (`INTERRUPT`)** to halt generation while preserving partial output, and **`[ + STEER ]` (`ADD_CONTEXT`)** to inject mid-turn course corrections.
   - **Inline `ClipPreviewCard`**: Renders AI-proposed clips immediately using HTML5 media fragments (`#t=start,end`), synchronized live karaoke captions, and one-click **`[ ★ SAVE TO REEL ]`**.
5. **`REEL` View — Dual-Mode Subtitle Inspector & Multi-Format Export (`src/views/Reel/` & `src/components/reel/ReelClipCard.tsx`)**:
   - **Interactive Video & Karaoke Caption Preview**: Previews saved clips with live active-word yellow highlight captions.
   - **Dual-Mode Subtitle Editor (`PATCH /api/sf_videos/{sf_id}`)**:
     - **Simple Text Mode**: Edit the paragraph transcript or paste a full foreign-language translation; the backend automatically redistributes word timestamps proportionally across the clip window.
     - **Word Timing Table Mode**: Fine-tune individual `word`, `start_sec`, and `end_sec` rows with chronological overlap validation.
   - **On-Demand MP4 Export (`POST /api/sf_videos/{sf_id}/download`)**: Exports and downloads rendered MP4 files across configurable aspect ratios (`16:9` Original, `9:16` Vertical Crop, `9:16` Vertical Blur-Pad), resolutions (`1080p`, `720p`), and burned-in `.ass` karaoke subtitle options (`subs_on` / `subs_off`).

---

## 2. Directory Structure

```text
capstone-fe/
├── index.html                   # Root HTML entry point & retro-arcade font imports
├── package.json                 # React 19, TypeScript, Vite, Firebase & ESLint dependencies
├── vite.config.ts               # Vite dev server config with SSL & local Firebase /__/auth proxy
├── Dockerfile                   # Multi-stage Node 22 build -> Nginx stable-alpine production image
├── nginx.conf                   # Production Nginx config (SPA routing, /__/ auth proxy & VPC /api/ proxy)
└── src/
    ├── main.tsx                 # React DOM root mounting AuthProvider & App
    ├── App.tsx                  # ArcadeShell layout, view router & background upload ticker
    ├── firebase.tsx             # Firebase App & GoogleAuthProvider initialization
    ├── context/
    │   ├── AuthContext.tsx      # Firebase auth state listener & ID token provider
    │   └── UploadContext.tsx    # Persistent background direct-to-GCS upload state machine
    ├── services/
    │   ├── apiUtils.ts          # Authenticated fetch wrapper (injects Bearer JWT)
    │   ├── uploadService.ts     # Upload init, XHR direct-to-GCS PUT & completion triggers
    │   ├── vaultService.ts      # Long-form video list, detail & cascading delete calls
    │   ├── chatApiService.ts    # Chat session CRUD & WebSocket stream connection helpers
    │   └── reelService.ts       # Short-form clip save, subtitle patch & MP4 export calls
    ├── components/
    │   ├── header/              # Top studio navigation bar & user profile controls
    │   ├── buttons/             # Reusable retro-arcade UI button components
    │   ├── chat/                # SessionSidebar, MessageBubble & ClipPreviewCard
    │   └── reel/                # ReelClipCard (video player, dual-mode subtitle editor & export modal)
    ├── views/
    │   ├── Home/                # Studio landing dashboard
    │   ├── Upload/              # Drag-and-drop long-form video ingestion view
    │   ├── Vault/               # Long-form video library & status monitor
    │   ├── Chat/                # Multi-agent RAG & clipping studio view
    │   └── Reel/                # Saved short-form clip inspector & export studio
    └── types/                   # TypeScript interfaces for LFVideo, SFVideo, Chat & WebSocket frames
```

---

## 3. Prerequisites & Environment Configuration

### Prerequisites
- **Node.js `22+`** and **npm**.
- A running instance of **`capstone_be`** (locally on port `8000` or deployed on Cloud Run) and a configured **Firebase Authentication** web app.

### Environment Variables (`.env`)
Create a `.env` file in `capstone-fe/` with your Firebase Web SDK settings and backend base URL (replace angle-bracket placeholders with your environment's values):

```ini
# Firebase Web App Configuration
VITE_FIREBASE_API_KEY="<YOUR_FIREBASE_WEB_API_KEY>"
VITE_FIREBASE_AUTH_DOMAIN="<YOUR_FIREBASE_AUTH_DOMAIN>"
VITE_FIREBASE_PROJECT_ID="<YOUR_GCP_PROJECT_ID>"
VITE_FIREBASE_STORAGE_BUCKET="<YOUR_FIREBASE_STORAGE_BUCKET>"
VITE_FIREBASE_MESSAGING_SENDER_ID="<YOUR_FIREBASE_MESSAGING_SENDER_ID>"
VITE_FIREBASE_APP_ID="<YOUR_FIREBASE_APP_ID>"
VITE_FIREBASE_MEASUREMENT_ID="<YOUR_FIREBASE_MEASUREMENT_ID>"

# Backend API Base URL
# For local development against a local FastAPI backend: http://localhost:8000
# For production behind the Nginx same-origin /api/ reverse proxy: leave empty ("")
VITE_BACKEND_BASE_URL="http://localhost:8000"
```

---

## 4. Running Locally

```bash
cd capstone-fe

# 1. Install dependencies
npm install

# 2. Start the Vite development server with Hot Module Replacement (HMR)
npm run dev
```

### Quality & Build Verification
```bash
# Type-check and compile the production bundle into dist/
npm run build

# Run ESLint static analysis
npm run lint

# Preview the production build locally
npm run preview
```

---

## 5. Production Architecture & Cloud Deployment

In production on Google Cloud Run, `capstone-fe` serves as both the **public web frontend** (`INGRESS_TRAFFIC_ALL`) and the **VPC-connected Nginx reverse proxy** (`nginx.conf`):
1. **Static SPA Hosting (`location /`)**: Serves the compiled Vite bundle (`try_files $uri $uri/ /index.html`).
2. **Same-Origin Firebase Auth Proxy (`location /__/`)**: Proxies `/__/auth/handler` requests via Cloud NAT to `<YOUR_GCP_PROJECT_ID>.firebaseapp.com` so OAuth redirect flows stay same-origin.
3. **Private VPC Reverse Proxy (`location /api/`)**: Forwards all REST (`/api/*`) and WebSocket (`/api/chat/stream`) requests over the segmented VPC network (`10.0.0.0/16`) to the internal-only Backend Cloud Run Service (`INGRESS_TRAFFIC_INTERNAL_ONLY`) with HTTP/1.1 `Upgrade` headers and `900s` streaming timeouts.

### Option A: Build & Deploy Container Image to Cloud Run
Ensure `nginx.conf` is configured with your environment's Firebase Auth domain and internal Backend Cloud Run URL, then build and deploy:

```bash
# 1. Build the multi-stage Docker image with compile-time Vite args
docker build \
  --build-arg VITE_FIREBASE_API_KEY="<YOUR_FIREBASE_WEB_API_KEY>" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="<YOUR_FIREBASE_AUTH_DOMAIN>" \
  --build-arg VITE_FIREBASE_PROJECT_ID="<YOUR_GCP_PROJECT_ID>" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="<YOUR_FIREBASE_STORAGE_BUCKET>" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="<YOUR_FIREBASE_MESSAGING_SENDER_ID>" \
  --build-arg VITE_FIREBASE_APP_ID="<YOUR_FIREBASE_APP_ID>" \
  --build-arg VITE_FIREBASE_MEASUREMENT_ID="<YOUR_FIREBASE_MEASUREMENT_ID>" \
  --build-arg VITE_BACKEND_BASE_URL="" \
  -t "<GCP_REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<ARTIFACT_REPO>/<FRONTEND_IMAGE_NAME>:<TAG>" .

# 2. Push to Artifact Registry
docker push "<GCP_REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<ARTIFACT_REPO>/<FRONTEND_IMAGE_NAME>:<TAG>"

# 3. Deploy to Cloud Run
gcloud run services update "<FRONTEND_SERVICE_NAME>" \
  --image "<GCP_REGION>-docker.pkg.dev/<GCP_PROJECT_ID>/<ARTIFACT_REPO>/<FRONTEND_IMAGE_NAME>:<TAG>" \
  --region "<GCP_REGION>" \
  --project "<GCP_PROJECT_ID>"
```

### Option B: Provision Full Stack via Terraform IaC
From the repository root `terraform/` directory:
```bash
cd ../terraform
cp terraform.tfvars.example terraform.tfvars
# Populate terraform.tfvars with your environment values, then run:
terraform init
terraform apply -var-file="terraform.tfvars"
```
