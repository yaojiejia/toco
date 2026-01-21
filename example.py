"""
Example Python file demonstrating TOCO extension
This file shows various LLM API call patterns that the extension can detect
"""

import openai
from anthropic import Anthropic

openai_client = openai.OpenAI(api_key="your-api-key")
anthropic_client = Anthropic(api_key="your-api-key")

# Example 1: Simple OpenAI chat completion
async def simple_chat_completion():
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": "What is the capital of France?"
            }
        ]
    )
    return response

# Example 2: Multiple messages
async def multiple_messages():
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": "First message"},
            {"role": "user", "content": "Second message"},
            {"role": "user", "content": "Third message"}
        ]
    )
    return response

# Example 3: F-string with dynamic content
async def dynamic_prompt(user_input: str):
    response = await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": f"User said: {user_input}"
            }
        ]
    )
    return response

# Example 4: Claude API call
async def claude_completion():
    response = await anthropic_client.messages.create(
        model="claude-3-sonnet",
        messages=[
            {
                "role": "user",
                "content": "What is the capital of France?"
            }
        ]
    )
    return response

# Example 5: Regular (non-async) function
def regular_function():
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": "This is a regular function, not async"
            }
        ]
    )
    return response

# Example 6: Function calling other functions (async)
async def api_call():
    await openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Test"}]
    )

async def combine_calls():
    await api_call()
    await api_call()

# Example 7: Function calling other functions (regular)
def regular_api_call():
    openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Regular call"}]
    )

def regular_combine_calls():
    regular_api_call()
    regular_api_call()

