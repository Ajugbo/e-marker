"use client";

import { useState } from "react";
import { usePaystackPayment } from "react-paystack";

type Product = "BASIC" | "PRO" | "CREDITS";
type Props = {
  product: Product;
  label: string;
  className: string;
};
type PaymentIntent = {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  name: string;
};

export default function CheckoutButton({ product, label, className }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
  const initializePayment = usePaystackPayment({
    publicKey,
    email: "",
    amount: 0,
    currency: "NGN",
  });

  const checkout = async () => {
    setError("");
    setBusy(true);
    try {
      if (!publicKey) throw new Error("Paystack checkout is not configured.");
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const result = (await response.json()) as PaymentIntent & { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Could not start payment. Please try again.");
      }
      initializePayment({
        config: {
          email: result.email,
          amount: result.amount,
          currency: result.currency,
          reference: result.reference,
          metadata: {
            custom_fields: [{
              display_name: "Customer",
              variable_name: "customer",
              value: result.name,
            }],
          },
        },
        onSuccess: (response?: { reference?: unknown }) => {
          const reference = response?.reference;
          if (typeof reference !== "string" || reference.length === 0) {
            setError("Payment completed, but its reference could not be verified.");
            setBusy(false);
            return;
          }
          window.location.assign(
            `/api/payments/verify?reference=${encodeURIComponent(reference)}`,
          );
        },
        onClose: () => setBusy(false),
      });
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start payment.");
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={() => void checkout()} disabled={busy} className={className}>
        {busy ? "Starting checkout…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
