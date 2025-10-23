export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function healthCheck() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Health check failed");
    const data = await res.text();
    console.log("✅ Backend connected:", data);
    return true;
  } catch (err) {
    console.error("❌ Backend unreachable:", err);
    return false;
  }
}
