/**
 * Example file demonstrating TOCO extension
 * This file shows various GPT API call patterns that the extension can detect
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Example 1: Simple chat completion with string literal
async function simpleChatCompletion() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });
  return response;
}

// Example 2: Chat completion with template string (no expressions)
async function templateStringPrompt() {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: `You are a helpful assistant. 
Please answer the following question:
What is the meaning of life?`,
      },
    ],
  });
  return response;
}

// Example 3: Multiple API calls in the same function
async function multipleCalls() {
  const firstResponse = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'First question',
      },
    ],
  });

  const secondResponse = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: 'Second question',
      },
    ],
  });

  return { firstResponse, secondResponse };
}

// Example 4: Dynamic prompt (will be marked as approximate)
async function dynamicPrompt(userInput: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'user',
        content: `User said: ${userInput}`,
      },
    ],
  });
  return response;
}

// Example 5: Legacy completions API
async function legacyCompletion() {
  const response = await openai.completions.create({
    model: 'gpt-3.5-turbo-instruct',
    prompt: 'Write a short story about a robot.',
    max_tokens: 100,
  });
  return response;
}

