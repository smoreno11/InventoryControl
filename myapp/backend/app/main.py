import os
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

@app.get("/api/health")
def health():
    return {"ok": True, "":"Saul is testing the backend"}

@app.get("/api/echo")
def echo(msg: str = "hello"):
    return {"msg": msg}

if __name__ == "__main__":
    # Optional: allow `python app/main.py` for quick checks (uvicorn is preferred)
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=True)
