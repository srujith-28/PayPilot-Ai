/**
 * Test script to verify real Gemini API connectivity with server-side SDK.
 * Never outputs the actual API key string.
 */

import { getGeminiClient, processAssistantRequest } from './gemini.ts';

async function runTest() {
  console.log('[TestCall] Checking Gemini Client...');
  const client = getGeminiClient();
  if (!client) {
    console.log('[TestCall] GEMINI_API_KEY is missing or set to placeholder.');
    process.exit(1);
  }

  console.log('[TestCall] Testing direct model generation with gemini-3.8-flash...');
  try {
    const res = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Respond with exactly: "PAYPILOT_GEMINI_ONLINE"',
    });
    console.log('[TestCall] Direct call result:', res.text?.trim());
  } catch (err: any) {
    console.error('[TestCall] Direct call error:', err.message);
  }

  console.log('[TestCall] Testing assistant orchestration with tool execution...');
  try {
    const assistantRes = await processAssistantRequest({
      message: 'Which invoices are currently overdue and what is the total overdue amount?',
    });
    console.log('[TestCall] Assistant success:', assistantRes.success);
    console.log('[TestCall] Model used:', assistantRes.modelUsed);
    console.log('[TestCall] Tools executed:', assistantRes.toolCallsExecuted);
    console.log('[TestCall] Reply snippet:', assistantRes.reply.slice(0, 150));
  } catch (err: any) {
    console.error('[TestCall] Assistant call error:', err.message);
  }
  process.exit(0);
}

runTest().catch((err) => {
  console.error('[TestCall] Fatal failure:', err);
  process.exit(1);
});
