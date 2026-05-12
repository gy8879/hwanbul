import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.llm import call_llm

router = APIRouter()

class ContractAnalyzeRequest(BaseModel):
    계약서_텍스트: str
    업종: str

@router.post("/analyze/contract")
def analyze_contract(req: ContractAnalyzeRequest):
    if not req.계약서_텍스트.strip():
        raise HTTPException(status_code=422, detail="계약서 텍스트를 입력해주세요.")
    if not req.업종.strip():
        raise HTTPException(status_code=422, detail="업종을 입력해주세요.")

    prompt = f"""
당신은 「환불 정보 안내 도우미」입니다. 변호사가 아니며, 법률 자문이나 위법성 판단은
하지 않습니다. 아래 {req.업종} 약관에서 "일반적으로 소비자 분쟁이 자주 되는 표현"을
사실 그대로 찾아 사용자에게 안내해 주세요.

[안내 원칙]
- "부당하다", "불법이다", "위반이다" 같은 단정적 판단 표현은 사용하지 않습니다.
- 대신 "공정거래위원회 소비자분쟁해결기준에서 일반적으로 분쟁이 자주 되는 표현입니다",
  "참고 기준과 다를 수 있으니 사용자가 확인이 필요한 표현입니다" 식으로 안내합니다.
- 출처는 가급적 「공정거래위원회 소비자분쟁해결기준」 또는 일반적으로 참고되는 공식
  기준명만 인용합니다.
- 특정 법조문이나 판례를 해석·적용하지 않습니다.

[약관 내용]
{req.계약서_텍스트}

[자주 분쟁이 되는 표현 예시]
- "환불 불가" / "환급 불가" / "취소 불가"
- "양도만 가능"
- "정상가/이벤트가/할인가 기준 위약금"
- 결제금액 대비 과도한 비율의 위약금
- 자동 연장·자동 결제에 대한 사전 고지 부재
- 잔여기간 일방적 소멸

반드시 JSON 형식으로만 응답하세요. "위험도"는 "분쟁 가능성" 의미입니다.
{{
  "위험도": "높음 또는 보통 또는 낮음",
  "부당조항_수": 0,
  "탐지된_조항": [
    {{
      "원문": "약관에 등장한 표현 그대로",
      "판정": "어떤 점에서 자주 분쟁이 되는지 한 줄 안내 (단정적 표현 금지)",
      "근거법령": "공정거래위원회 소비자분쟁해결기준 등 참고 기준명"
    }}
  ],
  "총평": "전반적으로 어떤 점을 확인하면 좋은지 한 줄 안내"
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
