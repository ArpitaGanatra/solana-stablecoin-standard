/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sss_core.json`.
 */
export type SssCore = {
  address: "4H5fRECQ4HLMGhabHEkzAya34pVZn8WBMqUw5TyhMAvb";
  metadata: {
    name: "sssCore";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Created with Anchor";
  };
  instructions: [
    {
      name: "acceptAuthority";
      discriminator: [107, 86, 198, 91, 33, 12, 107, 160];
      accounts: [
        {
          name: "newAuthority";
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "addMinter";
      discriminator: [75, 86, 218, 40, 219, 6, 141, 29];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "minterInfo";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 105, 110, 116, 101, 114, 95, 105, 110, 102, 111];
              },
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "arg";
                path: "minterAddress";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "minterAddress";
          type: "pubkey";
        },
        {
          name: "quota";
          type: "u64";
        },
        {
          name: "unlimited";
          type: "bool";
        }
      ];
    },
    {
      name: "blacklistAddress";
      discriminator: [53, 99, 149, 238, 109, 245, 181, 198];
      accounts: [
        {
          name: "blacklister";
          writable: true;
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "blacklistEntry";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116,
                  95,
                  115,
                  101,
                  101,
                  100
                ];
              },
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "arg";
                path: "address";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [
        {
          name: "address";
          type: "pubkey";
        }
      ];
    },
    {
      name: "burnTokens";
      discriminator: [76, 15, 51, 254, 229, 215, 121, 66];
      accounts: [
        {
          name: "burner";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "cancelAuthorityTransfer";
      discriminator: [94, 131, 125, 184, 183, 24, 125, 229];
      accounts: [
        {
          name: "authority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "freezeAccount";
      discriminator: [253, 75, 82, 133, 167, 238, 43, 130];
      accounts: [
        {
          name: "freezer";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        }
      ];
      args: [];
    },
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
        },
        {
          name: "mint";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "mint";
              }
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "initializeParams";
            };
          };
        }
      ];
    },
    {
      name: "mintTokens";
      discriminator: [59, 132, 24, 246, 122, 39, 8, 243];
      accounts: [
        {
          name: "minter";
          signer: true;
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "minterInfo";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 105, 110, 116, 101, 114, 95, 105, 110, 102, 111];
              },
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "account";
                path: "minter";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "pause";
      discriminator: [211, 22, 221, 251, 74, 121, 193, 47];
      accounts: [
        {
          name: "pauser";
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "removeFromBlacklist";
      discriminator: [47, 105, 20, 10, 165, 168, 203, 219];
      accounts: [
        {
          name: "blacklister";
          writable: true;
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "blacklistEntry";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  98,
                  108,
                  97,
                  99,
                  107,
                  108,
                  105,
                  115,
                  116,
                  95,
                  115,
                  101,
                  101,
                  100
                ];
              },
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "arg";
                path: "address";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "address";
          type: "pubkey";
        }
      ];
    },
    {
      name: "removeMinter";
      discriminator: [241, 69, 84, 16, 164, 232, 131, 79];
      accounts: [
        {
          name: "authority";
          writable: true;
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
          relations: ["minterInfo"];
        },
        {
          name: "minterInfo";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 105, 110, 116, 101, 114, 95, 105, 110, 102, 111];
              },
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "arg";
                path: "minterAddress";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "minterAddress";
          type: "pubkey";
        }
      ];
    },
    {
      name: "seize";
      discriminator: [129, 159, 143, 31, 161, 224, 241, 84];
      accounts: [
        {
          name: "seizer";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "from";
          writable: true;
        },
        {
          name: "treasury";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "thawAccount";
      discriminator: [115, 152, 79, 213, 213, 169, 184, 35];
      accounts: [
        {
          name: "freezer";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        },
        {
          name: "mint";
          writable: true;
        },
        {
          name: "tokenAccount";
          writable: true;
        },
        {
          name: "tokenProgram";
          address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
        }
      ];
      args: [];
    },
    {
      name: "transferAuthority";
      discriminator: [48, 169, 76, 72, 229, 180, 55, 161];
      accounts: [
        {
          name: "authority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "newAuthority";
          type: "pubkey";
        }
      ];
    },
    {
      name: "unpause";
      discriminator: [169, 144, 4, 38, 10, 141, 188, 255];
      accounts: [
        {
          name: "pauser";
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "updateMinter";
      discriminator: [164, 129, 164, 88, 75, 29, 91, 38];
      accounts: [
        {
          name: "authority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
          relations: ["minterInfo"];
        },
        {
          name: "minterInfo";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 105, 110, 116, 101, 114, 95, 105, 110, 102, 111];
              },
              {
                kind: "account";
                path: "config";
              },
              {
                kind: "arg";
                path: "minterAddress";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "minterAddress";
          type: "pubkey";
        },
        {
          name: "quota";
          type: "u64";
        },
        {
          name: "active";
          type: "bool";
        },
        {
          name: "unlimited";
          type: "bool";
        }
      ];
    },
    {
      name: "updateRoles";
      discriminator: [220, 152, 205, 233, 177, 123, 219, 125];
      accounts: [
        {
          name: "authority";
          signer: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  115,
                  116,
                  97,
                  98,
                  108,
                  101,
                  99,
                  111,
                  105,
                  110,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ];
              },
              {
                kind: "account";
                path: "config.mint";
                account: "stablecoinConfig";
              }
            ];
          };
        }
      ];
      args: [
        {
          name: "params";
          type: {
            defined: {
              name: "updateRolesParams";
            };
          };
        }
      ];
    }
  ];
  accounts: [
    {
      name: "blacklistEntry";
      discriminator: [218, 179, 231, 40, 141, 25, 168, 189];
    },
    {
      name: "minterInfo";
      discriminator: [158, 4, 176, 199, 251, 15, 209, 131];
    },
    {
      name: "stablecoinConfig";
      discriminator: [127, 25, 244, 213, 1, 192, 101, 6];
    }
  ];
  events: [
    {
      name: "accountFrozen";
      discriminator: [221, 214, 59, 29, 246, 50, 119, 206];
    },
    {
      name: "accountThawed";
      discriminator: [49, 63, 73, 105, 129, 190, 40, 119];
    },
    {
      name: "addedToBlacklist";
      discriminator: [3, 196, 78, 136, 111, 197, 188, 114];
    },
    {
      name: "authorityTransferAccepted";
      discriminator: [149, 165, 140, 221, 104, 203, 239, 121];
    },
    {
      name: "authorityTransferCancelled";
      discriminator: [31, 228, 187, 148, 20, 99, 237, 48];
    },
    {
      name: "authorityTransferProposed";
      discriminator: [103, 244, 27, 116, 177, 4, 100, 119];
    },
    {
      name: "initialized";
      discriminator: [208, 213, 115, 98, 115, 82, 201, 209];
    },
    {
      name: "minterAdded";
      discriminator: [140, 185, 72, 194, 3, 99, 122, 172];
    },
    {
      name: "minterRemoved";
      discriminator: [157, 21, 47, 29, 4, 195, 30, 77];
    },
    {
      name: "paused";
      discriminator: [172, 248, 5, 253, 49, 255, 255, 232];
    },
    {
      name: "removedFromBlacklist";
      discriminator: [55, 136, 25, 65, 199, 36, 146, 33];
    },
    {
      name: "rolesUpdated";
      discriminator: [81, 37, 176, 32, 30, 204, 251, 246];
    },
    {
      name: "tokensBurned";
      discriminator: [230, 255, 34, 113, 226, 53, 227, 9];
    },
    {
      name: "tokensMinted";
      discriminator: [207, 212, 128, 194, 175, 54, 64, 24];
    },
    {
      name: "tokensSeized";
      discriminator: [51, 129, 131, 114, 206, 234, 140, 122];
    },
    {
      name: "unpaused";
      discriminator: [156, 150, 47, 174, 120, 216, 93, 117];
    },
    {
      name: "updatedMinter";
      discriminator: [64, 138, 203, 97, 222, 172, 78, 102];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorized";
      msg: "unauthorized";
    },
    {
      code: 6001;
      name: "paused";
      msg: "Operations on this mint are paused";
    },
    {
      code: 6002;
      name: "minterQuotaExceeded";
      msg: "Minter quota exceeded";
    },
    {
      code: 6003;
      name: "minterNotActive";
      msg: "Minter is not active";
    },
    {
      code: 6004;
      name: "invalidAuthority";
      msg: "Invalid authority";
    },
    {
      code: 6005;
      name: "nameTooLong";
      msg: "Name too long";
    },
    {
      code: 6006;
      name: "symbolTooLong";
      msg: "Symbol too long";
    },
    {
      code: 6007;
      name: "uriTooLong";
      msg: "URI too long";
    },
    {
      code: 6008;
      name: "uriRequired";
      msg: "URI required when metadata is enabled";
    },
    {
      code: 6009;
      name: "invalidAmount";
      msg: "Invalid amount";
    },
    {
      code: 6010;
      name: "overflow";
      msg: "Arithmetic overflow";
    },
    {
      code: 6011;
      name: "notPaused";
      msg: "Not paused";
    },
    {
      code: 6012;
      name: "complianceNotEnabled";
      msg: "Compliance module not enabled";
    },
    {
      code: 6013;
      name: "transferHookProgramRequired";
      msg: "Transfer hook program ID required when transfer hook is enabled";
    },
    {
      code: 6014;
      name: "zeroAddress";
      msg: "Role address cannot be the zero/default pubkey";
    },
    {
      code: 6015;
      name: "noPendingAuthority";
      msg: "No pending authority transfer to cancel";
    },
    {
      code: 6016;
      name: "invalidQuotaForUnlimited";
      msg: "Quota must be 0 when unlimited is true";
    }
  ];
  types: [
    {
      name: "accountFrozen";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "account";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "accountThawed";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "account";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "addedToBlacklist";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "address";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "authorityTransferAccepted";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "oldAuthority";
            type: "pubkey";
          },
          {
            name: "newAuthority";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "authorityTransferCancelled";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "cancelledPending";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "authorityTransferProposed";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "currentAuthority";
            type: "pubkey";
          },
          {
            name: "proposedAuthority";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "blacklistEntry";
      type: {
        kind: "struct";
        fields: [
          {
            name: "config";
            type: "pubkey";
          },
          {
            name: "address";
            type: "pubkey";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "initializeParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "decimals";
            type: "u8";
          },
          {
            name: "enableMetadata";
            type: "bool";
          },
          {
            name: "name";
            type: "string";
          },
          {
            name: "symbol";
            type: "string";
          },
          {
            name: "uri";
            type: "string";
          },
          {
            name: "additionalMetadata";
            type: {
              vec: {
                defined: {
                  name: "metadataField";
                };
              };
            };
          },
          {
            name: "enablePermanentDelegate";
            type: "bool";
          },
          {
            name: "enableTransferHook";
            type: "bool";
          },
          {
            name: "defaultAccountFrozen";
            type: "bool";
          },
          {
            name: "transferHookProgramId";
            docs: ["Required when enable_transfer_hook is true"];
            type: {
              option: "pubkey";
            };
          }
        ];
      };
    },
    {
      name: "initialized";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "name";
            type: "string";
          },
          {
            name: "symbol";
            type: "string";
          },
          {
            name: "decimals";
            type: "u8";
          },
          {
            name: "hasMetadata";
            type: "bool";
          }
        ];
      };
    },
    {
      name: "metadataField";
      type: {
        kind: "struct";
        fields: [
          {
            name: "key";
            type: "string";
          },
          {
            name: "value";
            type: "string";
          }
        ];
      };
    },
    {
      name: "minterAdded";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "minterAddress";
            type: "pubkey";
          },
          {
            name: "quota";
            type: "u64";
          },
          {
            name: "unlimited";
            type: "bool";
          }
        ];
      };
    },
    {
      name: "minterInfo";
      type: {
        kind: "struct";
        fields: [
          {
            name: "config";
            type: "pubkey";
          },
          {
            name: "minter";
            type: "pubkey";
          },
          {
            name: "quota";
            type: "u64";
          },
          {
            name: "minted";
            type: "u64";
          },
          {
            name: "active";
            type: "bool";
          },
          {
            name: "unlimited";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "minterRemoved";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "minterAddress";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "paused";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "pauser";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "removedFromBlacklist";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "address";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "rolesUpdated";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "oldPauser";
            type: "pubkey";
          },
          {
            name: "newPauser";
            type: "pubkey";
          },
          {
            name: "oldBurner";
            type: "pubkey";
          },
          {
            name: "newBurner";
            type: "pubkey";
          },
          {
            name: "oldFreezer";
            type: "pubkey";
          },
          {
            name: "newFreezer";
            type: "pubkey";
          },
          {
            name: "oldBlacklister";
            type: "pubkey";
          },
          {
            name: "newBlacklister";
            type: "pubkey";
          },
          {
            name: "oldSeizer";
            type: "pubkey";
          },
          {
            name: "newSeizer";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "stablecoinConfig";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "pubkey";
          },
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "pauser";
            type: "pubkey";
          },
          {
            name: "burner";
            type: "pubkey";
          },
          {
            name: "freezer";
            type: "pubkey";
          },
          {
            name: "blacklister";
            type: "pubkey";
          },
          {
            name: "seizer";
            type: "pubkey";
          },
          {
            name: "pendingAuthority";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "decimals";
            type: "u8";
          },
          {
            name: "isPaused";
            type: "bool";
          },
          {
            name: "hasMetadata";
            type: "bool";
          },
          {
            name: "totalMinters";
            type: "u16";
          },
          {
            name: "enablePermanentDelegate";
            type: "bool";
          },
          {
            name: "enableTransferHook";
            type: "bool";
          },
          {
            name: "defaultAccountFrozen";
            type: "bool";
          },
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "reserved";
            type: {
              array: ["u8", 32];
            };
          }
        ];
      };
    },
    {
      name: "tokensBurned";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "burner";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "tokensMinted";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "minter";
            type: "pubkey";
          },
          {
            name: "recipient";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "tokensSeized";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "from";
            type: "pubkey";
          },
          {
            name: "treasury";
            type: "pubkey";
          },
          {
            name: "amount";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "unpaused";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "pauser";
            type: "pubkey";
          }
        ];
      };
    },
    {
      name: "updateRolesParams";
      type: {
        kind: "struct";
        fields: [
          {
            name: "newPauser";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newBurner";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newFreezer";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newBlacklister";
            type: {
              option: "pubkey";
            };
          },
          {
            name: "newSeizer";
            type: {
              option: "pubkey";
            };
          }
        ];
      };
    },
    {
      name: "updatedMinter";
      type: {
        kind: "struct";
        fields: [
          {
            name: "mint";
            type: "pubkey";
          },
          {
            name: "minterAddress";
            type: "pubkey";
          },
          {
            name: "active";
            type: "bool";
          },
          {
            name: "quota";
            type: "u64";
          }
        ];
      };
    }
  ];
};
