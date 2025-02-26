"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSearchParams } from "next/navigation";
import bs58 from "bs58";
import * as jwt from "jsonwebtoken";
import { JwtPayload } from "jsonwebtoken";

export interface TokenPayload {
  id: string;
  nonce: string;
}

export default function AuthPage() {
  const { publicKey, connected, connecting, signMessage } = useWallet();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [hasSignedMessage, setHasSignedMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const verifyWallet = useCallback(async () => {
    console.log("verifyWallet");
    if (!signMessage || !publicKey || !code) {
      throw new Error("Sign message or public key or code is not available");
    }

    const decodedCode = jwt.decode(code, { complete: true });
    const payload = decodedCode?.payload as TokenPayload;
    console.log("payload", payload);

    // Create timestamp and message to sign
    const message = `${process.env.NEXT_PUBLIC_SIGN_MESSAGE} ${payload.nonce}`;
    // Sign the message
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await signMessage(encodedMessage);

    // convert from bs58 to string the signed message
    const signedMessageString = bs58.encode(signedMessage);
    return signedMessageString;
  }, [signMessage, publicKey, code, hasSignedMessage]);

  useEffect(() => {
    if (publicKey && connected && !connecting && code && !hasSignedMessage) {
      verifyWallet().then((sig) => {
        setHasSignedMessage(true);
        console.log("sig", sig);
        // TODO: send the signed message to the server
        setIsLoading(true);
        fetch(`${process.env.NEXT_PUBLIC_KINKONG_API_BASE_URL}/auth/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txn: sig,
            jwt: code,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.redirect) {
              window.location.href = data.redirect;
            } else {
              setError("You are not authorized to connect to this wallet");
            }
          })
          .catch((err) => {
            setError("You are not authorized to connect to this wallet");
          })
          .finally(() => {
            setIsLoading(false);
          });
      });
    }
  }, [publicKey, connected, connecting, code, hasSignedMessage]);

  return (
    <div className="flex flex-col items-center gap-4 justify-center h-screen">
      <h1 className="text-4xl font-bold">KinKong Bot Wallet Connect</h1>
      <p className="text-lg text-center italic">
        Connect your wallet to get started.
        <br />
        Sign the message to verify your wallet.
      </p>
      {isLoading && (
        <p className="text-blue-500">Processing authentication...</p>
      )}

      {error && (
        <p className="text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
