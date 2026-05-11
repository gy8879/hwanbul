import os
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-1.5-flash")

def call_gemini(prompt: str) -> str:
    response = model.generate_content(prompt)
    return response.text
