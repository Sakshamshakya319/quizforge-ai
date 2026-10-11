import httpx
import os
import json
from typing import List, Dict

# The base URL of the local llama-server inference engine
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://127.0.0.1:8082")

async def generate_chat_completion(messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: int = 1024) -> str:
    """
    Sends a chat completion request to the llama-server compatible endpoint.
    """
    payload = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{LLM_BASE_URL.rstrip('/')}/v1/chat/completions",
                json=payload
            )
            
            if response.status_code != 200:
                raise Exception(f"Inference server error: {response.status_code} - {response.text}")
            
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            else:
                raise Exception("Invalid response structure from inference server.")
                
    except httpx.ConnectError:
        raise Exception(f"Failed to connect to inference server at {LLM_BASE_URL}. Ensure llama-server is running.")
    except Exception as e:
        raise Exception(f"Inference failed: {str(e)}")
