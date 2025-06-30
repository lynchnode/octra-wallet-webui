import React, { useEffect, useState } from "react";

function App() {
  const [wallet, setWallet] = useState(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [multiList, setMultiList] = useState([{ to: "", amount: "" }]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchWallet = async () => {
    try {
      const res = await fetch("http://localhost:8000/wallet");
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      setWallet(data);
    } catch (err) {
      console.error("Wallet fetch error:", err);
      setWallet(null);
    }
  };

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    setLoading(true);
    await fetchWallet();
    const res = await fetch("http://localhost:8000/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, amount }),
    });
    const data = await res.json();
    if (res.status === 409) {
      setStatus({ ok: false, hash: data.error || "Duplicate transaction" });
    } else {
      setStatus(data);
    }
    setLoading(false);
  };

  const handleMultiSend = async () => {
    const validList = multiList
      .map((item) => ({
        to: item.to.trim(),
        amount: item.amount.toString().trim(),
      }))
      .filter(
        (item) =>
          item.to &&
          item.amount &&
          !isNaN(item.amount) &&
          parseFloat(item.amount) > 0
      );

    if (validList.length === 0) {
      alert("No valid entries to send.");
      return;
    }

    await fetchWallet();

    const res = await fetch("http://localhost:8000/multi-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list: validList }),
    });
    const data = await res.json();
    if (res.status === 409) {
      setStatus({ ok: false, hash: data.error || "Duplicate transaction" });
    } else {
      setStatus({
        ok: true,
        hash: "Multi-send successful. Total: " + data.results.length,
        results: data.results,
      });
    }
  };

  const removeRow = (index) => {
    const list = [...multiList];
    list.splice(index, 1);
    setMultiList(list);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6 sm:px-12">
      <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-xl p-6">
        <h1 className="text-2xl font-bold text-center text-blue-700 mb-6">Octra Web Wallet</h1>

        {wallet && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <p className="text-sm text-gray-600">
              <strong>Address:</strong> {wallet.address}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Balance:</strong> {wallet.balance} OCT
            </p>
            <p className="text-sm text-gray-600">
              <strong>Nonce:</strong> {wallet.nonce}
            </p>
            <a
              href={`https://octrascan.io/addr/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-sm mt-2 inline-block"
            >
              View on Octrascan Explorer
            </a>
          </div>
        )}

        <div className="mb-8">
          <h2 className="font-semibold mb-2 text-gray-700">Send OCT</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="border p-2 rounded w-full"
              placeholder="To address"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <input
              className="border p-2 rounded w-full"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="font-semibold mb-2 text-gray-700">Multi Send</h2>
          {multiList.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 mb-2 items-center">
              <input
                className="border p-2 rounded w-full"
                placeholder="To"
                value={item.to}
                onChange={(e) => {
                  const list = [...multiList];
                  list[idx].to = e.target.value;
                  setMultiList(list);
                }}
              />
              <input
                className="border p-2 rounded w-full"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => {
                  const list = [...multiList];
                  list[idx].amount = e.target.value;
                  setMultiList(list);
                }}
              />
              {multiList.length > 1 && (
                <button
                  onClick={() => removeRow(idx)}
                  className="text-red-600 font-bold px-3 py-1 hover:text-red-800"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button
              className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
              onClick={() => setMultiList([...multiList, { to: "", amount: "" }])}
            >
              + Add Row
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={handleMultiSend}
            >
              Send Multi
            </button>
          </div>
        </div>

        {status && (
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            {status.ok ? (
              <div>
                <h3 className="font-semibold mb-2 text-green-800">
                  ✅ Transaction sent successfully
                </h3>
                {Array.isArray(status.results) ? (
                  <ul className="list-disc ml-5 text-sm">
                    {status.results.map((res, idx) => (
                      <li key={idx}>
                        To: {res.to} — {res.ok ? (
                          <a
                            href={`https://octrascan.io/tx/${res.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            View on Octrascan
                          </a>
                        ) : (
                          <span className="text-red-600">Failed</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <a
                    href={`https://octrascan.io/tx/${status.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    View on Octrascan
                  </a>
                )}
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-2 text-red-700">
                  ❌ Transaction failed
                </h3>
                <p className="text-sm text-red-800">
                  {status.hash || status.error || "Unknown error"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="mt-10 text-center text-xs text-gray-500">
  <p>
    ⚠️ This is an <strong>unofficial Web UI version</strong>{" "}
    <a
      href="https://github.com/octra-labs/octra_pre_client"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 underline hover:text-blue-700"
    >
      Octra Wallet
    </a>. Use at your own risk.
  </p>
  <p className="mt-1">
    Build by{" "}
    <a
      href="https://github.com/your-username/octra-web-wallet"
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-blue-500 hover:text-blue-700"
    >
      LynchNode
    </a>
  </p>
</footer>
    </div>
  );
}

export default App;
