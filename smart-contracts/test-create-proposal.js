const { NodeVM } = require('vm2')
const fs = require('fs')

;(async () => {
  try {
    const HORIZON_URL = 'https://horizon-testnet.stellar.org'
    const STELLAR_NETWORK = 'TESTNET'

    const vm = new NodeVM({
      // console: 'off',
      eval: false,
      wasm: false,
      strict: true,
      fixAsync: true,
      sandbox: {
        HORIZON_URL,
        STELLAR_NETWORK,
        window: {}
      },
      require: {
        builtin: ['util'],
        external: {
          modules: ['bignumber.js', 'node-fetch', 'stellar-sdk', 'lodash']
        },
        context: 'host',
      }
    })

    const txFunctionCode = fs.readFileSync('./dist/txFunctionCreateProposal.js', 'utf8')
    const result = await vm.run(txFunctionCode, 'vm.js')({
      daoToml: 'https://turretsdao.org/.well-known/dao.toml',
      source: 'GCTPPLZNI6YIQCOTVVWR7CJ5PYG3WO3ROPD5OP5JECDNPJR4NJM3LDLC',
      proposalSecret: 'SDJ57PA4Y3BUCBQCTTV7VCNCD3ABBIICQEPPZ5NYWMBFCKCDYAEEN2H7',
      tallySecret: 'SCSCDHUMFXEVJ3QJOOXIRXPOERD62A2AG5L75J3AGLAUNBTES6B3FPEJ',
      tallyContractSigners:'GB7SURLDZHTJD4UQK4VCHLNQFZWI2GGCUK4GPXIBWABMD4XARZZCEAYX, GAVZVAMWXPNZFRHO7W4UANW5RJIPWBORBKDDFIG6VVVIPZOGCTV6SZJ2, GDAGXNEUMYVMD7ZNYMCRX4UKGRB54LQDTCOWKENLQ6Y3PYDOCEU55LH4',
      proposalContractSigners:'GAZQKLAQZ3CWPCTLLHQH3RRBUJQKXNCYRWXQET6WBEOWZ5EKB3TXQ3C2, GA2YJLQ2J2OQSTTPUUO7UPW2ZFM5FGIK43BV3NMBJQUFXIMCZZCJNJVJ, GAMTRSVMSFW76B475VXFEUGFIHFNPF6JFZAXNYUOI5W2WZUURMVB4KHK',
      IpfsProposalAddr: 'https://test.data.io/proposal1223'
    })
  
    console.log(result)
  }

  catch(err) {
    console.error(err)
  }
})()
