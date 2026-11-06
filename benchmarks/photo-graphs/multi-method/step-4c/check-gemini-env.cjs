// Presence only. No credential value, files, validation request or transport.
function checkEnvironment (env = process.env) {
  return { gemini_api_key_configured: typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim().length > 0,
    inference_enabled: false, check_scope: 'environment_presence_only' }
}
if (require.main === module) process.stdout.write(JSON.stringify(checkEnvironment()) + '\n')
module.exports = { checkEnvironment }
