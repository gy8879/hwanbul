from fastapi import APIRouter
from pydantic import BaseModel
from services.gemini import call_gemini

router = APIRouter()

class ContractAnalyzeRequest(BaseModel):
    계약서_텍스트: str
    업종: str

@router.post("/analyze/contract")
def analyze_contract(req: ContractAnalyzeRequest):
    prompt = f"""
당신은 소비자 보호 법률 전문가입니다. 아래 {req.업종} 계약서를 분석해서 부당한 조항을 찾아주세요.

[계약서 내용]
{req.계약서_텍스트}

[탐지 기준]
- "환불 불가" 조항 (소비자분쟁해결기준 위반)
- 법정 한도 초과 위약금 (잔여금액 10% 초과)
- 자동 연장 조항 (사전 고지 의무 위반)
- 기타 소비자 권리 침해 조항

반드시 JSON 형식으로만 응답하세요:
{{
  "위험도": "높음 또는 보통 또는 낮음",
  "부당조항_수": 0,
  "탐지된_조항": [
    {{
      "원문": "계약서 원문 그대로",
      "판정": "왜 부당한지 한 줄 설명",
      "근거법령": "관련 법령명"
    }}
  ],
  "총평": "전체 계약서에 대한 한 줄 요약"
}}
"""
    result = call_gemini(prompt)

    import json, re
    match = re.search(r'\{.*\}', result, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {"raw": result}
