"use client";

import { useEffect, useState } from "react";

type Testimonial = {
  id: string;
  user_id: string;
  display_name: string;
  product_code: string | null;
  testimonial: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

export default function CommunityTestimonialsAdmin() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/community-testimonials", { cache: "no-store" });
    if (!res.ok) {
      setMessage(res.status === 403 ? "Admin access required." : "Could not load testimonials.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.testimonials ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: Testimonial["status"]) {
    setMessage("");
    const res = await fetch("/api/admin/community-testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Update failed.");
      return;
    }
    setItems((current) =>
      current.map((item) => item.id === id ? { ...item, status } : item)
    );
    setMessage(status === "approved" ? "Testimonial published on the Community page." : "Testimonial status updated.");
  }

  return (
    <main style={{ minHeight: "100vh", background: "#050812", color: "#f4f6fb", padding: "48px 24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ color: "#d4a637", letterSpacing: "0.18em", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
          VaultTrades Admin
        </div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 54px)", margin: "10px 0 8px" }}>Community Testimonials</h1>
        <p style={{ color: "#8f9bae", maxWidth: 760, lineHeight: 1.7 }}>
          Review customer submissions before they appear on the public Community sales page.
          You control which testimonials are published. Only testimonials submitted through the authenticated customer flow appear here.
        </p>

        {message && (
          <div style={{ margin: "24px 0", padding: 14, border: "1px solid rgba(212,166,55,.3)", borderRadius: 10, color: "#d4a637" }}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 30, color: "#8f9bae" }}>Loading testimonials...</div>
        ) : items.length === 0 ? (
          <div style={{ marginTop: 30, padding: 30, border: "1px dashed rgba(212,166,55,.25)", borderRadius: 12, color: "#8f9bae" }}>
            No customer testimonials have been submitted yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16, marginTop: 30 }}>
            {items.map((item) => (
              <article key={item.id} style={{ background: "#0a101c", border: "1px solid #1d2837", borderRadius: 12, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 18 }}>{item.display_name}</strong>
                    <div style={{ color: "#687489", fontSize: 11, marginTop: 5 }}>
                      {item.product_code || "VaultTrades product"} · {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    background: item.status === "approved" ? "rgba(55,180,110,.12)" : item.status === "rejected" ? "rgba(220,70,70,.12)" : "rgba(212,166,55,.12)",
                    color: item.status === "approved" ? "#6ee7a8" : item.status === "rejected" ? "#ff8d8d" : "#d4a637"
                  }}>
                    {item.status}
                  </span>
                </div>

                <p style={{ color: "#d7dce5", lineHeight: 1.8, margin: "20px 0" }}>{item.testimonial}</p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => setStatus(item.id, "approved")} style={button("#d4a637", "#080a0f")}>
                    {item.status === "approved" ? "Published" : "Publish"}
                  </button>
                  <button onClick={() => setStatus(item.id, "pending")} style={button("#263246", "#f4f6fb")}>
                    Keep Pending
                  </button>
                  <button onClick={() => setStatus(item.id, "rejected")} style={button("#3a1d25", "#ffb4b4")}>
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div style={{ marginTop: 36 }}>
          <a href="/community" style={{ color: "#d4a637", fontSize: 13 }}>← View Community sales page</a>
        </div>
      </div>
    </main>
  );
}

function button(background: string, color: string): React.CSSProperties {
  return {
    background,
    color,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 8,
    padding: "10px 16px",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: ".06em",
    cursor: "pointer",
  };
}
