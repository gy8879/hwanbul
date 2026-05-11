from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from routers import generate, analyze

app = FastAPI(title="환불도우미 Backend B")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate.router, prefix="/api/b")
app.include_router(analyze.router, prefix="/api/b")

@app.get("/")
def index():
    return FileResponse("test.html")

@app.get("/api/b/health")
def health():
    return {"status": "ok", "service": "backend-b"}
