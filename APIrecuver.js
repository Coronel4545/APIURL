const express = require('express');
const Web3 = require('web3');
const WebSocket = require('ws');
const app = express();
const port = 3000;

// Configuração do CORS para WebSocket
const wss = new WebSocket.Server({ 
    port: 8080,
    perMessageDeflate: false,
    clientTracking: true,
    maxPayload: 50 * 1024 * 1024 // 50MB
});

// Modificar a configuração do Web3 para ser mais resiliente
const options = {
    timeout: 120000,
    reconnect: {
        auto: true,
        delay: 1000,
        maxAttempts: Infinity,
        onTimeout: true
    },
    clientConfig: {
        keepalive: true,
        keepaliveInterval: 10000,
        maxReceivedFrameSize: 100000000,
        maxReceivedMessageSize: 100000000,
        handshakeTimeout: 120000
    }
};

// Modificar a inicialização do Web3 e provider
let provider;
let web3;

async function inicializarConexao() {
    const endpoints = [
        'wss://bsc-testnet.publicnode.com',
        'wss://bsc-testnet.nodereal.io/ws/v1/',
        'wss://data-seed-prebsc-1-s1.binance.org:8545',
        'wss://data-seed-prebsc-2-s1.binance.org:8545'
    ];
    
    while (true) {
        for (const endpoint of endpoints) {
            try {
                console.log(`Tentando conectar a: ${endpoint}`);
                provider = new Web3.providers.WebsocketProvider(endpoint, options);
                web3 = new Web3(provider);
                
                configurarListenersProvider();
                
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                const isConnected = await web3.eth.net.isListening();
                if (isConnected) {
                    console.log('\n==================================');
                    console.log('🟢 CONEXÃO INICIAL ESTABELECIDA');
                    console.log(`✅ Conectado com sucesso em: ${endpoint}`);
                    console.log(`⏰ ${new Date().toLocaleString()}`);
                    console.log('==================================\n');
                    return true;
                }
            } catch (err) {
                console.log(`❌ Falha ao conectar com ${endpoint}: ${err.message}`);
            }
        }
        console.log('Nenhum endpoint disponível. Tentando novamente em 5 segundos...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

// Endereço e ABI do contrato
const contratoEndereco = '0x03F4BF4398400387b2D0D38bcEb93b16806FA61d';
const contratoABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "spender", 
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256" 
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address", 
                "name": "account",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "sender",
                "type": "address"
            },
            {
                "internalType": "address", 
                "name": "recipient",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "websiteUrl",
                "type": "string"
            }
        ],
        "name": "WebsiteUrlReturned",
        "type": "event"
    }
];

// Instância do contrato
let contrato;

// Armazenar URLs retornadas
let websiteUrls = new Map();

// Modificar a função verificarEventos para melhor tratamento de conexão
async function verificarEventos() {
    while (true) {
        try {
            if (!provider.connected) {
                console.log('Provedor desconectado. Tentando reconexão...');
                await reconectarProvider();
                continue;
            }

            const isListening = await web3.eth.net.isListening().catch(() => false);
            if (!isListening) {
                console.log('Conexão perdida. Iniciando reconexão...');
                await reconectarProvider();
                continue;
            }

            const ultimoBloco = await web3.eth.getBlockNumber();
            
            await contrato.getPastEvents('WebsiteUrlReturned', {
                fromBlock: ultimoBloco - 50,
                toBlock: 'latest'
            }).then(events => {
                events.forEach(event => {
                    const userAddress = event.returnValues.user;
                    const websiteUrl = event.returnValues.websiteUrl;
                    websiteUrls.set(userAddress, websiteUrl);
                    
                    console.log('\n==========================================');
                    console.log('🎉 NOVO EVENTO DETECTADO NA BLOCKCHAIN 🎉');
                    console.log('==========================================');
                    console.log('📝 DETALHES DO EVENTO:');
                    console.log('------------------------------------------');
                    console.log(`🔷 Tipo do Evento: WebsiteUrlReturned`);
                    console.log(`🔷 Bloco: ${event.blockNumber}`);
                    console.log(`🔷 Hash da Transação: ${event.transactionHash}`);
                    console.log(`🔷 Endereço do Contrato: ${event.address}`);
                    console.log('\n📍 DADOS RETORNADOS:');
                    console.log('------------------------------------------');
                    console.log(`👤 Endereço do Usuário: ${userAddress}`);
                    console.log(`🌐 URL do Website: ${websiteUrl}`);
                    console.log('\n⏰ TIMESTAMP:');
                    console.log('------------------------------------------');
                    console.log(`📅 Data: ${new Date().toLocaleDateString()}`);
                    console.log(`⌚ Hora: ${new Date().toLocaleTimeString()}`);
                    console.log('==========================================\n');
                    
                    // Broadcast para todos os clientes WebSocket conectados
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                tipo: 'novaUrl',
                                endereco: userAddress,
                                url: websiteUrl
                            }));
                        }
                    });
                });
            });

            await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (erro) {
            console.error('Erro na verificação:', erro);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Configuração dos listeners do provider
function configurarListenersProvider() {
    provider.on('connect', () => {
        console.log('\n==================================');
        console.log('🟢 CONEXÃO ESTABELECIDA');
        console.log(`⏰ ${new Date().toLocaleString()}`);
        console.log('==================================\n');
        
        // Notificar todos os clientes WebSocket sobre a reconexão
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    tipo: 'statusConexao',
                    status: 'conectado'
                }));
            }
        });
    });

    provider.on('error', async (error) => {
        console.error('Erro no provider:', error);
        await reconectarProvider();
    });

    provider.on('end', async () => {
        console.log('Conexão finalizada. Reconectando...');
        await reconectarProvider();
    });
}

