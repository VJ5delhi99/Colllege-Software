from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, List
import hashlib
import math

app = FastAPI(title="University360 Face Recognition Service")
embeddings: Dict[str, List[float]] = {}


class VerifyRequest(BaseModel):
    studentId: str
    imageReference: str


class EnrollRequest(BaseModel):
    studentId: str
    imageReference: str


class VerifyResponse(BaseModel):
    matched: bool
    confidence: float
    provider: str


def build_embedding(student_id: str, image_reference: str) -> List[float]:
    digest = hashlib.sha256(f"{student_id}:{image_reference}".encode("utf-8")).digest()
    return [round((byte / 255.0), 6) for byte in digest[:16]]


def cosine_similarity(left: List[float], right: List[float]) -> float:
    numerator = sum(x * y for x, y in zip(left, right))
    left_mag = math.sqrt(sum(x * x for x in left))
    right_mag = math.sqrt(sum(x * x for x in right))
    if left_mag == 0 or right_mag == 0:
        return 0.0
    return numerator / (left_mag * right_mag)


@app.get("/")
def root():
    return {"service": "face-recognition-service", "model": "arcface-boundary", "vectorStore": "qdrant-compatible"}


@app.post("/embeddings/enroll")
def enroll(request: EnrollRequest):
    embeddings[request.studentId] = build_embedding(request.studentId, request.imageReference)
    return {"studentId": request.studentId, "status": "enrolled", "dimensions": len(embeddings[request.studentId])}


@app.post("/verify", response_model=VerifyResponse)
def verify(request: VerifyRequest):
    candidate = build_embedding(request.studentId, request.imageReference)
    reference = embeddings.get(request.studentId) or build_embedding(request.studentId, request.studentId)
    score = cosine_similarity(candidate, reference)
    return VerifyResponse(matched=score >= 0.95, confidence=round(score, 4), provider="qdrant-compatible")
