let EC = require('elliptic').ec
let ec = new EC('secp256k1')
let Block = require('./block')
let Transaction = require('./transaction')
const { Blockchain, supaChain } = require('./blockchain')
const fs = require('fs')

const topology = require('fully-connected-topology')
const { stdin, exit, argv } = process
const { log } = console
const { me, peers } = extractPeersAndMyPort(argv)
const sockets = {}

log('---------------------')
log('Welcome to p2p chat!')
log('me - ', me)
log('peers - ', peers)
log('connecting to peers...')

const myIp = toLocalIp(me)
const peerIps = getPeerIps(peers)
const peersTxns = setPeersTxMap()
const approvedTxns = setEmptyTxnsMap()
const deniedTxns = setEmptyTxnsMap()
const receivedTxns = setEmptyTxnsMap()
const peersKeys = setPeersKeyMap()
if (me === '4000') hardCodedActions(peersKeys)

let fixer = true
//connect to peers
topology(myIp, peerIps).on('connection', (socket, peerIp) => {
    const peerPort = extractPortFromIp(peerIp)
    log('connected to peer - ', peerPort)

    const myKey = ec.keyFromPrivate(me)
    const myAddress = myKey.getPublic('hex')

    sockets[peerPort] = socket
    stdin.on('data', data => { // input
        const message = data.toString().trim()
        const prefix = message.split(" ")[0]
        if (me === '4000' && fixer) { // WRITE on 4000 - the MINER
            fixer = false
            minerSwitch(prefix, message, peersKeys, myAddress, myKey, peerPort)

        } else { // WRITE on OTHER USERS
            fixer = true
            switch (prefix) {
                case 'exit':
                    exitNow()
                    break;
                default:
                    break;
            }

        }
        socket.write(message)
        

    })

    socket.on('data', data => {
        const message = data.toString().trim()
        const prefix = message.split(" ")[0]
        if (me === '4000') { // PRINT to 4000 - THE MINER
            switch (prefix) {
                case 'send':
                    let str = sendTxTroughMiner(peersKeys, peerPort, message.split(" ")[1], message.split(" ")[2], myAddress)
                    sendMessageToPeer(str, peerPort)
                    break;
                case 'request':
                    let fromPeer = message.split(" ")[1]
                    let txAndPeer = requestThroughMiner(peersKeys, peerPort, fromPeer, message, myAddress)
                    let str2 = 'A transaction was sent to you from:' + peerPort + ':\n Tx-Details: ' + txAndPeer.tx.toString() + '\nwrite "approve + YourPort + y/n" to answer the request'
                    sendMessageToPeer(str2, fromPeer)
                    peersTxns.set(txAndPeer.peer, txAndPeer.tx) // send TX to peer throughout peerTx map
                    break;
                case 'approve':
                    let tempPort = message.split(" ")[1]
                    let key = peersKeys.get(tempPort)
                    pullAndSignTx(message, key, tempPort)
                case 'mine':
                    break;
                case 'foreverMine':
                    break;
                default:
                    minerSwitch(prefix, message, peersKeys, myAddress, myKey, peerPort)
                    break;
            }
        } else { // PRINT to OTHER USERS
            switch (prefix) {
                case "mine":
                    break;
                case 'foreverMine':
                    break;
                case "balance":
                    break;
                case "send":
                    break;
                case "approve":
                    break;
                case "showAllBalance":
                    break;
                case 'showTokens':
                    break;
                case 'showBurnt':
                    break;
                case 'showMined':
                    break;
                case 'check':
                    break;
                default:
                    log(peerPort + ":", message)
                    break;
            }
        }
    })
})
function exitNow() {
    log('Bye bye')
    exit(0)
}

