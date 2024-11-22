const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const app = express();

// Configurar CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// Criar servidor HTTP primeiro
const server = require('http').createServer(app);

// Configurar WebSocket anexado ao servidor HTTP
const wss = new WebSocket.Server({ 
    server: server,
    path: "/", // Caminho raiz
    perMessageDeflate: false,
    clientTracking: true,
    maxPayload: 50 * 1024 * 1024
});

// Eventos do WebSocket
wss.on('connection', (ws, req) => {
    console.log(`Nova conexão WebSocket de: ${req.socket.remoteAddress}`);
    console.log(`Origin: ${req.headers.origin}`);
    
    // Enviar mensagem de confirmação
    ws.send(JSON.stringify({ tipo: 'conexao', status: 'conectado' }));

    ws.on('message', (message) => {
        console.log('Mensagem recebida:', message.toString());
        // Eco da mensagem para teste
        ws.send(message);
    });

    ws.on('error', (error) => {
        console.error('Erro no WebSocket:', error);
    });

    ws.on('close', (code, reason) => {
        console.log(`Conexão fechada. Código: ${code}, Razão: ${reason}`);
    });
});

// Iniciar servidor na porta correta
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`WebSocket pronto para conexões`);
});
