# EduEval

EduEval has three local services:

- `frontend` - React/Vite app on port `5173`
- `edueval-backend` - Spring Boot API on port `8080`
- `edueval-ai` - Python/FastAPI evaluator on port `8000`

## Run The Project

Open three terminals from the project root.

### Environment variables

Set these before starting the backend. Replace values as needed for your machine.

```powershell
$env:EDUEVAL_DB_URL="jdbc:postgresql://localhost:5432/edueval"
$env:EDUEVAL_DB_USERNAME="postgres"
$env:EDUEVAL_DB_PASSWORD="keep-your-password"
$env:EDUEVAL_JWT_SECRET="change-this-to-a-long-random-secret-at-least-32-characters"
$env:EDUEVAL_AI_BASE_URL="http://127.0.0.1:8000"
$env:EDUEVAL_OCR_SPACE_API_KEY="your_ocr_space_api_key_here"
$env:EDUEVAL_OCR_SPACE_ENGINE="2"
$env:EDUEVAL_OCR_SPACE_MAX_UPLOAD_BYTES="900000"
$env:EDUEVAL_OCR_SPACE_IMAGE_MAX_SIDE="1600"
```

### 1. Python evaluator

```powershell
cd edueval-ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Image and scanned PDF submissions use OCR.Space. Engine 2 is the default because
it works reliably with the free API endpoint; set `EDUEVAL_OCR_SPACE_ENGINE=3`
only if your OCR.Space key supports it. The demo key `helloworld` is rate
limited, so use your own OCR.Space API key for reliable testing.

### 2. Spring Boot backend

```powershell
cd edueval-backend
.\mvnw.cmd spring-boot:run
```

### 3. React frontend

```powershell
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

The frontend calls the backend at `http://localhost:8080`, and the backend calls the Python evaluator at `http://127.0.0.1:8000`.