function minerSwitch(prefix, message, peersKeys, myAddress, myKey, peerPort) {
    switch (prefix) {
        case 'exit':
            exitNow()
            break;
        case 'mine':
            mine(myAddress)
            break;
        case 'foreverMine':  // mine a block every 5-10 sec 6 times (50 sec total +-)
            foreverMine(myAddress)
            break;
        case 'balance':
            balanceOf(message, peersKeys, myAddress)
            break;

        case 'send':
            if (sendTx(message, peersKeys, myAddress, myKey))
                log("Transaction sent successfuly")
            break;
        case 'request':
            let txAndPeer = requestTx(message, peersKeys, myAddress)
            let str = 'A transaction was sent to you from:' + me + ':\n Tx-Details: ' + txAndPeer.tx.toString() + '\nwrite "approve + YourPort + y/n" to answer the request'
            sendMessageToPeer(str, peerPort)
            peersTxns.set(txAndPeer.peer, txAndPeer.tx) // send TX to peer throughout peerTx map
            break;
        case 'approve':
            let tempPort = message.split(" ")[1]
            let key = peersKeys.get(tempPort)
            pullAndSignTx(message, key, tempPort)
            break;
        case 'showTokens':
            showTotalTokens()
            break;
        case 'showBurnt':
            showBurntTokens()
            break;
        case 'showMined':
            showMinedTokens()
            break;
        case 'showAllBalance':
            showAllBalance(myAddress, peersKeys)
            break;
        case 'print':
            index = message.split(" ")[1]
            supaChain.printBlock(index)
            break;
        case 'txnsOf':
            txnsPort = message.split(" ")[1]
            console.log("Received Transactions for "+txnsPort)
            console.log(receivedTxns.get(txnsPort))
            console.log("Sent Transactions that were approved for "+txnsPort)
            console.log(approvedTxns.get(txnsPort))
            console.log("Sent Transactions that were denied for "+txnsPort)
            console.log(deniedTxns.get(txnsPort))
            break;
        default:
            break;
    }
}

