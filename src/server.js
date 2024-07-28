const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const axios = require('axios');
const app = express();
const port = 3000;
const dotenv = require('dotenv');
const { encode } = require('gpt-3-encoder');
const fs = require('fs');
const multer = require('multer');
const upload = multer();
dotenv.config();
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'AssistantWebApp-testing',
    password: 'lol',
    port: 5432,
});
app.use(express.json());
app.use(express.static(path.join(__dirname, '../src')));
app.use(express.static(path.join(__dirname, '../dist'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));
// Add this line to serve audio files from the public/audio directory
app.use('/audio', express.static(path.join(__dirname, '..', 'public', 'audio')));
const { OpenAI } = require('openai');
const openai = new OpenAI();
// Add a new route to handle TTS requests
app.post('/api/tts', async (req, res) => {
    var _a;
    const { text, model, voice, messageId } = req.body;
    try {
        // Check if an audio URL already exists for the message
        const result = await pool.query('SELECT audio_url FROM messages WHERE id = $1', [messageId]);
        const existingAudioUrl = (_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.audio_url;
        if (existingAudioUrl) {
            // If an audio URL exists, return it without generating a new audio file
            res.json({ audioUrl: existingAudioUrl });
        }
        else {
            // If no audio URL exists, generate a new audio file
            const mp3 = await openai.audio.speech.create({
                model: model,
                voice: voice,
                input: text,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            const audioFileName = `${messageId}.mp3`;
            const audioDirectory = path.join(__dirname, '..', 'public', 'audio');
            const audioFilePath = path.join(audioDirectory, audioFileName);
            if (!fs.existsSync(audioDirectory)) {
                fs.mkdirSync(audioDirectory, { recursive: true });
            }
            await fs.promises.writeFile(audioFilePath, buffer);
            const audioUrl = `/audio/${audioFileName}`;
            await pool.query('UPDATE messages SET audio_url = $1 WHERE id = $2', [audioUrl, messageId]);
            res.json({ audioUrl });
        }
    }
    catch (error) {
        console.error('Error generating TTS:', error);
        res.sendStatus(500);
    }
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});
app.post('/api/chats', async (req, res) => {
    const { systemMessage } = req.body;
    const defaultSystemMessage = 'How can I assist you today?';
    try {
        const result = await pool.query('INSERT INTO chats (system_message, name) VALUES ($1, $2) RETURNING *', [systemMessage || defaultSystemMessage, '']);
        const newChat = result.rows[0];
        await pool.query('UPDATE chats SET name = $1 WHERE smid = $2', [newChat.smid.toString(), newChat.smid]);
        console.log('New chat created with smid:', newChat.smid);
        res.json(newChat);
    }
    catch (error) {
        console.error('Error creating new chat:', error);
        res.sendStatus(500);
    }
});
app.get('/api/chats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM chats ORDER BY smid DESC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error retrieving chats:', error);
        res.sendStatus(500);
    }
});
app.post('/api/api-keys', (req, res) => {
    const { anthropicApiKey, openaiApiKey, useAnthropicEnvVariable, useOpenaiEnvVariable } = req.body;
    if (useAnthropicEnvVariable) {
        // Use environment variable for Anthropic API key
        process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
    }
    else {
        // Use user-provided Anthropic API key
        process.env.ANTHROPIC_API_KEY = anthropicApiKey;
    }
    if (useOpenaiEnvVariable) {
        // Use environment variable for OpenAI API key
        process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
    }
    else {
        // Use user-provided OpenAI API key
        process.env.OPENAI_API_KEY = openaiApiKey;
    }
    res.json({ message: 'API keys saved successfully' });
});
app.put('/api/chats/:smid', async (req, res) => {
    const { smid } = req.params;
    const { name } = req.body;
    try {
        await pool.query('UPDATE chats SET name = $1 WHERE smid = $2', [name, BigInt(smid)]);
        console.log('Chat renamed in database');
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error renaming chat:', error);
        res.sendStatus(500);
    }
});
app.delete('/api/chats/:smid', async (req, res) => {
    const { smid } = req.params;
    try {
        await pool.query('DELETE FROM messages WHERE chat_id = $1', [BigInt(smid)]);
        await pool.query('DELETE FROM chats WHERE smid = $1', [BigInt(smid)]);
        console.log('Chat and associated messages deleted from database');
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error deleting chat:', error);
        res.sendStatus(500);
    }
});
app.get('/api/messages', async (req, res) => {
    const { chatId } = req.query;
    try {
        const result = await pool.query('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at', [BigInt(chatId)]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error retrieving messages:', error);
        res.sendStatus(500);
    }
});
app.post('/api/messages', async (req, res) => {
    const { message, chatId } = req.body;
    console.log('Received message:', message);
    try {
        await pool.query('INSERT INTO messages (content, role, chat_id) VALUES ($1, $2, $3)', [message, 'user', BigInt(chatId)]);
        console.log('Message saved to database');
        res.sendStatus(201);
    }
    catch (error) {
        console.error('Error saving message:', error);
        res.sendStatus(500);
    }
});
app.get('/api/saved-system-messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM saved_system_messages ORDER BY id');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error retrieving saved system messages:', error);
        res.sendStatus(500);
    }
});
app.delete('/api/messages/:messageId', async (req, res) => {
    const { messageId } = req.params;
    try {
        await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
        console.log('Message deleted from database');
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error deleting message:', error);
        res.sendStatus(500);
    }
});
app.post('/api/system-message', async (req, res) => {
    const { systemMessage, chatId } = req.body;
    try {
        // Save the system message to the saved_system_messages table
        await pool.query('INSERT INTO saved_system_messages (content) VALUES ($1) ON CONFLICT (content) DO NOTHING', [systemMessage]);
        // Update the system message in the chats table
        await pool.query('UPDATE chats SET system_message = $1 WHERE smid = $2', [systemMessage, BigInt(chatId)]);
        console.log('System message saved to database');
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error saving system message:', error);
        res.sendStatus(500);
    }
});
app.post('/api/token-count', async (req, res) => {
    const { messages, model } = req.body;
    try {
        let tokenCount = 0;
        if (model.startsWith('gpt-')) {
            // Calculate token count for GPT models
            tokenCount = messages.reduce((count, message) => count + encode(message.content).length, 0);
        }
        else {
            // Calculate token count for Claude models
            tokenCount = messages.reduce((count, message) => count + message.content.split(' ').length, 0);
        }
        res.json({ tokenCount });
    }
    catch (error) {
        console.error('Error calculating token count:', error);
        res.sendStatus(500);
    }
});
app.delete('/api/system-message/:smid', async (req, res) => {
    const { smid } = req.params;
    try {
        await pool.query('UPDATE chats SET system_message = NULL WHERE smid = $1', [BigInt(smid)]);
        console.log('System message deleted from database');
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error deleting system message:', error);
        res.sendStatus(500);
    }
});
app.post('/api/generate', upload.none(), async (req, res) => {
    console.log('call to /api/generate received');
    const { message, model, responseTokenLength, temperature, base64Image } = req.body;
    const chatId = req.body.chatId ? BigInt(req.body.chatId) : null;
    const maxTokens = 2000; // Set your desired maximum token count
    if (base64Image) {
        console.log(`b64: ${base64Image}`);
    }
    try {
        let previousMessages = [];
        if (chatId) {
            // Retrieve previous messages from the database only if chatId is provided
            const result = await pool.query('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC', [chatId]);
            previousMessages = result.rows;
        }
        // Calculate the total token count of previous messages
        let tokenCount = 0;
        const messages = [];
        let lastRole = '';
        for (const prevMessage of previousMessages) {
            const messageTokens = prevMessage.content.split(' ').length;
            if (tokenCount + messageTokens <= maxTokens) {
                if (prevMessage.role !== lastRole) {
                    messages.unshift({
                        role: prevMessage.role,
                        content: prevMessage.content,
                    });
                    lastRole = prevMessage.role;
                    tokenCount += messageTokens;
                }
            }
            else {
                break;
            }
        }
        // Add the current user message
        if (model === 'gpt-4-turbo') {
            if (base64Image) {
                messages.push({
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': message,
                        },
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': `data:image/jpeg;base64,{${base64Image}}`
                            },
                        },
                    ],
                });
            }
            else if (model.startsWith('claude-') && base64Image) {
                messages.push({
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': 'image/jpeg',
                                'data': `image/jpeg;base64,{${base64Image}}`,
                            },
                        },
                        {
                            'type': 'text',
                            'text': message,
                        },
                    ],
                });
            }
            else {
                messages.push({
                    role: 'user',
                    content: message,
                });
            }
        }
        messages.forEach((msg, index) => {
            console.log(`Message ${index + 1}:`, msg);
        });
        console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY);
        console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY);
        let apiKey, apiUrl;
        if (model.startsWith('gpt-')) {
            // GPT-4 API configuration
            apiKey = req.body.useOpenaiEnvVariable ? process.env.OPENAI_API_KEY : req.body.openaiApiKey;
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        }
        else {
            // Claude API configuration
            apiKey = req.body.useAnthropicEnvVariable ? process.env.ANTHROPIC_API_KEY : req.body.anthropicApiKey;
            apiUrl = 'https://api.anthropic.com/v1/messages';
        }
        console.log(`api key ${apiKey}`);
        let systemPrompt = '';
        if (chatId) {
            const chatResult = await pool.query('SELECT system_message FROM chats WHERE smid = $1', [chatId]);
            systemPrompt = chatResult.rows[0].system_message || ''; // Use an empty string if system_message is null
        }
        console.log('Sys prompt:', systemPrompt);
        console.log('Sending request to API...');
        let response;
        if (model === 'gpt-4-turbo') {
            // GPT-4 API request with image
            response = await axios.post(apiUrl, {
                model: model,
                messages: messages,
                max_tokens: responseTokenLength,
                temperature: temperature,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
            });
        }
        else if (model.startsWith('gpt-')) {
            if (systemPrompt) {
                // Insert the system message at index 1
                messages.splice(1, 0, { role: 'system', content: systemPrompt }); // Adjust the key as needed ('content' or 'message')
            }
            console.log('Final messages array before sending to API:');
            messages.forEach((msg, index) => {
                console.log(`Message ${index + 1}: Role - ${msg.role}, Content - ${msg.content || msg.message}`);
                // Use 'msg.content || msg.message' depending on what your message objects use
            });
            // Log to see the structure after insertion, helpful for debugging
            console.log('Messages with system prompt:', messages); // GPT-4 API request
            console.log(apiKey);
            response = await axios.post(apiUrl, {
                model: model,
                messages: messages,
                max_tokens: responseTokenLength,
                temperature: temperature,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
            });
        }
        else {
            // Claude API request
            console.log(apiKey);
            response = await axios.post(apiUrl, {
                model: model,
                messages: messages,
                max_tokens: responseTokenLength,
                temperature: temperature,
                system: systemPrompt || undefined, // Use undefined if systemPrompt is an empty string
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
            });
        }
        console.log('Received response from API:', response.data);
        let aiResponseText;
        if (model.startsWith('gpt-')) {
            // Extract response from GPT-4 API
            aiResponseText = response.data.choices[0].message.content;
        }
        else {
            // Extract response from Claude API
            aiResponseText = response.data.content[0].text;
        }
        if (chatId) {
            let imageUrl;
            if (base64Image) {
                // Save the image to the server and get the URL
                const imageFileName = `${Date.now()}.jpg`;
                const imageDirectory = path.join(__dirname, '..', 'public', 'images');
                const imageFilePath = path.join(imageDirectory, imageFileName);
                if (!fs.existsSync(imageDirectory)) {
                    fs.mkdirSync(imageDirectory, { recursive: true });
                }
                await fs.promises.writeFile(imageFilePath, Buffer.from(base64Image, 'base64'));
                imageUrl = `/images/${imageFileName}`;
            }
            await pool.query('INSERT INTO messages (content, role, chat_id, image_url) VALUES ($1, $2, $3, $4)', [aiResponseText, 'assistant', chatId, imageUrl]);
        }
        res.json({ response: aiResponseText });
    }
    catch (error) {
        console.error('Error generating AI response:', error.response ? error.response.data : error);
        res.status(500).json({ error: 'Error generating AI response' });
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
