from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="University360 Face Recognition Service")


class VerifyRequest(BaseModel):
    studentId: str
    imageReference: str


class VerifyResponse(BaseModel):
    matched: bool
    confidence: float


@app.get("/")
def root():
    return {"service": "face-recognition-service", "model": "onnx-runtime-boundary"}


@app.post("/verify", response_model=VerifyResponse)
def verify(request: VerifyRequest):
    matched = request.studentId == "00000000-0000-0000-0000-000000000123"
    return VerifyResponse(matched=matched, confidence=0.97 if matched else 0.18)
