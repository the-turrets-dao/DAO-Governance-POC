# POC DAO Governance smart contracts


`> npm install`

`> npm run build`

`if ([webpack-cli] Error: error:0308010C:digital envelope ...) {`
	
	`> export NODE_OPTIONS=--openssl-legacy-provider`

`}`

`> node test-create-proposal.js`

`> node test-close-proposal.js`

`> node test-tally-proposal.js`

`> node test-execute-proposal.js`



## currently only create proposal is working

simple test after `> npm install` + `> npm run build`:
1. generate a new account (public key + secret seed) in stellar laboratory
2. edit test-create-proposal.js - set generated secret seed value for the proposalSecret parameter
3. execute node test-create-proposal.js
4. sign the resulting xdr with: seed of proposal account + seed of source account + 3 turret signers seeds (seeds can be found in test-create-proposal.js as test data)