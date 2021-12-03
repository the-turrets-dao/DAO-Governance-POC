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

    const txFunctionCode = fs.readFileSync('./dist/txFunction.js', 'utf8')
    const result = await vm.run(txFunctionCode, 'vm.js')({
      stage: 'create',
      daoToml: 'https://turretsdao.org/.well-known/dao.toml',
      source: 'GBRMA2LOZW5ELTHZYGDUDYGXTBEKUJRMZFX634V4H3LLAEUTECDEGUXG',
      proposalSecret: 'SDSTRGHBCZ3HT62KND6KHIJ2ULRGKPERPVGCOVIJSROV53XNKV32M37T', //GBHSPRTBR53Y2B7APJWUJ3RDA2YZGEX2CEDNMGAJSPIFGDKGOMNM7WIN
      turretSigners:'GB7SURLDZHTJD4UQK4VCHLNQFZWI2GGCUK4GPXIBWABMD4XARZZCEAYX, GBC3NPRTSNRIMKRDRELY6JLD3OKNI2JMCRLTLPLOAPEPQQSECDKYSB2M, GAVZVAMWXPNZFRHO7W4UANW5RJIPWBORBKDDFIG6VVVIPZOGCTV6SZJ2, GDAGXNEUMYVMD7ZNYMCRX4UKGRB54LQDTCOWKENLQ6Y3PYDOCEU55LH4, GCC7Z6JOOT4NRU47G5EIW664ZMFFG4YXWE6JBVJBZWDW2ECIXS5YD73M',
      IpfsProposalAddr: 'https://test.data.io/proposal1223'
    })
  
    console.log(result)
  }

  catch(err) {
    console.error(err)
  }
})()
