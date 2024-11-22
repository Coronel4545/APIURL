const express = require('express');
const Web3 = require('web3');
const WebSocket = require('ws');
const app = express();
const port = 3000;

// Modificar a configuração do Web3 para ser mais resiliente
const options = {
    timeout: 60000,
    reconnect: {
        auto: true,
        delay: 10000,
        maxAttempts: 10,
        onTimeout: false
    },
    clientConfig: {
        keepalive: true,
        keepaliveInterval: 60000,
        maxReceivedFrameSize: 100000000,
        maxReceivedMessageSize: 100000000
    }
};

// Modificar a inicialização do Web3 e adicionar verificação de conexão
const provider = new Web3.providers.WebsocketProvider('wss://data-seed-prebsc-1-s3.binance.org:8545', options);
const web3 = new Web3(provider);

// Substituir os event listeners do provider
provider.on('connect', () => {
    console.log('\n==================================');
    console.log('🟢 CONEXÃO ESTABELECIDA');
    console.log('----------------------------------');
    console.log('✅ Conectado com sucesso à BSC Testnet');
    console.log(`⏰ ${new Date().toLocaleString()}`);
    console.log('==================================\n');
});

provider.on('error', (error) => {
    console.error('\n==================================');
    console.error('🔴 CONEXÃO PERDIDA');
    console.error('----------------------------------');
    console.error('❌ Erro na conexão WebSocket:', error);
    console.error('==================================\n');
});

provider.on('end', () => {
    console.log('Conexão WebSocket encerrada');
});

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
const contrato = new web3.eth.Contract(contratoABI, contratoEndereco);

// Armazenar URLs retornadas
let websiteUrls = new Map();

// Configurar servidor WebSocket
const wss = new WebSocket.Server({ port: 8080 });

// Modificar a função verificarEventos para melhor tratamento de conexão
async function verificarEventos() {
    try {
        // Verificar conexão de forma mais robusta
        if (!provider.connected) {
            console.log('Provedor não está conectado. Aguardando reconexão...');
            return;
        }

        const isListening = await web3.eth.net.isListening().catch(() => false);
        if (!isListening) {
            console.log('Não está escutando a rede. Aguardando reconexão...');
            return;
        }
        
        const ultimoBloco = await web3.eth.getBlockNumber();
        
        contrato.getPastEvents('WebsiteUrlReturned', {
            fromBlock: ultimoBloco - 5,
            toBlock: 'latest'
        })
        .then(events => {
            events.forEach(event => {
                const userAddress = event.returnValues.user;
                const websiteUrl = event.returnValues.websiteUrl;
                websiteUrls.set(userAddress, websiteUrl);
                
                // Novo formato de log destacado
                console.log('\n==================================');
                console.log('🌐 NOVA URL DETECTADA');
                console.log('----------------------------------');
                console.log(`📍 Endereço: ${userAddress}`);
                console.log(`🔗 URL: ${websiteUrl}`);
                console.log('==================================\n');
                
                // Enviar atualização para todos os clientes conectados
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
        })
        .catch(console.error);
    } catch (erro) {
        console.error('Erro ao verificar eventos:', erro);
        // Aguardar 5 segundos antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}

// Executar verificação a cada 15 segundos
setInterval(verificarEventos, 15000);

// Modificar a função de reconexão manual
async function reconectarProvider() {
    try {
        console.log('Iniciando processo de reconexão...');
        
        const endpoints = [
            'wss://bsc-testnet.publicnode.com',
            'wss://data-seed-prebsc-1-s1.binance.org:8545',
            'wss://data-seed-prebsc-2-s1.binance.org:8545',
            'wss://data-seed-prebsc-1-s2.binance.org:8545',
            'wss://data-seed-prebsc-2-s2.binance.org:8545'
        ];
        
        for (let tentativa = 0; tentativa < 3; tentativa++) {
            for (const endpoint of endpoints) {
                try {
                    console.log(`Tentativa ${tentativa + 1} - Conectando a: ${endpoint}`);
                    
                    const novoProvider = new Web3.providers.WebsocketProvider(endpoint, options);
                    
                    // Aguardar mais tempo para estabelecer a conexão
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    web3.setProvider(novoProvider);
                    
                    const isConnected = await web3.eth.net.isListening();
                    if (isConnected) {
                        console.log(`✅ Conexão estabelecida com ${endpoint}`);
                        return true;
                    }
                } catch (err) {
                    console.log(`❌ Falha ao conectar com ${endpoint}: ${err.message}`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        }
        return false;
    } catch (erro) {
        console.error('Erro na reconexão:', erro);
        return false;
    }
}

// Modificar o intervalo de verificação de conexão
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
}, 30000); // Verificar a cada 30 segundos

// Gerenciar conexões WebSocket
wss.on('connection', (ws) => {
    console.log('Novo cliente conectado');

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
});

app.listen(port, async () => {
    try {
        // Verificar se está conectado à rede
        await web3.eth.net.isListening();
        console.log(`Conectado à rede BSC Testnet`);
        console.log(`Servidor WebSocket rodando na porta 8080`);
        console.log(`API rodando na porta ${port}`);
    } catch (erro) {
        console.error('Erro ao conectar à rede BSC:', erro);
        process.exit(1);
    }
});
