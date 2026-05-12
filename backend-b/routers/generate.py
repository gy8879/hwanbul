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

    법정위약금상한 = int(req.결제금액 * 0.1)
    업체위약금 = req.부당위약금
    부당초과금액 = max(0, 업체위약금 - 법정위약금상한)
    위약금초과여부 = 업체위약금 > 법정위약금상한

    if 위약금초과여부:
        위약금_설명 = (
            f"업체 청구 위약금 {업체위약금:,}원 — "
            f"법정 상한(결제금액의 10% = {법정위약금상한:,}원)을 "
            f"{부당초과금액:,}원 초과"
        )
    else:
        위약금_설명 = (
            f"업체 청구 위약금 {업체위약금:,}원 — "
            f"법정 상한(결제금액의 10% = {법정위약금상한:,}원) 이내"
        )

    prompt = f"""
당신은 「환불 요청 문구 작성 도우미」입니다. 변호사가 아니며 법률 자문은 하지 않습니다.
사용자가 본인 명의로 사업자에게 직접 보낼 환불 요청 문구를 정중하게 정리해 주세요.

[작성 원칙]
- 단정적인 위법·부당 판단 표현, 법조문 인용은 사용하지 않습니다.
- 대신 "공정거래위원회 소비자분쟁해결기준 등 일반 기준을 참고하여" 정도의 표현만 사용합니다.
- 협박성 표현, 형사 고발 예고 등 사용자가 직접 분쟁을 키우는 표현은 피합니다.
- 한국소비자원(1372) 상담 안내 정도는 정중하게 언급 가능합니다.

[계약 정보]
- 업종: {req.업종}
- 업체명: {req.업체명}
- 결제금액: {req.결제금액:,}원
- 이용일수: {req.이용일수}일
- 환불 예상금: {req.환불예상금:,}원
- 위약금: {위약금_설명}
{"- 위약금 초과 상황이므로, 강경대응용 문구에서 이 점을 정중히 언급해주세요." if 위약금초과여부 else "- 위약금은 법정 상한 이내이므로, 초과 관련 언급은 하지 않습니다."}

[작성할 3가지]
1. 카카오톡용: 사장님께 보내는 간단하고 정중한 2~3문장. 감정 자제.
2. 이메일용: 정식 공문 형식. 사실관계 → 요청 → 회신 요청 순서. 6~10줄 정도.
3. 강경대응용: 단호하지만 협박성 없는 정식 요청. 공정거래위원회 소비자분쟁해결기준
   참고 사실만 언급하고, 회신 기한과 소비자원 상담 의사를 정중히 안내합니다.
   판례·법조문은 직접 적용하지 않습니다.

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
