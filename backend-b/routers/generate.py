from fastapi import APIRouter
from pydantic import BaseModel
from services.gemini import call_gemini

router = APIRouter()

class RefundMessageRequest(BaseModel):
    업종: str              # 예: 헬스장, 필라테스, 학원
    업체명: str
    결제금액: int
    이용일수: int
    환불예상금: int        # 백엔드 A에서 받은 값
    부당위약금: int        # 백엔드 A에서 받은 값

@router.post("/generate/message")
def generate_refund_message(req: RefundMessageRequest):
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
    result = call_gemini(prompt)

    # Gemini 응답에서 JSON 파싱
    import json, re
    match = re.search(r'\{.*\}', result, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"raw": result}
