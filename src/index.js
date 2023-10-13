/**
 * BotFi (https://botfi.app)
 * @author BotFi <hello@botfi.app>
 * @license MIT
 */ 

import { getAddress, Contract as ethersContract, Fragment } from 'ethers'

export default class {

     /**
      * get proxy implementation address from storage
      * @param {*} address 
      * @param {*} slot 
      * @returns 
      */
     async getProxyImplFromStorage(address, slot) {
        ///let slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
        let data = await this.provider.getStorageAt(address, slot);
        return this.parseAddressFromStorage(data)
    }
    

    encodeSig(sig) {
        let frag = new Fragment()
        return this.web3Http.eth.abi.encodeFunctionSignature(sig)
    }

    /**
     * parse the impl address
     * @param {*} addrStr 
     * @returns 
     */
    parseAddressFromStorage(addrStr)  {

        let buf = Buffer.from(addrStr.replace(/^0x/, ''), 'hex');
        
        if (!buf.subarray(0, 12).equals(Buffer.alloc(12, 0))) {
            return undefined;
        }
        const address = '0x' + buf.toString('hex', 12, 32); // grab the last 20 bytes

        return getAddress(address);
    }

    /**
     * getBeacon Proxy Implementation address
     * @param {*} contractAddress 
     * @returns 
     */
    async getBeaconProxyImpl(contractAddress) {

        contractAddress = contractAddress.trim()
        
        contractAddress = getAddress(contractAddress)
    
        let contract = ethersContract(contractAddress, proxyBeaconImplAbi, this.provider)

        let addr = ""

        try {
            addr = await contract.implementation().call() 
            //console.log("addr===>", addr)
        } catch (e) {
            Utils.logError("Wallet#getBeaconProxyImpl:", contractAddress)
        }

        return addr
    }

    /**
     * get a contract's code
     * @param {*} contractAddress 
     * @param {*} proxyCheck 
     * @returns 
     */
    async getCode(contractAddress, proxyCheck = true) {
         
        if(!this.provider){
            return this.notConnectedError()
        }

         
        let code = await this.provider.getCode(contractAddress);

        if(code == '0x') return Status.error("Address not a contract")

        let proxySlots = {
           "tranparent": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
            "beacon": "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
            "eip-1822": "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7"
        }

        let implAddress;

        let tProxySlot = proxySlots["tranparent"]
            
        if (code.includes(tProxySlot.substring(2))) {
            implAddress = await this.getProxyImplFromStorage(
                            contractAddress,
                            tProxySlot
                        )
        } 

        let bProxySlot = proxySlots["beacon"]

        
        if ((!implAddress || implAddress == Utils.zeroAddress) &&
            code.includes(bProxySlot.substring(2))
        ) {
            let beaconAddr = await this.getProxyImplFromStorage(
                                contractAddress,
                                bProxySlot
            )
            
            implAddress = await this.getBeaconProxyImpl(beaconAddr)
        }
      
        //console.log("implAddress===>", "===>", implAddress)
            
        if (implAddress &&
            ethersUtils.isAddress(implAddress) &&
            implAddress != Utils.zeroAddress
        ) {
            code = await this.provider.getCode(implAddress);
        }
        
        return Status.successData(code)
    }

    /**
     * check if a contract code contains a method by signature
     * @param {*} signature 
     * @param {*} code 
     * @returns 
     */
    async hasMethod(signature, code) {
        const hash = this.encodeSig(signature);
        return code.includes(hash.substring(2));
    }

    /**
     * check if th given contract address or code is the required token standard
     * @param {*} standard 
     * @param {*} contractAddress 
     * @param {*} code 
     * @returns 
     */
    async isTokenStandard(standard, contractAddress, code) {

        let standardMethods = {
            
            "erc721": [
                "ownerOf(uint256)",
                "balanceOf(address)"
            ],

            "erc20": [
                "totalSupply()",
                "balanceOf(address)"
            ],

            "erc1155": [
                "balanceOfBatch(address[],uint256[])",
                "setApprovalForAll(address,bool)"
            ],

        }

        if(!(standard in standardMethods)) return false;

        let methodsArray = standardMethods[standard]

        //console.log("this.web3Http", this.web3Http)
        if(!code || code.length == ""){
            code = await this.getCode(contractAddress)
        }
            
        for (let method of methodsArray) {
            let hasMethod = await this.hasMethod(method, code)
                if (!hasMethod) {
                return false;
            }
        }

        return true;
    }
    

}