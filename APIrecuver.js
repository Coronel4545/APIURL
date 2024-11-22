const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const app = express();

// Usar as variáveis de ambiente configuradas no Render
const PORT = process.env.PORT || 3000;

// Configurar CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// Criar servidor HTTP
const server = require('http').createServer(app);

// Remover a configuração separada do WebSocket
const wss = new WebSocket.Server({ 
    server: server, // Anexar ao servidor HTTP
    perMessageDeflate: false,
    clientTracking: true,
    maxPayload: 50 * 1024 * 1024
});

// Eventos do WebSocket
wss.on('connection', (ws, req) => {
    console.log(`Nova conexão WebSocket de: ${req.socket.remoteAddress}`);
    console.log(`Origin: ${req.headers.origin}`);
    
    // Enviar mensagem de confirmação
    ws.send(JSON.stringify({ 
        tipo: 'conexao', 
        status: 'conectado',
        message: 'Conexão WebSocket estabelecida com sucesso'
    }));

    ws.on('message', (message) => {
        console.log('Mensagem recebida:', message.toString());
        try {
            // Eco da mensagem para teste
            ws.send(message);
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    });

    ws.on('error', (error) => {
        console.error('Erro no WebSocket:', error);
    });

    ws.on('close', (code, reason) => {
        console.log(`Conexão fechada. Código: ${code}, Razão: ${reason}`);
    });
});

// Adicionar rota de teste para API HTTP
app.get('/', (req, res) => {
    res.json({ 
        status: 'online',
        message: 'Servidor API está rodando',
        httpPort: PORT
    });
});

// Modificar a inicialização do servidor
server.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Servidor HTTP/WebSocket rodando na porta ${PORT}`);
    console.log('=================================');
});

// Verificar status do WebSocket Server
wss.on('listening', () => {
    console.log(`WebSocket Server está ouvindo na porta ${PORT}`);
});

wss.on('error', (error) => {
    console.error('Erro no servidor WebSocket:', error);
});