async function reconectarProvider() {
    try {
        console.log('Verificando conexão...');
        
        const endpoints = [
            'wss://bsc-testnet.publicnode.com',
            'wss://bsc-testnet.nodereal.io/ws/v1/',
            'wss://data-seed-prebsc-1-s1.binance.org:8545',
            'wss://data-seed-prebsc-2-s1.binance.org:8545'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`Tentando conectar a: ${endpoint}`);
                
                if (provider.connected) {
                    provider.disconnect();
                }
                
                const novoProvider = new Web3.providers.WebsocketProvider(endpoint, options);
                
                provider = novoProvider;
                configurarListenersProvider();
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                web3.setProvider(novoProvider);
                
                const isConnected = await web3.eth.net.isListening();
                if (isConnected) {
                    console.log('\n==================================');
                    console.log('🔄 RECONEXÃO BEM-SUCEDIDA');
                    console.log('----------------------------------');
                    console.log(`✅ Nova conexão estabelecida em: ${endpoint}`);
                    console.log(`⏰ ${new Date().toLocaleString()}`);
                    console.log('==================================\n');
                    return true;
                }
            } catch (err) {
                console.log(`❌ Falha ao conectar com ${endpoint}: ${err.message}`);
            }
        }
        return false;
    } catch (erro) {
        console.error('Erro na reconexão:', erro);
        return false;
    }
}

// Verificação periódica da conexão
setInterval(async () => {
    try {
        const isConnected = await web3.eth.net.isListening();
        if (!isConnected) {
            console.log('Conexão perdida. Iniciando reconexão...');
            await reconectarProvider();
        }
    } catch (erro) {
        console.log('Erro na verificação de conexão. Iniciando reconexão...');
        await reconectarProvider();
    }
}, 30000);

// Inicialização do servidor
async function iniciarServidor() {
    try {
        const conexaoEstabelecida = await inicializarConexao();
        if (conexaoEstabelecida) {
            contrato = new web3.eth.Contract(contratoABI, contratoEndereco);
            
            // Configurar eventos do WebSocket
            wss.on('connection', (ws, req) => {
                console.log(`Novo cliente conectado - IP: ${req.socket.remoteAddress}`);
                
                // Enviar status inicial da conexão
                ws.send(JSON.stringify({
                    tipo: 'statusConexao',
                    status: provider.connected ? 'conectado' : 'desconectado'
                }));

                ws.on('message', async (mensagem) => {
                    try {
                        const dados = JSON.parse(mensagem);

                        if (dados.tipo === 'processarPagamento') {
                            const resultado = await contrato.methods.processPayment().call({
                                from: dados.enderecoRemetente
                            });

                            const websiteUrl = websiteUrls.get(dados.enderecoRemetente) || resultado;

                            ws.send(JSON.stringify({
                                tipo: 'resultadoPagamento',
                                sucesso: true,
                                websiteUrl: websiteUrl
                            }));
                        } 
                        else if (dados.tipo === 'consultarSaldo') {
                            const saldo = await contrato.methods.balanceOf(dados.endereco).call();
                            
                            ws.send(JSON.stringify({
                                tipo: 'resultadoSaldo',
                                sucesso: true,
                                saldo: web3.utils.fromWei(saldo, 'ether')
                            }));
                        }
                    } catch (erro) {
                        ws.send(JSON.stringify({
                            tipo: 'erro',
                            sucesso: false,
                            mensagem: erro.message
                        }));
                    }
                });

                ws.on('close', () => {
                    console.log('Cliente desconectado');
                });

                ws.on('error', (erro) => {
                    console.error('Erro na conexão WebSocket:', erro);
                });
            });
            
            app.listen(port, () => {
                console.log(`API REST rodando na porta ${port}`);
                console.log(`Servidor WebSocket rodando na porta 8080`);
            });
            
            verificarEventos();
        } else {
            console.error('Não foi possível estabelecer conexão com nenhum endpoint');
            process.exit(1);
        }
    } catch (erro) {
        console.error('Erro ao inicializar a aplicação:', erro);
        process.exit(1);
    }
}

iniciarServidor();
