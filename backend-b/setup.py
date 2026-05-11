import os

print("=== 환불도우미 백엔드 B 설정 ===")
key = input("Groq API 키를 붙여넣기 하세요 (gsk_로 시작): ").strip()

if not key.startswith("gsk_"):
    print("올바른 Groq API 키가 아닙니다. gsk_ 로 시작해야 합니다.")
else:
    with open(".env", "w") as f:
        f.write(f"GROQ_API_KEY={key}\n")
    print(".env 파일 저장 완료!")
    print("이제 uvicorn main:app --reload 로 서버를 실행하세요.")
