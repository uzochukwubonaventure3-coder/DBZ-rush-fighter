import { createApp } from './app';
import { GeminiCoach, OpenAICoach, type CoachProvider } from './coach';
import { createDbFromEnv } from './db';
import { createPlatform } from './service';

const db = await createDbFromEnv();
let coach: CoachProvider | null = null;
const provider = process.env.AI_PROVIDER ?? (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL ? 'openai' : 'gemini');
if (provider === 'gemini') {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) coach = new GeminiCoach(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL);
  else console.warn('GEMINI_API_KEY / GEMINI_MODEL not both set: coaching uses the rule-based coach (labelled "rule-based", not AI).');
} else if (provider === 'openai') {
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) coach = new OpenAICoach(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL);
  else console.warn('OPENAI_API_KEY / OPENAI_MODEL not both set: coaching uses the rule-based coach (labelled "rule-based", not AI).');
} else {
  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

const app = createApp(createPlatform(db, coach), { webOrigin: process.env.WEB_ORIGIN });
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API listening on :${port} (db: ${process.env.DATABASE_URL ? 'postgres' : 'pglite'}, coach: ${coach?.name ?? 'rule-based'})`));
