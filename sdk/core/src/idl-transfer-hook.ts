/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/sss_transfer_hook.json`.
 */
export type SssTransferHook = {
  address: "2VymphXYSrCV4qtS3FyiGmNQvcNrEXNUyRUh9MhDTLH9";
  metadata: {
    name: "sssTransferHook";
    version: "0.1.0";
    spec: "0.1.0";
    description: "Transfer hook for SSS blacklist enforcement";
  };
  instructions: [
    {
      name: "initializeExtraAccountMetaList";
      discriminator: [43, 34, 13, 49, 167, 88, 235, 235];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "extraAccountMetaList";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
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
          name: "mint";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        }
      ];
      args: [];
    },
    {
      name: "transferHook";
      discriminator: [105, 37, 101, 197, 75, 251, 102, 26];
      accounts: [
        {
          name: "sourceToken";
        },
        {
          name: "mint";
        },
        {
          name: "destinationToken";
        },
        {
          name: "owner";
        },
        {
          name: "extraAccountMetaList";
          pda: {
            seeds: [
              {
                kind: "const";
                value: [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
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
          name: "sssCoreProgram";
        },
        {
          name: "config";
        },
        {
          name: "sourceBlacklistEntry";
        },
        {
          name: "destBlacklistEntry";
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    }
  ];
  errors: [
    {
      code: 6000;
      name: "blacklisted";
      msg: "Address is blacklisted";
    },
    {
      code: 6001;
      name: "notTransferring";
      msg: "Not currently transferring";
    }
  ];
};
