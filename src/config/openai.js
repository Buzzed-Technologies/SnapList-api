const OpenAI = require('openai');

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.error('Missing OpenAI API key in environment variables');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openaiApiKey
});

module.exports = openai; 