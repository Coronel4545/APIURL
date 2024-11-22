const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
const server = app.listen(process.env.PORT || 3000);

// Configuração do CORS
app.use(cors({
    origin: ['https://seu-site.netlify.app', 'http://localhost:3000'], // Adicione seu domínio do Netlify
    methods: ['GET', 'POST'],
    credentials: true
}));

// Criando servidor WebSocket
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Nova conexão estabelecida');

    ws.on('message', (message) => {
        console.log('Mensagem recebida:', message);
        // Seu código de tratamento de mensagem aqui
    });

    ws.on('error', (error) => {
        console.error('Erro WebSocket:', error);
    });
});
