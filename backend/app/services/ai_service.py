import os
import json
import difflib
import requests
from app.config import Config

class AIService:
    @staticmethod
    def is_configured() -> bool:
        return bool(Config.OPENAI_API_KEY and Config.OPENAI_API_KEY.strip())

    @staticmethod
    def generate_diff(original_code: str, modified_code: str, filename: str = "file") -> str:
        """Generate unified diff between original and modified code."""
        orig_lines = original_code.splitlines(keepends=True)
        mod_lines = modified_code.splitlines(keepends=True)
        diff = difflib.unified_diff(
            orig_lines,
            mod_lines,
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
            lineterm=""
        )
        return "".join(diff)

    @classmethod
    def ask(cls, prompt: str, system_prompt: str = None, code_context: str = None, 
            filename: str = None, language: str = None, project_files: list = None) -> dict:
        """
        Main AI query handler. Works with OpenAI or any OpenAI-compatible provider
        (DeepSeek, Groq, Ollama, OpenRouter, etc.).
        """
        default_system = (
            "You are Secure-Collab AI, an expert software engineering assistant. "
            "You provide clear, accurate, performant, and secure code solutions. "
            "When asked to refactor, fix, or write code, always provide clear explanations "
            "and enclose full or replacement code blocks in markdown code fences."
        )
        sys_instruction = system_prompt or default_system

        # Context assembly with token/size safeguarding
        context_parts = []
        if code_context:
            context_parts.append(f"### Context File: {filename or 'current_file'} ({language or 'code'})\n```{language or ''}\n{code_context[:8000]}\n```")

        if project_files:
            # Add up to 3 relevant project files for background context
            context_parts.append("### Relevant Project Files Context:")
            for pf in project_files[:3]:
                if pf.get("content"):
                    context_parts.append(f"File `{pf.get('path')}`:\n```{pf.get('language', '')}\n{pf.get('content')[:3000]}\n```")

        user_content = prompt
        if context_parts:
            user_content = f"{chr(10).join(context_parts)}\n\n### Task / Question:\n{prompt}"

        # If API key is configured, call OpenAI-compatible endpoint
        if cls.is_configured():
            try:
                headers = {
                    "Authorization": f"Bearer {Config.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": Config.AI_MODEL,
                    "messages": [
                        {"role": "system", "content": sys_instruction},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2048
                }
                response = requests.post(
                    f"{Config.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=45
                )

                if response.status_code == 200:
                    data = response.json()
                    ai_reply = data["choices"][0]["message"]["content"]
                    
                    # Extract suggested code replacement if prompt is refactor/fix/debug
                    suggested_diff = None
                    if code_context and ("```" in ai_reply):
                        # Extract first fenced code block
                        try:
                            start = ai_reply.find("```")
                            end_marker = ai_reply.find("```", start + 3)
                            if end_marker != -1:
                                block = ai_reply[start:end_marker].split("\n", 1)
                                if len(block) > 1:
                                    suggested_code = block[1].strip()
                                    suggested_diff = cls.generate_diff(code_context, suggested_code, filename or "code")
                        except Exception:
                            suggested_diff = None

                    return {
                        "content": ai_reply,
                        "suggested_diff": suggested_diff,
                        "provider": Config.AI_PROVIDER,
                        "model": Config.AI_MODEL
                    }
                else:
                    return {
                        "content": f"AI Provider returned error {response.status_code}: {response.text}",
                        "suggested_diff": None,
                        "provider": "error",
                        "model": Config.AI_MODEL
                    }
            except Exception as e:
                return {
                    "content": f"Connection error reaching AI Provider: {str(e)}. Please check your network and API configuration in backend/.env",
                    "suggested_diff": None,
                    "provider": "error",
                    "model": Config.AI_MODEL
                }

        # Fallback intelligent assistant when API key is not yet set
        return cls._generate_intelligent_offline_response(prompt, code_context, language, filename)

    @classmethod
    def _generate_intelligent_offline_response(cls, prompt: str, code_context: str, language: str, filename: str) -> dict:
        """Helpful offline assistant that guides user and handles code analysis."""
        prompt_lower = prompt.lower()
        lang = language or "code"
        
        reply_content = ""
        suggested_code = None

        if "explain" in prompt_lower:
            reply_content = (
                f"### Analysis of `{filename or 'Selected Code'}` ({lang})\n\n"
                f"**Overview:**\n"
                f"This code snippet provides logic for your application. Here is a breakdown of what it performs:\n\n"
                f"1. **Structure & Semantics:** The code follows idiomatic {lang} patterns.\n"
                f"2. **Execution Flow:** Inputs are processed sequentially, and operations are scoped appropriately.\n"
                f"3. **Security & Validation:** Ensure boundaries, types, and error conditions are checked at runtime.\n\n"
                f"> **Configuration Note:** To enable live LLM models (OpenAI, DeepSeek, Claude, etc.), set `OPENAI_API_KEY` in `backend/.env`."
            )
        elif "debug" in prompt_lower or "fix" in prompt_lower:
            reply_content = (
                f"### Debugging Suggestions for `{filename or 'Code'}`\n\n"
                f"Common potential issues detected in {lang}:\n"
                f"- **Null/Undefined Checks:** Verify all referenced variables and parameters are valid.\n"
                f"- **Error Handling:** Wrap external IO and network operations in `try/catch` or error handlers.\n"
                f"- **Async Synchronization:** Ensure promises or callbacks resolve accurately.\n\n"
                f"*(Tip: Set `OPENAI_API_KEY` in `backend/.env` for dynamic automated bug detection)*"
            )
        elif "refactor" in prompt_lower or "optimize" in prompt_lower:
            reply_content = (
                f"### Refactoring Recommendations\n\n"
                f"- Extract repetitive logic into clean modular helper functions.\n"
                f"- Use constant lookups or caching for frequently accessed attributes.\n"
                f"- Add type annotations and descriptive docstrings to clarify interfaces.\n\n"
                f"*(Tip: Set `OPENAI_API_KEY` in `backend/.env` for automated refactored code output)*"
            )
        elif "test" in prompt_lower:
            reply_content = (
                f"### Unit Test Suggestions\n\n"
                f"For {lang}, recommended test cases:\n"
                f"1. **Happy Path:** Valid input returns expected output.\n"
                f"2. **Boundary Cases:** Empty lists, 0, None, edge inputs.\n"
                f"3. **Error Paths:** Invalid types or forbidden states raise appropriate exceptions.\n"
            )
        else:
            reply_content = (
                f"### Secure-Collab AI Assistant\n\n"
                f"I am ready to help you write, debug, and optimize your code!\n\n"
                f"**How to configure a live AI model:**\n"
                f"1. Open `backend/.env`\n"
                f"2. Add your API key: `OPENAI_API_KEY=sk-...`\n"
                f"3. (Optional) Custom base URL: `OPENAI_BASE_URL=https://api.openai.com/v1`\n"
                f"4. (Optional) Model name: `AI_MODEL=gpt-4o-mini` (or `deepseek-chat`, `claude-3-haiku`, etc.)\n"
                f"5. Restart the backend to activate full real-time generation."
            )

        diff = None
        if suggested_code and code_context:
            diff = cls.generate_diff(code_context, suggested_code, filename or "code")

        return {
            "content": reply_content,
            "suggested_diff": diff,
            "provider": "offline_assistant",
            "model": "configured_offline_guide"
        }
