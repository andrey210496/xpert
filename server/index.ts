import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatRouter } from './routes/chat.js';
import { knowledgeRouter } from './routes/knowledge.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', chatRouter);
app.use('/api/knowledge', knowledgeRouter);

app.listen(PORT, () => {
    console.log(`[XPERT API] Server running on http://localhost:${PORT}`);
    console.log(`[XPERT API] OpenRouter key: ${process.env.OPENROUTER_API_KEY ? '✅ loaded' : '❌ MISSING'}`);
    console.log(`[XPERT API] OpenRouter model: ${process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini (default)'}`);
});
