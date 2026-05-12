import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.llm import call_llm

router = APIRouter()

class RefundMessageRequest(BaseModel):
    업종: str
    업체명: str
    결제금액: int
    이용일수: int
    환불예상금: int
    부당위약금: int

@router.post("/generate/message")
def generate_refund_message(req: RefundMessageRequest):
    if not req.업종.strip():
        raise HTTPException(status_code=422, detail="업종을 입력해주세요.")
    if not req.업체명.strip():
        raise HTTPException(status_code=422, detail="업체명을 입력해주세요.")
    if req.결제금액 <= 0:
        raise HTTPException(status_code=422, detail="결제금액은 0원보다 커야 합니다.")
    if req.이용일수 < 0:
        raise HTTPException(status_code=422, detail="이용일수는 0 이상이어야 합니다.")
    if req.환불예상금 < 0:
        raise HTTPException(status_code=422, detail="환불예상금은 0 이상이어야 합니다.")
    if req.부당위약금 < 0:
        raise HTTPException(status_code=422, detail="부당위약금은 0 이상이어야 합니다.")

    prompt = f"""
당신은 소비자 권리 전문가입니다. 아래 정보를 바탕으로 환불 요청 문구 3가지를 작성해주세요.

[계약 정보]
- 업종: {req.업종}
- 업체명: {req.업체명}
- 결제금액: {req.결제금액:,}원
- 이용일수: {req.이용일수}일
- 환불 예상금: {req.환불예상금:,}원
- 부당 위약금: {req.부당위약금:,}원

[작성 조건]
1. 카카오톡/문자용 (간단, 2~3문장)
2. 이메일용 (정식 공문 형식)
3. 강경 대응용 (법조문 인용, 소비자원 신고 예고 포함)

반드시 JSON 형식으로만 응답하세요:
{{
  "카카오톡용": "...",
  "이메일용": "...",
  "강경대응용": "..."
}}
"""
    result = call_llm(prompt)

    match = re.search(r'\{.*\}', result, re.DOTALL)
    if not match:
        raise HTTPException(status_code=502, detail="AI가 올바른 형식으로 응답하지 않았습니다. 다시 시도해주세요.")

    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI 응답 파싱에 실패했습니다. 다시 시도해주세요.")
