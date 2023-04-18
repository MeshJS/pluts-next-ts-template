import Head from "next/head";

import {
  resolvePlutusScriptAddress,
  Transaction,
  resolvePaymentKeyHash,
  KoiosProvider,
  resolveDataHash,
} from "@meshsdk/core";
import type { PlutusScript } from "@meshsdk/core";
import { CardanoWallet, MeshBadge, useWallet } from "@meshsdk/react";
import scriptCbor from "../contract/hello-pluts";

import { useState } from "react";

enum States {
  init,
  locking,
  lockingConfirming,
  locked,
  unlocking,
  unlockingConfirming,
  unlocked,
}

export default function Home() {
  const [state, setState] = useState(States.init);

  const { connected } = useWallet();

  const script: PlutusScript = {
    code: scriptCbor,
    version: "V2",
  };

  return (
    <div className="container">
      <Head>
        <title>Mesh App on Cardano</title>
        <meta name="description" content="A Cardano dApp powered my Mesh" />
        <link rel="icon" href="https://meshjs.dev/favicon/favicon-32x32.png" />
        <link
          href="https://meshjs.dev/css/template.css"
          rel="stylesheet"
          key="mesh-demo"
        />
      </Head>

      <main className="main">
        <h1 className="title">
          <a href="https://meshjs.dev/">Mesh</a> plu-ts Hello World
        </h1>

        <div className="demo">
          {!connected && <CardanoWallet />}

          {connected &&
            state != States.locking &&
            state != States.unlocking && (
              <>
                {(state == States.init || state != States.locked) && (
                  <Lock script={script} setState={setState} />
                )}
                <Unlock script={script} setState={setState} />
              </>
            )}

          {connected && (
            <div style={{ display: "block" }}>
              {(state == States.locking || state == States.unlocking) && (
                <>Creating transaction...</>
              )}

              {(state == States.lockingConfirming ||
                state == States.unlockingConfirming) && (
                <>Awaiting transaction confirm...</>
              )}

              {(state == States.locked || state == States.unlocked) && (
                <>Transaction confirmed</>
              )}
            </div>
          )}
        </div>

        <div className="grid">
          <a href="https://meshjs.dev/apis" className="card">
            <h2>Documentation</h2>
            <p>
              Our documentation provide live demos and code samples; great
              educational tool for learning how Cardano works.
            </p>
          </a>

          <a href="https://meshjs.dev/guides/pluts" className="card">
            <h2>Guide for this Starter Kit</h2>
            <p>
              A walk-through for this starter kit and the plu-ts Hello World
              tutorial. Allows you to reproduce this step-by-step.
            </p>
          </a>

          <a href="https://pluts.harmoniclabs.tech/" className="card">
            <h2>plu-ts Documentation</h2>
            <p>
              Write smart contracts on Cardano with plu-ts. The supporting
              tutorial for this start kit is available on the plu-ts website.
            </p>
          </a>
        </div>
      </main>

      <footer className="footer">
        <MeshBadge dark={true} />
      </footer>
    </div>
  );
}

function Lock({ script, setState }) {
  const { wallet } = useWallet();

  async function lockAsset() {
    setState(States.locking);
    const scriptAddress = resolvePlutusScriptAddress(script, 0);

    const address = (await wallet.getUsedAddresses())[0];
    const walletKeyhash = resolvePaymentKeyHash(address);

    const tx = new Transaction({ initiator: wallet }).sendLovelace(
      {
        address: scriptAddress,
        datum: {
          value: walletKeyhash,
          inline: true,
        },
      },
      "2000000"
    );

    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx);
    const txHash = await wallet.submitTx(signedTx);

    console.log("txHash", txHash);

    if (txHash) {
      const koios = new KoiosProvider("preprod");
      setState(States.lockingConfirming);
      koios.onTxConfirmed(txHash, () => {
        setState(States.locked);
      });
    }
  }

  return (
    <button type="button" onClick={() => lockAsset()}>
      Lock Asset
    </button>
  );
}

function Unlock({ script, setState }) {
  const { wallet } = useWallet();

  async function _getAssetUtxo({ scriptAddress, dataHash }) {
    const blockchainProvider = new KoiosProvider("preprod");
    const utxos = await blockchainProvider.fetchAddressUTxOs(
      scriptAddress,
      "lovelace"
    );

    let utxo = utxos.find((utxo: any) => {
      return utxo.output.dataHash == dataHash;
    });

    return utxo;
  }

  async function unlockAsset() {
    setState(States.unlocking);
    const scriptAddress = resolvePlutusScriptAddress(script, 0);

    const address = (await wallet.getUsedAddresses())[0];
    const walletKeyhash = resolvePaymentKeyHash(address);

    const dataHash = resolveDataHash(walletKeyhash);

    const utxo = await _getAssetUtxo({
      scriptAddress: scriptAddress,
      dataHash: dataHash,
    });

    const redeemer = {
      data: "Hello plu-ts",
    };

    // create the unlock asset transaction
    const tx = new Transaction({ initiator: wallet })
      .redeemValue({
        value: utxo,
        script: script,
        datum: utxo,
        redeemer: redeemer,
      })
      .sendValue(address, utxo)
      .setRequiredSigners([address]);

    const unsignedTx = await tx.build();
    const signedTx = await wallet.signTx(unsignedTx, true);
    const txHash = await wallet.submitTx(signedTx);

    console.log("txHash", txHash);

    if (txHash) {
      const koios = new KoiosProvider("preprod");
      setState(States.unlockingConfirming);
      koios.onTxConfirmed(txHash, () => {
        setState(States.unlocked);
      });
    }
  }

  return (
    <button type="button" onClick={() => unlockAsset()}>
      Unlock Asset
    </button>
  );
}