async function foreverMine(myAddress) {
    for (let index = 5; index <= 10; index++) {
        await sleep(1000 * index);
        mine(myAddress)
    }
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
function sendMessageToPeer(message, peerPort) {
    if (sockets[peerPort]) { //message to specific peer
        sockets[peerPort].write(message)
    }
    if (peerPort === me) {
        console.log(message)
    }
}
//extract ports from process arguments, {me: first_port, peers: rest... }
function extractPeersAndMyPort() {
    return {
        me: argv[2],
        peers: argv.slice(3, argv.length)
    }
}

//'4000' -> '127.0.0.1:4000'
function toLocalIp(port) {
    return `127.0.0.1:${port}`
}

//['4000', '4001'] -> ['127.0.0.1:4000', '127.0.0.1:4001']
function getPeerIps(peers) {
    return peers.map(peer => toLocalIp(peer))
}

//'hello' -> 'myPort:hello'
function formatMessage(message) {
    return `${me}>${message}`
}

//'127.0.0.1:4000' -> '4000'
function extractPortFromIp(peer) {
    return peer.toString().slice(peer.length - 4, peer.length);
}

//'4000>hello' -> '4000'
function extractReceiverPeer(message) {
    return message.slice(0, 4);
}

//'4000>hello' -> 'hello'
function extractMessageToSpecificPeer(message) {
    return message.slice(5, message.length);
}
function setPeersKeyMap() {
    let peersKeys = new Map();
    for (let i = 0; i < peers.length; i++) {
        peersKeys.set(peers[i], ec.keyFromPrivate(peers[i]))
    }
    peersKeys.set(me, ec.keyFromPrivate(me))
    return peersKeys
}

function setPeersTxMap() { // pending Transactions
    let peersTx = new Map()
    for (let i = 0; i < peers.length; i++) {
        peersTx.set(peers[i], Transaction)
    }
    peersTx.set(me, Transaction)
    return peersTx
}
function setEmptyTxnsMap() {
    let txns = new Map()
    for (let i = 0; i < peers.length; i++) {
        txns.set(peers[i], [])
    }
    txns.set(me, [])
    return txns
}

function mine(myWalletAddress) {
    if (me === "4000") {
        supaChain.minePendingTransactions(myWalletAddress);
    } else {
        log("This wallet cannot mine!")
    }

}

function balanceOf(message, peersKeys, myAddress) {
    let ofPeer = message.split(" ")[1]
    let balance = supaChain.getBalanceOfAddress(peersKeys.get(ofPeer).getPublic('hex'))
    log("The balance of peer %s : %d", ofPeer, balance)
}

function sendTx(message, peersKeys, myAddress, myKey) {
    let str = message.split(" ")
    let toPeer = str[1]
    if (toPeer === me) return;
    let amount = parseInt(str[2])
    tx = new Transaction(myAddress, peersKeys.get(toPeer).getPublic('hex'), amount)
    tx.signTransaction(myKey)
    if (supaChain.addTransactionWithFee(tx)) {
        approvedTxns.get(me).push(tx)
        receivedTxns.get(toPeer).push(tx)
        return true
    }
    return false
}
function sendTxTroughMiner(peersKeys, from, to, amount, myAddress) {
    if (from === to) return;
    tx = new Transaction(peersKeys.get(from).getPublic('hex'), peersKeys.get(to).getPublic('hex'), amount)
    tx.signTransaction(peersKeys.get(from))
    if (supaChain.addTransactionWithFee(tx)) {
        approvedTxns.get(from).push(tx)
        receivedTxns.get(to).push(tx)
        return "Transaction sent successfuly"
    }
    else {
        deniedTxns.get(from).push(tx)
        return "Transaction didnt go through"
    }

}

function requestTx(message, peersKeys, myAddress) {
    let str = message.split(" ")
    let fromPeer = str[1]
    let amount = parseInt(str[2])
    tx = new Transaction(peersKeys.get(fromPeer).getPublic('hex'), myAddress, amount)
    return { tx: tx, peer: fromPeer }
}
function requestThroughMiner(peersKeys, to, from, message, myAddress) {
    let amount = parseInt(message.split(" ")[2])
    tx = new Transaction(peersKeys.get(from).getPublic('hex'), peersKeys.get(to).getPublic('hex'), amount)
    return { tx: tx, peer: from }
}


function pullAndSignTx(message, key, port) {
    let yesOrNo = message.split(" ")[2]
    if (yesOrNo === 'y') {
        let tx = peersTxns.get(port)
        tx.signTransaction(key)
        if (supaChain.addTransactionWithFee(tx)) {
            console.log("Transaction Sent Succefully")
            approvedTxns.get(port).push(tx)
            peersTxns.set(port, null)
        }
    } else if (yesOrNo === 'n') {
        console.log("You disapproved the transaction!")
        deniedTxns.get(port).push(tx)
        peersTxns.set(port, null)
    } else {
        console.log("Wrong input, nothing happend")
    }

}

function showAllBalance(myAddress, peersKeys) {
    let myBalance = supaChain.getBalanceOfAddress(myAddress)
    log("My balance: %d", myBalance)
    for (let i = 0; i < peers.length; i++) {
        let balance = supaChain.getBalanceOfAddress(peersKeys.get(peers[i]).getPublic('hex'))
        log("Balance of %s : %d", peers[i], balance)
    }
}


function showBurntTokens() {
    supaChain.showBurntTokens()
}

function showMinedTokens() {
    supaChain.showMinedTokens()
}

function showTotalTokens() {
    supaChain.showBlockChainTotalTokens()
}

function hardCodedActions(peersKeys) {

    myKey = peersKeys.get('4000')
    myAddress = myKey.getPublic('hex')

    mine(myAddress) // initial mine gives 300 tokens
    sendTx('send 4001 100', peersKeys, myAddress, myKey)
    sendTx('send 4002 100', peersKeys, myAddress, myKey)
    mine(myAddress)
    console.log("check if this address is part of the data set (By Bloom filter): ", supaChain.bfilter.has(myAddress))
    for (let i = 0; i < 15; i++) {
        sendTx('send 4001 1', peersKeys, myAddress, myKey)
        sendTx('send 4002 1', peersKeys, myAddress, myKey)
    }

    //write mempool into text.log
    fs.writeFileSync('text.log', "Transactions in the MemPool: \n")
    supaChain.memPool.forEach(transaction => {
        try {
            fs.appendFileSync('text.log', "\n" + transaction)
        } catch (err) {
            console.error(err)
        }
    });


    
}