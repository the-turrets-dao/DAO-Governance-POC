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

    const txFunctionCode = fs.readFileSync('./src/txFunctionVote.js', 'utf8')
    const result = await vm.run(txFunctionCode, 'vm.js')({
      proposalAccount: 'GDN5W6EVQ6ODOEFJXCQKP3YV4VYRRUK2B2RHGCANH6KATZWRID2CRMIN',
      optionIndex: 1
    })
  
    console.log(result)
  }

  catch(err) {
    console.error(err)
  }
})()
