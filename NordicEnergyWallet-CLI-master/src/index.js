'use strict';

import CorrentlyWallet from 'correntlywallet';
const storage = require("node-persist");

let cwcli = async function() {
  await storage.init();
  let privateKey = await storage.getItem("privateKey");
  let wallet = null;
  if( privateKey != null) {
    wallet = new CorrentlyWallet.Wallet(privateKey,CorrentlyWallet.getDefaultProvider());
  } else {
    wallet = CorrentlyWallet.Wallet.createRandom();
    await storage.setItem("privateKey",wallet.privateKey);
    wallet = new CorrentlyWallet.Wallet(wallet.privateKey,CorrentlyWallet.getDefaultProvider());
  }

  const vorpal = require('vorpal')();
  let interactive = vorpal.parse(process.argv, {use: 'minimist'})._ === undefined;

  vorpal
        .command('address', 'prints blockchain address of this wallet')
        .action(function(args, callback) {
          this.log(wallet.address);
          callback();
        });

  vorpal
        .command('market', 'prints market overview')
        .action(function(args, callback) {
          CorrentlyWallet.Market().then(function(market) {
            vorpal.log('ID\tCorrently\tName');
            for(let i=0;i<market.length;i++) {
                vorpal.log('#'+i+':\t'+market[i].cori+"\t\t"+market[i].title);
            }
            callback();
          });
        });
  vorpal
        .command('buy [id] [quantity]', 'Buy via Over-The-Counter (OTC) given number of generation capacity')
        .action(function(args, callback) {
          let parent=this;
          CorrentlyWallet.Market().then(function(market) {
            let id=args.id;
            if(id==null) {
              for(let i=0;i<market.length;i++) {
                  vorpal.log('#'+i+':\t'+market[i].cori+"\t\t"+market[i].title);
              }
              parent.prompt({ type:'input',
                              name:'id',
                              message:'OTC Offer ID to buy? '
                            },function(result) {
                                id=result.id;
                                parent.prompt({ type:'input',
                                                name:'qty',
                                                message:'Amount to buy? '
                                              },function(result) {
                                                let qty=result.qty;
                                                if(typeof id == "string") id=id.substr(1)*1;
                                                wallet.buyCapacity(market[id], qty).then(function(transaction) {
                                                    vorpal.log("send.");
                                                    vorpal.log("type transactions to see all transactions");
                                                    callback();
                                                });
                                              });
                            });
            } else {
                let qty=args.quantity;
                if(qty==null) qty=1;
                if(typeof id == "string") id=id.substr(1)*1;
                  wallet.buyCapacity(market[id], qty).then(function(transaction) {
                      vorpal.log("send.");
                      vorpal.log("type transactions to see all transactions");
                      callback();
                  });
            }
          });
        });
  vorpal
        .command('account [EthereumAddress]', 'print account information (address to be encoded as URI like homestead:0x1234)')
        .option('-o, --output <filename>','Output to JSON encoded file. Use - to print to screen')
        .action(function(args, callback) {          
          let address=wallet.address;
          if(args.EthereumAddress != null) {
            address=args.EthereumAddress.substr(args.EthereumAddress.indexOf(":")+1);
          }
          CorrentlyWallet.CorrentlyAccount(address).then(function(_account) {
            if((typeof args.options.output != "undefined")&&(args.options.output != null)) {
                _account.available = _account.totalSupply-_account.convertedSupply;
                _account.imbalance = _account.generation-_account.meteredconsumption;
                if(args.options.output=="-") {
                  vorpal.log(JSON.stringify(_account));
                } else {
                  const fs = require("fs");
                  fs.writeFileSync(args.options.output,JSON.stringify(_account));
                }
                callback();
            } else {
                vorpal.log("Ethereum Address:\t\t"+address);
                vorpal.log("Yearly Demand:\t\t\t"+_account.ja+" kWh");
                vorpal.log("Total Collected:\t\t"+_account.totalSupply+" Corrently");
                vorpal.log("Converted:\t\t\t"+_account.convertedSupply+" Corrently");
                vorpal.log("Available:\t\t\t"+(_account.totalSupply-_account.convertedSupply)+" Corrently");
                vorpal.log("Valid from:\t\t\t"+new Date(_account.created).toLocaleString()+"");
                vorpal.log("Nominal Generation:\t\t"+_account.nominalCori+" kWh/year");
                _account.getCoriEquity().then(function(x) {
                  vorpal.log("Confirmed Generation Equity:\t"+x+" kWh/year");
                  vorpal.log("Metered Generation:\t\t"+_account.generation+" kWh");
                  vorpal.log("Metered Consumption:\t\t"+_account.meteredconsumption+" kWh");
                  vorpal.log("./. Imbalance:\t\t\t"+(_account.generation-_account.meteredconsumption)+" kWh");
                  if(address==wallet.address) {
                    wallet.getBalance().then(function(balance) {
                      vorpal.log("ETH Balance:\t\t\t"+CorrentlyWallet.utils.formatEther(balance)+" ETH");
                      callback();
                    });
                  } else {
                    callback();
                  }
                })
            }
          });
        });
  vorpal
        .command('deletePending <id>', 'delete pending transaction')
        .action(function(args, callback) {
            let id=args.id;
            let qty=args.quantity;
            if(typeof id == "string") id=id.substr(1)*1;
            wallet.deletePending(id).then(function(transaction) {
                  vorpal.log("send.");
                  vorpal.log("\ttype transactions to see all transactions");
                  callback();
            });
        });
  vorpal
        .command('linkDemand <EthereumAddress>', 'Source of yearly consumption (sample: homestead:0x12345678901234ab1234)')
        .action(function(args, callback) {
            let id=args.EthereumAddress.substr(args.EthereumAddress.indexOf(":")+1);
            wallet.linkDemand(id).then(function(transaction) {
                  vorpal.log("send.");
                  vorpal.log("\ttype account to see updated yearly energy demand");
                  callback();
            });
        });
  vorpal
        .command('transferCapacity <EthereumAddress> <amount>', 'Source of yearly consumption (sample: homestead:0x12345678901234ab1234 5)')
        .action(function(args, callback) {
            let id=args.EthereumAddress.substr(args.EthereumAddress.indexOf(":")+1);
            wallet.transferCapacity(id,Math.round(args.amount*1)).then(function(transaction) {
                  vorpal.log("send.");
                  vorpal.log("\ttype account to see updated yearly energy demand");
                  callback();
            });
        });
  vorpal
        .command('transactions', 'See all transactions of this wallet')
        .action(function(args, callback) {
          CorrentlyWallet.CorrentlyAccount(wallet.address).then(function(_account) {
            vorpal.log("ID\tDate/Time \t\tkWh/year \tGeneration Facility (asset)");
            for(let i=0;i<_account.txs.length;i++) {
              let t=_account.txs[i];
              vorpal.log(t.nonce+"\t"+new Date(t.timeStamp).toLocaleString()+"\t"+t.cori+"\t\t"+t.asset);
            }
            callback();
          });
        });

  vorpal
        .command('FORGET', 'DANGERZONE! This will remove ownership for GDPR compliance')
        .action(function(args, callback) {
            wallet.deleteData(wallet.address).then(function(transaction) {
                vorpal.log("ACCOUNT DELETED!");
                callback();
            });
          });
  vorpal
        .command('energy', 'Generated energy by aquired assets')
        .action(function(args, callback) {
          CorrentlyWallet.CorrentlyAccount(wallet.address).then(function(_account) {
            vorpal.log(_account.generation+" kWh");
            callback();
          });
        });
  vorpal.log("CorrentlyWallet - "+wallet.address);
  vorpal.log("------------------------------------------------------------------------------");


  global.interactive=interactive;
  	if (interactive) {
      vorpal.log("Usage hints: ");
      vorpal.log(" corrently> market \t\t- see current OTC market");
      vorpal.log(" corrently> buy #1 2 \t\t- buy from ID #1 a capacity of 2kWh/yr");
      vorpal.log(" corrently> energy \t\t- retrieve generated electricity");
      vorpal.log(" corrently> transactions \t- see transactions");
      vorpal.log("------------------------------------------------------------------------------");
  		vorpal
  			.delimiter('corrently>')
  			.show();
  	} else {
  		// argv is mutated by the first call to parse.
  		process.argv.unshift('');
  		process.argv.unshift('');
  		vorpal
  			.delimiter('')
  			.parse(process.argv);
  	}
};

cwcli();
