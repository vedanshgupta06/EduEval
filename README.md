# EduEval

EduEval has three local services:

- `frontend` - React/Vite app on port `5173`
- `edueval-backend` - Spring Boot API on port `8080`
- `edueval-ai` - Python/FastAPI evaluator on port `8000`

## Run The Project

Open three terminals from the project root.

### 1. Python evaluator

```powershell
cd edueval-ai
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

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

The frontend calls the backend at `http://localhost:8080`, and the backend calls the Python evaluator at `http://localhost:8000`.
