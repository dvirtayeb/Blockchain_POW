const { MerkleTree } = require('merkletreejs')
const SHA256 = require('crypto-js/sha256')


class Block {

    constructor(timestamp, transactions, previousHash = '') {

        const leaves = [transactions].map(x => SHA256(x))
        this.tree = new MerkleTree(leaves, SHA256)
        const root = this.tree.getRoot().toString('hex')

        this.index = 0
        this.previousHash = previousHash
        this.hash = this.calculateHash()
        this.nonce = 0
        this.transactions = transactions
        this.timestamp = timestamp
    }

    calculateHash(){
        return SHA256(this.index+this.previousHash+this.timestamp +JSON.stringify(this.data)+this.nonce).toString();
    }

    addTransaction(transaction) {
        if(!transaction.from || !transaction.to){
            throw new Error("Transaction must have 'to' and 'from' address")
        }

        if(!transaction.isValid()){
            throw new Error("Cannot add invalid transaction to chain")
        }

        this.transactions.addLeaf(transaction,SHA256)
    }

    get key() {
        return JSON.stringify(this.transactions) + this.index + this.previousHash + this.nonce
    }

    hasValidateTransaction(){
        for(const transaction of this.transactions){
            if(!transaction.isValid()) return false
        }
         const leaf = SHA256('a')
         const proof = tree.getProof(leaf)
        return true
    }

    mineBlock(difficulty){
        while(this.hash.substring(0,difficulty) !== Array(difficulty +1).join("0")){
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log("BLOCK MINED: " + this.hash);
    }

    printMerkleTree(){
        this.tree.print()
    }

    verifyLeaveInTree(index){
        return this.tree.verify(this.tree.getProof(this.leaves[index])), this.leaves[index], this.tree.getRoot()
    }

}

module.exports = Block